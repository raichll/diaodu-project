const TABLE_NAME = process.env.SUPABASE_TABLE || "dispatch_records";

function applyCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.origin || "";
  const allowedList = allowed.split(",").map((item) => item.trim()).filter(Boolean);
  const responseOrigin = allowed === "*" ? "*" : allowedList.includes(origin) ? origin : allowedList[0] || "*";
  res.setHeader("Access-Control-Allow-Origin", responseOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" };
  }
  return {
    supabaseUrl: url.replace(/\/$/, ""),
    supabaseKey: key
  };
}

function authorized(req) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return true;
  return req.headers["x-api-key"] === expected || req.headers.authorization === `Bearer ${expected}`;
}

async function readBody(req) {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function cleanText(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function normalizeRecord(input) {
  const now = new Date().toISOString();
  return {
    source_system: cleanText(input.source_system || input.sourceSystem, "未命名系统"),
    event_type: cleanText(input.event_type || input.eventType, "未分类事件"),
    title: cleanText(input.title, "未命名事件"),
    description: cleanText(input.description),
    location: cleanText(input.location),
    region: cleanText(input.region),
    severity: cleanText(input.severity, "一般"),
    status: cleanText(input.status, "待处理"),
    event_time: input.event_time || input.eventTime || now,
    payload: typeof input.payload === "object" && input.payload !== null ? input.payload : {}
  };
}

function filterValue(value) {
  return String(value || "")
    .replace(/[,*()]/g, " ")
    .trim();
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

async function handleGet(req, res, cfg) {
  const currentUrl = new URL(req.url, "http://localhost");
  const target = new URL(`${cfg.supabaseUrl}/rest/v1/${TABLE_NAME}`);
  target.searchParams.set("select", "*");
  target.searchParams.set("order", "created_at.desc");
  target.searchParams.set("limit", currentUrl.searchParams.get("limit") || "300");

  const source = currentUrl.searchParams.get("source_system");
  const status = currentUrl.searchParams.get("status");
  const q = filterValue(currentUrl.searchParams.get("q"));
  if (source) target.searchParams.set("source_system", `eq.${source}`);
  if (status) target.searchParams.set("status", `eq.${status}`);
  if (q) {
    target.searchParams.set("or", `(title.ilike.*${q}*,description.ilike.*${q}*,location.ilike.*${q}*,region.ilike.*${q}*)`);
  }

  const response = await fetch(target, {
    headers: supabaseHeaders(cfg.supabaseKey)
  });
  const text = await response.text();
  if (!response.ok) {
    return json(res, response.status, { error: "Supabase 查询失败", detail: text });
  }
  return json(res, 200, text ? JSON.parse(text) : []);
}

async function handlePost(req, res, cfg) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "请求体不是合法 JSON" });
  }

  const inputRecords = Array.isArray(body) ? body : [body];
  if (!inputRecords.length || inputRecords.length > 500) {
    return json(res, 400, { error: "每次提交数量必须在 1 到 500 条之间" });
  }

  const records = inputRecords.map(normalizeRecord);
  const response = await fetch(`${cfg.supabaseUrl}/rest/v1/${TABLE_NAME}?select=*`, {
    method: "POST",
    headers: supabaseHeaders(cfg.supabaseKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify(records)
  });

  const text = await response.text();
  if (!response.ok) {
    return json(res, response.status, { error: "Supabase 写入失败", detail: text });
  }
  return json(res, 201, text ? JSON.parse(text) : []);
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const cfg = config();
  if (cfg.error) return json(res, 500, { error: cfg.error });
  if (req.method === "POST" && !authorized(req)) {
    return json(res, 401, { error: "缺少或错误的接入密钥" });
  }

  try {
    if (req.method === "GET") return await handleGet(req, res, cfg);
    if (req.method === "POST") return await handlePost(req, res, cfg);
    return json(res, 405, { error: "仅支持 GET、POST" });
  } catch (error) {
    return json(res, 500, { error: "服务异常", detail: error.message });
  }
};

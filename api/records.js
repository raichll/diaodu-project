const TABLE_NAME = process.env.SUPABASE_TABLE || "dispatch_records";

function applyCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.origin || "";
  const allowedList = allowed.split(",").map((item) => item.trim()).filter(Boolean);
  const responseOrigin = allowed === "*" ? "*" : allowedList.includes(origin) ? origin : allowedList[0] || "*";
  res.setHeader("Access-Control-Allow-Origin", responseOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key");
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

function firstValue(input, keys, fallback = "") {
  for (const key of keys) {
    if (input[key] !== undefined && input[key] !== null && String(input[key]).trim() !== "") {
      return input[key];
    }
  }
  return fallback;
}

function listValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRecordV2(input) {
  const now = new Date().toISOString();
  const payload = typeof input.payload === "object" && input.payload !== null ? { ...input.payload } : {};
  const imageUrls = listValue(firstValue(input, ["image_urls", "imageUrls", "image_url", "imageUrl", "images", "screenshots", "snapshot_urls"]));
  const videoUrls = listValue(firstValue(input, ["video_urls", "videoUrls", "video_url", "videoUrl", "videos", "clip_urls", "stream_urls"]));
  const evidence = [];

  imageUrls.forEach((url, index) => evidence.push({ type: "image", url, label: `图片证据 ${index + 1}` }));
  videoUrls.forEach((url, index) => evidence.push({ type: "video", url, label: `视频证据 ${index + 1}` }));
  if (Array.isArray(input.evidence)) {
    input.evidence.forEach((item) => {
      if (item && item.url) {
        evidence.push({
          type: cleanText(item.type, "file"),
          url: String(item.url).trim(),
          label: cleanText(item.label || item.name, "证据材料")
        });
      }
    });
  }

  const reviewStatus = cleanText(firstValue(input, ["review_status", "reviewStatus", "audit_status", "auditStatus"]), "待人工审核");
  const dispatchStatus = cleanText(firstValue(input, ["dispatch_status", "dispatchStatus", "push_status", "pushStatus"]), "未推送");
  payload.image_urls = imageUrls;
  payload.video_urls = videoUrls;
  payload.evidence = evidence;
  payload.review_status = reviewStatus;
  payload.dispatch_status = dispatchStatus;
  payload.raw = input;

  return {
    source_system: cleanText(firstValue(input, ["source_system", "sourceSystem", "system", "platform", "source_name"]), "未命名系统"),
    event_type: cleanText(firstValue(input, ["event_type", "eventType", "type", "alarm_type", "problem_type"]), "未分类线索"),
    title: cleanText(firstValue(input, ["title", "name", "event_title", "alarm_title"]), "未命名线索"),
    description: cleanText(firstValue(input, ["description", "detail", "content", "remark", "message"])),
    location: cleanText(firstValue(input, ["location", "point_name", "pointName", "site_name", "siteName", "address", "company_name"])),
    region: cleanText(firstValue(input, ["region", "district", "area", "street", "county"])),
    severity: cleanText(firstValue(input, ["severity", "level", "grade"]), "一般"),
    status: cleanText(firstValue(input, ["status", "state", "process_status"]), reviewStatus),
    event_time: firstValue(input, ["event_time", "eventTime", "alarm_time", "alarmTime", "monitor_time", "create_time"], now),
    payload
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

  const records = inputRecords.map(normalizeRecordV2);
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

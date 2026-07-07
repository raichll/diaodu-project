const SOURCE_SYSTEMS = [
  "大气环境智能管理与综合分析平台",
  "视频融合赋能平台",
  "成都市智慧工地平台",
  "青羊区国控站污染源视频 AI 智能监管平台",
  "重点排污单位自动监控与基础数据库系统",
  "锦江干流入河排口智能监控系统",
  "智慧生态环境平台",
  "四川省高空视频智能监控监管系统",
  "成都市事件交互枢纽系统",
  "高空站点莹石云平台"
];

const STORAGE_KEY = "dispatch_evidence_records_v2";
let records = [];
let apiMode = "checking";
let toastTimer = 0;

document.title = "调度中心证据中台";
document.querySelector(".app").innerHTML = `
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">DC</div>
      <div>
        <h1>证据中台</h1>
        <p>线索 · 截图 · 视频</p>
      </div>
    </div>
    <nav class="nav" aria-label="主导航">
      <button class="nav-item is-active" type="button" data-panel="ingest">线索接入</button>
      <button class="nav-item" type="button" data-panel="records">线索台账</button>
      <button class="nav-item" type="button" data-panel="api">接口规范</button>
    </nav>
    <div class="connection">
      <span id="apiDot" class="dot"></span>
      <span id="apiStatus">正在连接</span>
    </div>
  </aside>
  <main class="main">
    <header class="topbar">
      <div>
        <p class="eyebrow">Vercel + Supabase</p>
        <h2>问题线索与图片视频证据中台</h2>
      </div>
      <div class="top-actions">
        <button id="refreshRecords" class="secondary-button" type="button">刷新</button>
        <button id="exportCsv" class="primary-button" type="button">导出 CSV</button>
      </div>
    </header>
    <section class="summary-grid">
      <article class="summary-card"><span>线索总量</span><strong id="totalCount">0</strong><small>全部来源记录</small></article>
      <article class="summary-card"><span>今日新增</span><strong id="todayCount">0</strong><small>按提交时间统计</small></article>
      <article class="summary-card"><span>含证据线索</span><strong id="evidenceCount">0</strong><small>图片、截图、视频</small></article>
      <article class="summary-card"><span>待人工审核</span><strong id="pendingCount">0</strong><small>派发前复核</small></article>
    </section>
    <section id="ingest" class="panel-view is-active">
      <div class="grid two-one">
        <section class="panel">
          <div class="panel-head"><div><h3>新增问题线索</h3><p>支持字段、图片截图、视频链接一起接入</p></div></div>
          <form id="recordForm" class="record-form">
            <label><span>来源系统</span><select id="sourceSystem" required></select></label>
            <label><span>线索类型</span><input id="eventType" type="text" value="视频识别线索" required></label>
            <label class="wide"><span>线索标题</span><input id="title" type="text" value="疑似烟雾异常线索" required></label>
            <label class="wide"><span>线索描述</span><textarea id="description" rows="3">系统识别到疑似环境问题，请调度中心人工审核后决定是否派发。</textarea></label>
            <label><span>点位/对象</span><input id="location" type="text" value="高空视频点位 A-013"></label>
            <label><span>所属区域</span><input id="region" type="text" value="锦江区"></label>
            <label><span>等级</span><select id="severity"><option value="一般">一般</option><option value="较重">较重</option><option value="严重">严重</option><option value="紧急">紧急</option></select></label>
            <label><span>审核状态</span><select id="reviewStatus"><option value="待人工审核">待人工审核</option><option value="审核通过">审核通过</option><option value="退回线索">退回线索</option><option value="无需派发">无需派发</option></select></label>
            <label class="wide"><span>图片/截图 URL</span><textarea id="imageUrls" rows="2" placeholder="一行一个图片链接，或用逗号分隔"></textarea></label>
            <label class="wide"><span>视频 URL</span><textarea id="videoUrls" rows="2" placeholder="一行一个视频片段、视频流或播放页链接"></textarea></label>
            <button class="primary-button wide" type="submit">提交线索</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>CSV 批量接入</h3><p>可包含 image_urls、video_urls、review_status 字段</p></div></div>
          <div class="upload-box"><input id="csvInput" type="file" accept=".csv,text/csv"><button id="importCsv" class="secondary-button" type="button">导入 CSV</button></div>
          <div class="source-list" id="sourceList"></div>
        </section>
      </div>
    </section>
    <section id="records" class="panel-view">
      <section class="panel">
        <div class="panel-head"><div><h3>线索台账</h3><p>查看字段、图片截图、视频证据和审核状态</p></div></div>
        <div class="filters">
          <input id="searchInput" type="search" placeholder="搜索标题、描述、点位、区域">
          <select id="filterSource"></select>
          <select id="filterStatus">
            <option value="">全部状态</option>
            <option value="待人工审核">待人工审核</option>
            <option value="审核通过">审核通过</option>
            <option value="退回线索">退回线索</option>
            <option value="无需派发">无需派发</option>
            <option value="已推送">已推送</option>
          </select>
        </div>
        <div id="recordCards" class="record-cards"></div>
      </section>
    </section>
    <section id="api" class="panel-view">
      <div class="grid">
        <section class="panel">
          <div class="panel-head"><div><h3>外部系统提交接口</h3><p>字段和证据链接可以一次提交</p></div></div>
          <pre class="code-block"><code>POST https://diaodu-project.vercel.app/api/records
Content-Type: application/json

{
  "source_system": "四川省高空视频智能监控监管系统",
  "event_type": "视频识别线索",
  "title": "疑似烟雾异常线索",
  "description": "高空视频识别到疑似烟雾",
  "location": "高空视频点位 A-013",
  "region": "锦江区",
  "severity": "较重",
  "review_status": "待人工审核",
  "image_urls": ["https://example.com/snapshot.jpg"],
  "video_urls": ["https://example.com/clip.mp4"]
}</code></pre>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>CSV 字段建议</h3><p>多图片、多视频可用竖线分隔</p></div></div>
          <pre class="code-block"><code>source_system,event_type,title,description,location,region,severity,review_status,image_urls,video_urls
视频融合赋能平台,视频线索,疑似露天焚烧,发现疑似烟雾,天网点位01,武侯区,较重,待人工审核,https://.../a.jpg|https://.../b.jpg,https://.../clip.mp4</code></pre>
        </section>
      </div>
    </section>
  </main>
`;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function setApiStatus(mode, text) {
  apiMode = mode;
  $("apiStatus").textContent = text;
  $("apiDot").className = `dot ${mode === "online" ? "is-online" : "is-local"}`;
}

function nowIso() {
  return new Date().toISOString();
}

function makeLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function listValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function evidenceFromInput(input) {
  const imageUrls = listValue(input.image_urls || input.imageUrls || input.image_url || input.imageUrl || input.images || input.screenshots);
  const videoUrls = listValue(input.video_urls || input.videoUrls || input.video_url || input.videoUrl || input.videos);
  const evidence = [];
  imageUrls.forEach((url, index) => evidence.push({ type: "image", url, label: `图片证据 ${index + 1}` }));
  videoUrls.forEach((url, index) => evidence.push({ type: "video", url, label: `视频证据 ${index + 1}` }));
  if (Array.isArray(input.evidence)) {
    input.evidence.forEach((item) => {
      if (item && item.url) evidence.push({ type: item.type || "file", url: item.url, label: item.label || "证据材料" });
    });
  }
  return { imageUrls, videoUrls, evidence };
}

function normalizeRecord(input) {
  const createdAt = input.created_at || nowIso();
  const payload = typeof input.payload === "object" && input.payload !== null ? { ...input.payload } : {};
  const evidence = evidenceFromInput({ ...payload, ...input });
  payload.image_urls = evidence.imageUrls;
  payload.video_urls = evidence.videoUrls;
  payload.evidence = evidence.evidence;
  payload.review_status = String(input.review_status || input.reviewStatus || payload.review_status || input.status || "待人工审核").trim();
  payload.dispatch_status = String(input.dispatch_status || input.dispatchStatus || payload.dispatch_status || "未推送").trim();
  return {
    id: input.id || makeLocalId(),
    source_system: String(input.source_system || input.sourceSystem || input.system || "未命名系统").trim(),
    event_type: String(input.event_type || input.eventType || input.type || "未分类线索").trim(),
    title: String(input.title || input.name || "未命名线索").trim(),
    description: String(input.description || input.detail || input.content || "").trim(),
    location: String(input.location || input.point_name || input.pointName || input.site_name || input.address || "").trim(),
    region: String(input.region || input.district || input.area || "").trim(),
    severity: String(input.severity || input.level || "一般").trim(),
    status: String(input.status || payload.review_status || "待人工审核").trim(),
    event_time: input.event_time || input.eventTime || input.alarm_time || createdAt,
    payload,
    created_at: createdAt
  };
}

function seedRecords() {
  const createdAt = nowIso();
  return [
    normalizeRecord({
      id: makeLocalId(),
      source_system: "四川省高空视频智能监控监管系统",
      event_type: "视频识别线索",
      title: "疑似烟雾异常线索",
      description: "高空视频识别到疑似烟雾，等待调度中心人工审核。",
      location: "高空视频点位 A-013",
      region: "锦江区",
      severity: "较重",
      review_status: "待人工审核",
      event_time: createdAt,
      created_at: createdAt
    }),
    normalizeRecord({
      id: makeLocalId(),
      source_system: "重点排污单位自动监控与基础数据库系统",
      event_type: "监测报警",
      title: "废气排放口颗粒物报警",
      description: "监控点：废气排放口 DA001；监控因子：颗粒物。",
      location: "废气排放口 DA001",
      region: "待确认",
      severity: "一般",
      review_status: "待人工审核",
      event_time: createdAt,
      created_at: createdAt
    })
  ];
}

function loadLocalRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = seedRecords();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalRecords(nextRecords) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
}

function reviewStatus(record) {
  return record.payload?.review_status || record.status || "待人工审核";
}

function dispatchStatus(record) {
  return record.payload?.dispatch_status || "未推送";
}

function evidenceItems(record) {
  const payload = record.payload || {};
  const items = [];
  (payload.evidence || []).forEach((item) => {
    if (item && item.url) items.push(item);
  });
  if (!items.length) {
    (payload.image_urls || []).forEach((url, index) => items.push({ type: "image", url, label: `图片证据 ${index + 1}` }));
    (payload.video_urls || []).forEach((url, index) => items.push({ type: "video", url, label: `视频证据 ${index + 1}` }));
  }
  return items;
}

function hasEvidence(record) {
  return evidenceItems(record).length > 0;
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set("limit", "300");
  const q = $("searchInput").value.trim();
  const source = $("filterSource").value;
  const status = $("filterStatus").value;
  if (q) params.set("q", q);
  if (source) params.set("source_system", source);
  if (status) params.set("status", status);
  return params.toString();
}

async function fetchRecords() {
  if (window.location.protocol === "file:") {
    records = loadLocalRecords();
    setApiStatus("local", "本地演示模式");
    renderAll();
    return;
  }
  try {
    const response = await fetch(`/api/records?${buildQuery()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    records = (await response.json()).map(normalizeRecord);
    setApiStatus("online", "Supabase 已连接");
  } catch {
    records = loadLocalRecords();
    setApiStatus("local", "本地演示模式");
  }
  renderAll();
}

async function postRecords(payload) {
  if (window.location.protocol === "file:" || apiMode === "local") {
    const items = Array.isArray(payload) ? payload : [payload];
    const next = [...items.map(normalizeRecord), ...loadLocalRecords()];
    saveLocalRecords(next);
    records = next;
    return items;
  }
  const response = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `HTTP ${response.status}`);
  }
  return response.json();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function severityClass(value) {
  if (value === "严重" || value === "紧急") return "hot";
  if (value === "较重") return "warn";
  return "";
}

function visibleRecords() {
  const q = $("searchInput").value.trim().toLowerCase();
  const source = $("filterSource").value;
  const status = $("filterStatus").value;
  return records.filter((record) => {
    const text = `${record.title} ${record.description} ${record.location} ${record.region} ${record.source_system}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (source && record.source_system !== source) return false;
    if (status && reviewStatus(record) !== status && record.status !== status) return false;
    return true;
  });
}

function renderSummary() {
  const today = new Date().toISOString().slice(0, 10);
  $("totalCount").textContent = records.length;
  $("todayCount").textContent = records.filter((record) => String(record.created_at || "").startsWith(today)).length;
  $("evidenceCount").textContent = records.filter(hasEvidence).length;
  $("pendingCount").textContent = records.filter((record) => reviewStatus(record) === "待人工审核").length;
}

function renderSources() {
  const selectedSource = $("sourceSystem").value;
  const selectedFilter = $("filterSource").value;
  const options = SOURCE_SYSTEMS.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  $("sourceSystem").innerHTML = options;
  $("filterSource").innerHTML = `<option value="">全部来源系统</option>${options}`;
  if (selectedSource) $("sourceSystem").value = selectedSource;
  if (selectedFilter) $("filterSource").value = selectedFilter;
  $("sourceList").innerHTML = SOURCE_SYSTEMS.map((name) => {
    const count = records.filter((record) => record.source_system === name).length;
    return `<div class="source-pill"><strong>${escapeHtml(name)}</strong><span>${count} 条</span></div>`;
  }).join("");
}

function renderEvidence(record) {
  const items = evidenceItems(record);
  if (!items.length) return `<div class="evidence-empty">暂无图片或视频证据</div>`;
  return `<div class="evidence-grid">${items.map((item) => {
    const type = String(item.type || "").toLowerCase();
    const url = String(item.url || "");
    if (type.includes("image") || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
      return `<a class="evidence-item image" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="${escapeHtml(item.label || "图片证据")}" loading="lazy"><span>${escapeHtml(item.label || "图片证据")}</span></a>`;
    }
    return `<a class="evidence-item video" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><span class="video-mark">视频</span><strong>${escapeHtml(item.label || "视频证据")}</strong><small>${escapeHtml(url)}</small></a>`;
  }).join("")}</div>`;
}

function renderCards() {
  const rows = visibleRecords();
  if (!rows.length) {
    $("recordCards").innerHTML = `<div class="empty-state">暂无匹配线索</div>`;
    return;
  }
  $("recordCards").innerHTML = rows.map((record) => `
    <article class="record-card">
      <div class="record-card-head">
        <div>
          <span class="source-name">${escapeHtml(record.source_system)}</span>
          <h4>${escapeHtml(record.title)}</h4>
          <p>${escapeHtml(record.description || "暂无描述")}</p>
        </div>
        <div class="status-stack">
          <span class="tag ${severityClass(record.severity)}">${escapeHtml(record.severity || "一般")}</span>
          <span class="tag">${escapeHtml(reviewStatus(record))}</span>
        </div>
      </div>
      <div class="meta-grid">
        <span><strong>类型</strong>${escapeHtml(record.event_type || "-")}</span>
        <span><strong>点位</strong>${escapeHtml(record.location || "-")}</span>
        <span><strong>区域</strong>${escapeHtml(record.region || "-")}</span>
        <span><strong>时间</strong>${escapeHtml(formatDate(record.event_time || record.created_at))}</span>
        <span><strong>推送</strong>${escapeHtml(dispatchStatus(record))}</span>
      </div>
      ${renderEvidence(record)}
    </article>
  `).join("");
}

function renderAll() {
  renderSummary();
  renderSources();
  renderCards();
}

function formPayload() {
  return {
    source_system: $("sourceSystem").value,
    event_type: $("eventType").value.trim(),
    title: $("title").value.trim(),
    description: $("description").value.trim(),
    location: $("location").value.trim(),
    region: $("region").value.trim(),
    severity: $("severity").value,
    status: $("reviewStatus").value,
    review_status: $("reviewStatus").value,
    dispatch_status: "未推送",
    image_urls: listValue($("imageUrls").value),
    video_urls: listValue($("videoUrls").value),
    event_time: nowIso()
  };
}

async function submitForm(event) {
  event.preventDefault();
  const payload = formPayload();
  if (!payload.title || !payload.event_type || !payload.source_system) {
    showToast("请补全来源系统、线索类型和线索标题");
    return;
  }
  try {
    await postRecords(payload);
    showToast("线索已提交");
    await fetchRecords();
  } catch (error) {
    showToast(`提交失败：${error.message}`);
  }
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((cell) => cell.trim());
  return rows.slice(1).map((cells) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = cells[index] || "";
    });
    return normalizeRecord(item);
  });
}

async function importCsv() {
  const file = $("csvInput").files[0];
  if (!file) {
    showToast("请选择 CSV 文件");
    return;
  }
  const text = await file.text();
  const items = parseCsv(text);
  if (!items.length) {
    showToast("CSV 中没有可导入数据");
    return;
  }
  try {
    await postRecords(items);
    showToast(`已导入 ${items.length} 条`);
    await fetchRecords();
  } catch (error) {
    showToast(`导入失败：${error.message}`);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function exportCsv() {
  const rows = visibleRecords();
  const headers = ["source_system", "event_type", "title", "description", "location", "region", "severity", "status", "review_status", "dispatch_status", "image_urls", "video_urls", "event_time", "created_at"];
  const csv = [
    headers.join(","),
    ...rows.map((record) => {
      const payload = record.payload || {};
      const row = {
        ...record,
        review_status: reviewStatus(record),
        dispatch_status: dispatchStatus(record),
        image_urls: (payload.image_urls || []).join("|"),
        video_urls: (payload.video_urls || []).join("|")
      };
      return headers.map((header) => csvEscape(row[header])).join(",");
    })
  ].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dispatch-evidence-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".panel-view").forEach((view) => view.classList.remove("is-active"));
      button.classList.add("is-active");
      $(button.dataset.panel).classList.add("is-active");
    });
  });
  $("recordForm").addEventListener("submit", submitForm);
  $("importCsv").addEventListener("click", importCsv);
  $("refreshRecords").addEventListener("click", fetchRecords);
  $("exportCsv").addEventListener("click", exportCsv);
  ["searchInput", "filterSource", "filterStatus"].forEach((id) => {
    $(id).addEventListener("input", renderCards);
    $(id).addEventListener("change", () => {
      if (apiMode === "online") fetchRecords();
      renderCards();
    });
  });
}

function init() {
  renderSources();
  bindEvents();
  fetchRecords();
}

init();

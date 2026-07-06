const SOURCE_SYSTEMS = [
  "高空视频系统",
  "智慧工地系统",
  "排口监控系统",
  "智慧生态环境平台",
  "大气环境平台",
  "水环境监测系统",
  "固废监管系统",
  "应急指挥系统",
  "执法巡查系统",
  "网格化监管系统"
];

const STORAGE_KEY = "dispatch_data_center_records_v1";
let records = [];
let apiMode = "checking";
let toastTimer = 0;

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

function seedRecords() {
  return [
    {
      id: makeLocalId(),
      source_system: "高空视频系统",
      event_type: "视频AI告警",
      title: "疑似烟雾异常告警",
      description: "高空视频识别到疑似烟雾，已进入复核队列。",
      location: "高空视频点位 A-013",
      region: "锦江区",
      severity: "较重",
      status: "待处理",
      event_time: nowIso(),
      created_at: nowIso()
    },
    {
      id: makeLocalId(),
      source_system: "排口监控系统",
      event_type: "排口浓度异常",
      title: "总磷指标短时波动",
      description: "排口在线监测出现短时波动，建议核对站点运维状态。",
      location: "排口 P-207",
      region: "龙泉驿区",
      severity: "一般",
      status: "处理中",
      event_time: nowIso(),
      created_at: nowIso()
    }
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

function normalizeRecord(input) {
  const createdAt = input.created_at || nowIso();
  return {
    id: input.id || makeLocalId(),
    source_system: String(input.source_system || input.sourceSystem || "未命名系统").trim(),
    event_type: String(input.event_type || input.eventType || "未分类事件").trim(),
    title: String(input.title || "未命名事件").trim(),
    description: String(input.description || "").trim(),
    location: String(input.location || "").trim(),
    region: String(input.region || "").trim(),
    severity: String(input.severity || "一般").trim(),
    status: String(input.status || "待处理").trim(),
    event_time: input.event_time || input.eventTime || createdAt,
    payload: input.payload || {},
    created_at: createdAt
  };
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
    records = await response.json();
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
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
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
    const text = `${record.title} ${record.description} ${record.location} ${record.region}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (source && record.source_system !== source) return false;
    if (status && record.status !== status) return false;
    return true;
  });
}

function renderSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const sourceSet = new Set(records.map((record) => record.source_system).filter(Boolean));
  $("totalCount").textContent = records.length;
  $("todayCount").textContent = records.filter((record) => String(record.created_at || "").startsWith(today)).length;
  $("sourceCount").textContent = sourceSet.size;
  $("pendingCount").textContent = records.filter((record) => record.status === "待处理").length;
}

function renderSources() {
  const selectedSource = $("sourceSystem").value;
  const selectedFilter = $("filterSource").value;
  const options = SOURCE_SYSTEMS.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  $("sourceSystem").innerHTML = options;
  $("filterSource").innerHTML = `<option value="">全部源系统</option>${options}`;
  if (selectedSource) $("sourceSystem").value = selectedSource;
  if (selectedFilter) $("filterSource").value = selectedFilter;

  const counts = SOURCE_SYSTEMS.map((name) => ({
    name,
    count: records.filter((record) => record.source_system === name).length
  }));
  $("sourceList").innerHTML = counts
    .map((item) => `<div class="source-pill"><strong>${escapeHtml(item.name)}</strong><span>${item.count} 条</span></div>`)
    .join("");
}

function renderRows() {
  const rows = visibleRecords();
  if (!rows.length) {
    $("recordRows").innerHTML = `<tr><td colspan="6">暂无匹配数据</td></tr>`;
    return;
  }

  $("recordRows").innerHTML = rows
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(formatDate(record.created_at || record.event_time))}</td>
          <td>${escapeHtml(record.source_system)}</td>
          <td>
            <div class="record-title">
              <strong>${escapeHtml(record.title)}</strong>
              <small>${escapeHtml(record.event_type)} · ${escapeHtml(record.location || "无点位")}</small>
            </div>
          </td>
          <td>${escapeHtml(record.region || "-")}</td>
          <td><span class="tag ${severityClass(record.severity)}">${escapeHtml(record.severity || "一般")}</span></td>
          <td><span class="tag">${escapeHtml(record.status || "待处理")}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderAll() {
  renderSummary();
  renderSources();
  renderRows();
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
    status: $("status").value,
    event_time: nowIso()
  };
}

async function submitForm(event) {
  event.preventDefault();
  const payload = formPayload();
  if (!payload.title || !payload.event_type || !payload.source_system) {
    showToast("请补全源系统、事件类型和事件标题");
    return;
  }

  try {
    await postRecords(payload);
    showToast("数据已提交");
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
  const headers = ["source_system", "event_type", "title", "description", "location", "region", "severity", "status", "event_time", "created_at"];
  const csv = [headers.join(","), ...rows.map((record) => headers.map((header) => csvEscape(record[header])).join(","))].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dispatch-records-${new Date().toISOString().slice(0, 10)}.csv`;
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
    $(id).addEventListener("input", renderRows);
    $(id).addEventListener("change", () => {
      if (apiMode === "online") fetchRecords();
      renderRows();
    });
  });
}

function init() {
  renderSources();
  bindEvents();
  fetchRecords();
}

init();

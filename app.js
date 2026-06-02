const STORAGE_KEY = "household-budget-app-v1";
const BACKUP_KEY = `${STORAGE_KEY}-backup`;
const API_STATE_URL = "./api/state";
const newId = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const PAYMENT_METHODS = ["카드(원)", "카드(수)", "현금", "계좌이체"];
const CATEGORY_COLORS = {
  "생활": "#A7D8F0",
  "식재료": "#BFE7C2",
  "외식": "#FFD6A5",
  "교통": "#C8D7FF",
  "고정": "#F7C7D9",
  "관계": "#D9C2F0",
  "쇼핑(Flex)": "#F8C8B8",
  "의료": "#BDEDE0",
  "문화": "#FFE6A7",
  "여행": "#C7E9F1",
  "기타": "#DDE3EA",
};
const FALLBACK_COLORS = ["#A7D8F0", "#BFE7C2", "#FFD6A5", "#C8D7FF", "#F7C7D9", "#D9C2F0", "#F8C8B8", "#BDEDE0"];
const PAYMENT_COLORS = {
  "국민(원)": "#DCEEFF",
  "삼성(원)": "#D8F1F0",
  "신한(원)": "#DFF0D8",
  "현대(원)": "#E5E4FF",
  "국민(수)": "#FFE1D4",
  "국체(수)": "#FFD9E8",
  "롯데(수)": "#FFE8B8",
  "현대(수)": "#F2DDF7",
  "원 용돈": "#E0F5D9",
  "수연이 용돈": "#FFE0CC",
  "원": "#D7ECFF",
  "수연": "#FFD7C9",
};
const METHOD_FALLBACK_COLORS = {
  "카드(원)": "#DCEEFF",
  "카드(수)": "#FFE1D4",
  "현금": "#E2F5E8",
  "계좌이체": "#FFF0CF",
};
const DEFAULT_CARD_TARGETS = {
  "국민(원)": { primary: 300000, secondary: 0 },
  "삼성(원)": { primary: 300000, secondary: 0 },
  "신한(원)": { primary: 300000, secondary: 0 },
  "국민(수)": { primary: 300000, secondary: 0 },
  "국체(수)": { primary: 200000, secondary: 0 },
  "롯데(수)": { primary: 400000, secondary: 0 },
  "현대(수)": { primary: 300000, secondary: 0 },
};

const sampleState = {
  settings: {
    categories: ["생활", "식재료", "외식", "교통", "고정", "관계", "쇼핑(Flex)", "의료", "문화", "여행", "기타"],
    incomeTypes: ["급여(원)", "급여(수)", "기타(원)", "기타(수)", "축의금", "환급"],
    cardTargets: DEFAULT_CARD_TARGETS,
    paymentItems: [
      { group: "카드(원)", name: "국민(원)", method: "카드(원)" },
      { group: "카드(원)", name: "삼성(원)", method: "카드(원)" },
      { group: "카드(원)", name: "신한(원)", method: "카드(원)" },
      { group: "카드(원)", name: "현대(원)", method: "카드(원)" },
      { group: "카드(수)", name: "국민(수)", method: "카드(수)" },
      { group: "카드(수)", name: "국체(수)", method: "카드(수)" },
      { group: "카드(수)", name: "롯데(수)", method: "카드(수)" },
      { group: "카드(수)", name: "현대(수)", method: "카드(수)" },
      { group: "용돈", name: "원 용돈", method: "현금" },
      { group: "용돈", name: "수연이 용돈", method: "현금" },
      { group: "계좌이체", name: "원", method: "계좌이체" },
      { group: "계좌이체", name: "수연", method: "계좌이체" },
    ],
  },
  expenses: [
    ["2026-05-01", "외식", 16200, "카드(원)", "국민(원)", "맥도날드"],
    ["2026-05-01", "외식", 52000, "카드(원)", "국민(원)", "교촌치킨"],
    ["2026-05-01", "교통", 5340, "카드(원)", "국민(원)", "전기차 충전"],
    ["2026-05-02", "생활", 1226000, "카드(원)", "국민(원)", "한샘 소파"],
    ["2026-05-01", "생활", 31650, "카드(원)", "삼성(원)", "커튼 레일"],
    ["2026-05-02", "식재료", 17460, "카드(원)", "삼성(원)", "트레이더스"],
    ["2026-05-02", "식재료", 23880, "카드(원)", "삼성(원)", "노브랜드"],
    ["2026-05-02", "생활", 27320, "카드(원)", "삼성(원)", "이마트"],
    ["2026-05-03", "외식", 10500, "카드(원)", "삼성(원)", "카페"],
    ["2026-05-01", "생활", 23800, "카드(원)", "신한(원)", "이케아"],
    ["2026-05-01", "외식", 13400, "카드(원)", "신한(원)", "롯데몰 커피"],
    ["2026-05-01", "생활", 89900, "카드(원)", "신한(원)", "베란다 장"],
    ["2026-05-01", "생활", 1500, "카드(원)", "신한(원)", "반찬통"],
    ["2026-05-02", "외식", 32900, "카드(원)", "신한(원)", "고동경양 원그로브"],
    ["2026-05-03", "외식", 52785, "카드(원)", "신한(원)", "아웃백 중동점"],
    ["2026-05-03", "관계", 30130, "카드(원)", "신한(원)", "조말론 상품"],
    ["2026-05-03", "쇼핑(Flex)", 39900, "카드(원)", "신한(원)", "트러플 바질 페스토"],
    ["2026-05-01", "생활", 625000, "카드(원)", "현대(원)", "지누스 침대 프레임"],
    ["2026-05-01", "쇼핑(Flex)", 97300, "현금", "원 용돈", "톰보이 수연이 옷"],
    ["2026-05-04", "생활", 8250, "카드(원)", "국민(원)", "교통비"],
  ].map(([date, category, amount, method, payment, memo], index) => ({
    id: newId(`expense-${index}`),
    date,
    category,
    amount,
    method,
    payment,
    memo,
  })),
  incomes: [
    ["2026-05-01", 3408290, "급여(원)", ""],
    ["2026-05-03", 1000000, "기타(원)", "아버지 소파"],
    ["2026-05-04", 18000, "기타(원)", "예비군 일당"],
    ["2026-05-08", 2936860, "급여(수)", ""],
    ["2026-05-10", 1850000, "기타(원)", "피로연 축의금(원)"],
    ["2026-05-10", 1700000, "기타(수)", "피로연 축의금(수)"],
    ["2026-05-10", 1000000, "기타(원)", "수연이 드레스(부모님)"],
    ["2026-05-10", 400000, "기타(원)", "땡땡치고 남은 축의금"],
    ["2026-05-10", 320000, "기타(원)", "예은이 과외비"],
  ].map(([date, amount, type, memo], index) => ({
    id: newId(`income-${index}`),
    date,
    amount,
    type,
    memo,
  })),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

function on(selector, eventName, handler) {
  const element = $(selector);
  if (element) element.addEventListener(eventName, handler);
}

function showError(message) {
  const banner = $("#errorBanner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
}

let state = loadState();
let expenseViewMode = "all";
let expenseGroupFilter = null;
let expenseFilters = { category: "", method: "", payment: "" };
let editingExpenseId = null;
let editingIncomeId = null;
let filePersistenceReady = false;
let cloudClient = null;
let cloudUser = null;
let cloudSaveTimer = null;
let applyingCloudState = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return normalizeState(clone(sampleState));
  try {
    const parsed = JSON.parse(saved);
    return normalizeState({ ...clone(sampleState), ...parsed, settings: { ...clone(sampleState).settings, ...parsed.settings } });
  } catch {
    return normalizeState(clone(sampleState));
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function cloudConfigured() {
  const config = window.BUDGET_CONFIG || {};
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && window.supabase?.createClient);
}

function renderCloudStatus(message) {
  const field = $("#cloudStatus");
  if (!field) return;
  if (message) {
    field.textContent = message;
    return;
  }
  if (!cloudConfigured()) {
    field.textContent = "Supabase 설정 필요";
    return;
  }
  field.textContent = cloudUser ? `${cloudUser.email || "로그인됨"} 동기화 중` : "로그인 필요";
}

async function setupCloud() {
  renderCloudStatus();
  if (!cloudConfigured()) return;
  const config = window.BUDGET_CONFIG;
  cloudClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  const { data } = await cloudClient.auth.getSession();
  cloudUser = data.session?.user || null;
  renderCloudStatus();
  if (cloudUser) await loadCloudState();
  cloudClient.auth.onAuthStateChange(async (_event, session) => {
    cloudUser = session?.user || null;
    renderCloudStatus();
    if (cloudUser) await loadCloudState();
  });
}

async function loadCloudState() {
  if (!cloudClient || !cloudUser) return;
  renderCloudStatus("클라우드 불러오는 중");
  const { data, error } = await cloudClient
    .from("budget_states")
    .select("state")
    .eq("user_id", cloudUser.id)
    .maybeSingle();
  if (error) {
    renderCloudStatus("클라우드 불러오기 실패");
    return;
  }
  if (data?.state) {
    applyingCloudState = true;
    state = normalizeState(data.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyingCloudState = false;
    renderAll();
    renderCloudStatus("클라우드 불러옴");
    return;
  }
  await saveCloudState(true);
}

async function saveCloudState(immediate = false) {
  if (!cloudClient || !cloudUser || applyingCloudState) return;
  const write = async () => {
    const { error } = await cloudClient
      .from("budget_states")
      .upsert({
        user_id: cloudUser.id,
        state,
        updated_at: new Date().toISOString(),
      });
    renderCloudStatus(error ? "클라우드 저장 실패" : "클라우드 저장됨");
  };
  clearTimeout(cloudSaveTimer);
  if (immediate) {
    await write();
    return;
  }
  cloudSaveTimer = setTimeout(write, 500);
}

async function sendCloudLoginLink() {
  if (!cloudClient) {
    renderCloudStatus("Supabase 설정 필요");
    return;
  }
  const email = $("#cloudEmail").value.trim();
  if (!email) return;
  const { error } = await cloudClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  renderCloudStatus(error ? "로그인 링크 발송 실패" : "이메일 확인 필요");
}

async function signOutCloud() {
  if (!cloudClient) return;
  await cloudClient.auth.signOut();
  cloudUser = null;
  renderCloudStatus();
}

function normalizeState(source) {
  const next = clone(source);
  next.settings.cardTargets = { ...DEFAULT_CARD_TARGETS, ...(next.settings.cardTargets || {}) };
  if (next.settings.cardTargets["국제(수)"] !== undefined) {
    next.settings.cardTargets["국체(수)"] = next.settings.cardTargets["국제(수)"];
    delete next.settings.cardTargets["국제(수)"];
  }
  next.settings.cardTargets = Object.fromEntries(Object.entries(next.settings.cardTargets).map(([name, target]) => [name, normalizeCardTarget(target)]));
  next.settings.paymentItems = next.settings.paymentItems.map((item) => {
    if (item.name === "국제(수)") return { ...item, name: "국체(수)" };
    if (item.method === "카드" && (item.group === "카드(원)" || item.group === "카드(수)")) {
      return { ...item, method: item.group };
    }
    if (item.group === "용돈" && (item.name === "원 용돈" || item.name === "수연이 용돈")) {
      return { ...item, group: item.name };
    }
    return item;
  });
  next.expenses = next.expenses.map((row) => {
    const paymentName = row.payment === "국제(수)" ? "국체(수)" : row.payment;
    const item = next.settings.paymentItems.find((payment) => payment.name === paymentName);
    const method = row.method === "카드" && item?.method ? item.method : row.method;
    return { ...row, method, payment: paymentName };
  });
  return next;
}

function normalizeCardTarget(target) {
  if (typeof target === "number") return { primary: target, secondary: 0 };
  return {
    primary: Number(target?.primary || 0),
    secondary: Number(target?.secondary || 0),
  };
}

function saveState() {
  const previous = localStorage.getItem(STORAGE_KEY);
  const next = JSON.stringify(state);
  if (previous && previous !== next) localStorage.setItem(BACKUP_KEY, previous);
  localStorage.setItem(STORAGE_KEY, next);
  saveCloudState();
  if (filePersistenceReady) {
    fetch(API_STATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: next,
    }).catch(() => {
      filePersistenceReady = false;
    });
  }
}

async function syncFileState() {
  try {
    const response = await fetch(API_STATE_URL, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    filePersistenceReady = true;
    if (data.exists && data.state) {
      state = normalizeState(data.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      return;
    }
    saveState();
  } catch {
    filePersistenceReady = false;
  }
}

function currentMonth() {
  return $("#monthPicker").value;
}

function monthLabel(month) {
  const [year, monthNo] = month.split("-");
  return `${year}년 ${Number(monthNo)}월`;
}

function inMonth(row, month) {
  return row.date?.startsWith(month);
}

function beforeMonth(row, month) {
  return row.date?.slice(0, 7) < month;
}

function getPaymentItem(name) {
  return state.settings.paymentItems.find((item) => item.name === name);
}

function getPaymentItemByGroup(group) {
  return state.settings.paymentItems.find((item) => item.group === group);
}

function paymentItemsForMethod(method) {
  return state.settings.paymentItems.filter((item) => item.method === method);
}

function expensePaymentNames() {
  return [...new Set([
    ...state.settings.paymentItems.map((item) => item.name),
    ...state.expenses.map((row) => row.payment).filter(Boolean),
  ])];
}

function paymentGroup(row) {
  return getPaymentItem(row.payment)?.group || row.method || "";
}

function sum(rows) {
  return rows.reduce((total, row) => total + Number(row.amount || 0), 0);
}

function byKey(rows, keyFn) {
  return rows.reduce((map, row) => {
    const key = keyFn(row) || "기타";
    map[key] = (map[key] || 0) + Number(row.amount || 0);
    return map;
  }, {});
}

function cardTargetEntries(data = monthlyData()) {
  const cardNames = [...new Set([
    ...Object.keys(state.settings.cardTargets || {}),
    ...state.settings.paymentItems.filter((item) => item.method.startsWith("카드")).map((item) => item.name),
  ])];
  return cardNames
    .map((name) => {
      const target = normalizeCardTarget(state.settings.cardTargets?.[name]);
      const primary = target.primary;
      const secondary = target.secondary;
      const used = sum(data.expenses.filter((row) => row.payment === name));
      const activeTarget = used < primary || secondary <= primary ? primary : secondary;
      const phase = used < primary || secondary <= primary ? "1차" : "2차";
      const remaining = Math.max(activeTarget - used, 0);
      const rate = activeTarget ? Math.min(Math.round((used / activeTarget) * 100), 100) : 0;
      return { name, primary, secondary, used, remaining, rate, phase };
    })
    .filter((entry) => entry.primary > 0 || entry.secondary > 0);
}

function totalForPaymentLabel(data, label) {
  if (label === "원 계좌이체") return sum(data.expenses.filter((row) => row.method === "계좌이체" && row.payment === "원"));
  if (label === "수연 계좌이체") return sum(data.expenses.filter((row) => row.method === "계좌이체" && row.payment === "수연"));
  if (label === "원 용돈" || label === "수연이 용돈") return sum(data.expenses.filter((row) => row.payment === label));
  return data.groupTotals[label] || 0;
}

function monthlyData() {
  const month = currentMonth();
  const expenses = state.expenses.filter((row) => inMonth(row, month));
  const incomes = state.incomes.filter((row) => inMonth(row, month));
  const carryover = sum(state.incomes.filter((row) => beforeMonth(row, month))) - sum(state.expenses.filter((row) => beforeMonth(row, month)));
  const expenseTotal = sum(expenses);
  const incomeTotal = sum(incomes);
  const groupTotals = byKey(expenses, paymentGroup);
  const categoryTotals = byKey(expenses, (row) => row.category);
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || ["-", 0];
  return {
    month,
    expenses,
    incomes,
    carryover,
    expenseTotal,
    incomeTotal,
    balance: carryover + incomeTotal - expenseTotal,
    groupTotals,
    categoryTotals,
    topCategory,
    cardUsage: (groupTotals["카드(원)"] || 0) + (groupTotals["카드(수)"] || 0),
  };
}

function optionList(select, values, selected) {
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  if (selected) select.value = selected;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function categoryColor(category) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const index = Math.abs([...String(category)].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
}

function paymentColor(row) {
  if (PAYMENT_COLORS[row.payment]) return PAYMENT_COLORS[row.payment];
  return METHOD_FALLBACK_COLORS[row.method] || "#EEF3F7";
}

function renderSelectors() {
  const currentMethod = $("#expenseMethod").value;
  const selectedMethod = PAYMENT_METHODS.includes(currentMethod) ? currentMethod : "카드(원)";
  const selectedPayment = $("#expenseCard").value;
  optionList($("#expenseCategory"), state.settings.categories);
  optionList($("#expenseMethod"), PAYMENT_METHODS, selectedMethod);
  optionList($("#incomeType"), state.settings.incomeTypes);
  updatePaymentOptions(selectedPayment);
  renderExpenseFilters();
}

function filterOptionList(select, placeholder, values, selected) {
  select.innerHTML = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
  ].join("");
  select.value = values.includes(selected) ? selected : "";
}

function renderExpenseFilters() {
  const paymentNames = expenseFilters.method
    ? expensePaymentNames().filter((name) => {
      const item = getPaymentItem(name);
      return item ? item.method === expenseFilters.method : state.expenses.some((row) => row.payment === name && row.method === expenseFilters.method);
    })
    : expensePaymentNames();
  if (expenseFilters.payment && !paymentNames.includes(expenseFilters.payment)) expenseFilters.payment = "";
  filterOptionList($("#expenseFilterCategory"), "카테고리 전체", state.settings.categories, expenseFilters.category);
  filterOptionList($("#expenseFilterMethod"), "결제수단 전체", PAYMENT_METHODS, expenseFilters.method);
  filterOptionList($("#expenseFilterPayment"), "상세수단 전체", paymentNames, expenseFilters.payment);
}

function updatePaymentOptions(preferredPayment) {
  const method = $("#expenseMethod").value || "카드(원)";
  const items = paymentItemsForMethod(method);
  const selected = items.some((item) => item.name === preferredPayment) ? preferredPayment : items[0]?.name;
  optionList($("#expenseCard"), items.map((item) => item.name), selected);
  $("#expenseCard").disabled = items.length === 0;
  updateExpenseGroup();
}

function updateExpenseGroup() {
  const item = getPaymentItem($("#expenseCard").value);
  const field = $("#expenseGroup");
  if (field) field.value = item?.group || "";
}

function renderSummary() {
  const data = monthlyData();
  const targetEntries = cardTargetEntries(data);
  $("#dashboardMonth").textContent = monthLabel(data.month);
  $("#analysisMonth").textContent = monthLabel(data.month);
  $("#topCategoryLabel").textContent = `이번달 최다 지출: ${data.topCategory[0]}`;
  const nextTarget = targetEntries.find((entry) => entry.remaining > 0);
  const recommended = !targetEntries.length
    ? "목표 없음"
    : nextTarget
      ? `${nextTarget.name} ${nextTarget.phase} 채우기`
      : "아껴쓰세요~";

  const cards = [
    ["전월 이월", won.format(data.carryover), data.carryover < 0],
    ["이번달 수입", won.format(data.incomeTotal)],
    ["이번달 지출", won.format(data.expenseTotal)],
    ["현재 잔액", won.format(data.balance), data.balance < 0],
    ["추천 카드", recommended],
  ];

  $("#summaryCards").innerHTML = cards.map(([label, value, negative]) => `
    <article class="summary-card ${negative ? "negative" : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderMethodList() {
  const data = monthlyData();
  const order = ["카드(원)", "카드(수)", "원 계좌이체", "수연 계좌이체", "원 용돈", "수연이 용돈"];
  $("#methodList").innerHTML = order.map((group) => {
    const value = totalForPaymentLabel(data, group);
    const width = data.expenseTotal ? Math.round((value / data.expenseTotal) * 100) : 0;
    return `
      <div class="method-row">
        <strong>${group}</strong>
        <div class="bar"><span style="width:${width}%"></span></div>
        <span class="amount">${won.format(value)}</span>
      </div>
    `;
  }).join("");
}

function renderCardTargetMini() {
  const entries = cardTargetEntries();
  $("#cardTargetMini").innerHTML = entries.map(({ name, phase, rate }) => `
    <div class="target-mini-card">
      <span>${escapeHtml(name)}</span>
      <strong>${phase} ${rate}%</strong>
    </div>
  `).join("");
}

function renderChart() {
  const canvas = $("#categoryChart");
  const ctx = canvas.getContext("2d");
  const data = monthlyData();
  const entries = Object.entries(data.categoryTotals).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!entries.length) {
    ctx.fillStyle = "#687386";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("지출 없음", canvas.width / 2, canvas.height / 2);
    return;
  }

  const total = entries.reduce((acc, [, value]) => acc + value, 0);
  let angle = -Math.PI / 2;
  const cx = 150;
  const cy = 145;
  const outer = 98;
  const inner = 52;
  entries.forEach(([label, value]) => {
    const nextAngle = angle + (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, angle, nextAngle);
    ctx.arc(cx, cy, inner, nextAngle, angle, true);
    ctx.closePath();
    ctx.fillStyle = categoryColor(label);
    ctx.fill();
    angle = nextAngle;
  });

  ctx.fillStyle = "#202733";
  ctx.font = "700 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(won.format(total), cx, cy - 4);
  ctx.fillStyle = "#687386";
  ctx.font = "13px sans-serif";
  ctx.fillText("총지출", cx, cy + 18);

  ctx.textAlign = "left";
  entries.slice(0, 8).forEach(([label, value], index) => {
    const x = 290;
    const y = 54 + index * 26;
    ctx.fillStyle = categoryColor(label);
    ctx.fillRect(x, y - 10, 12, 12);
    ctx.fillStyle = "#202733";
    ctx.font = "13px sans-serif";
    ctx.fillText(`${label} ${Math.round((value / total) * 100)}%`, x + 20, y);
  });
}

function renderExpenses() {
  const rows = state.expenses
    .filter((row) => inMonth(row, currentMonth()))
    .filter((row) => !expenseFilters.category || row.category === expenseFilters.category)
    .filter((row) => !expenseFilters.method || row.method === expenseFilters.method)
    .filter((row) => !expenseFilters.payment || row.payment === expenseFilters.payment)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  $("#expenseRows").innerHTML = rows.length ? renderExpenseRows(rows) : `<tr><td class="empty" colspan="7">내역 없음</td></tr>`;
}

function renderExpenseRows(rows) {
  if (expenseViewMode === "all") return rows.map(renderExpenseRow).join("");
  const labels = {
    date: "날짜",
    category: "카테고리",
    method: "결제수단",
  };
  const grouped = rows.reduce((map, row) => {
    const key = expenseViewMode === "date" ? row.date : expenseViewMode === "category" ? row.category : row.method;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const entries = [...grouped.entries()];
  const visibleEntries = expenseGroupFilter ? entries.filter(([label]) => label === expenseGroupFilter) : entries;
  return visibleEntries.map(([label, groupRows]) => `
    <tr class="group-row">
      <td colspan="7">
        <button class="group-filter-button" data-group-filter="${escapeHtml(label)}" type="button">
          <strong>${escapeHtml(label)}</strong><span>${labels[expenseViewMode]} 합계 ${won.format(sum(groupRows))} · ${groupRows.length}건</span>
        </button>
        ${expenseGroupFilter ? `<button class="group-clear-button" data-clear-group-filter="true" type="button">전체 보기</button>` : ""}
      </td>
    </tr>
    ${groupRows.map(renderExpenseRow).join("")}
  `).join("");
}

function renderExpenseRow(row) {
  return `
    <tr>
      <td>${row.date}</td>
      <td>${escapeHtml(row.category)}</td>
      <td class="amount">${won.format(row.amount)}</td>
      <td>${escapeHtml(row.method)}</td>
      <td><span class="soft-badge payment-badge" style="background:${paymentColor(row)}">${escapeHtml(row.payment)}</span></td>
      <td>${escapeHtml(row.memo)}</td>
      <td>
        <div class="row-actions">
          <button class="edit-button" data-edit-expense="${row.id}" type="button">수정</button>
          <button class="delete-button" data-delete-expense="${row.id}" type="button">삭제</button>
        </div>
      </td>
    </tr>
  `;
}

function renderIncomes() {
  const rows = state.incomes
    .filter((row) => inMonth(row, currentMonth()))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  $("#incomeRows").innerHTML = rows.length ? rows.map((row) => `
    <tr>
      <td>${row.date}</td>
      <td class="amount">${won.format(row.amount)}</td>
      <td>${escapeHtml(row.type)}</td>
      <td>${escapeHtml(row.memo)}</td>
      <td>
        <div class="row-actions">
          <button class="edit-button" data-edit-income="${row.id}" type="button">수정</button>
          <button class="delete-button" data-delete-income="${row.id}" type="button">삭제</button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td class="empty" colspan="5">내역 없음</td></tr>`;
}

function renderAnalysis() {
  const data = monthlyData();
  const groupOrder = ["카드(원)", "카드(수)", "원 계좌이체", "수연 계좌이체", "원 용돈", "수연이 용돈"];
  $("#analysisStrip").innerHTML = [
    ...groupOrder.map((group) => [group, won.format(totalForPaymentLabel(data, group))]),
    ["총지출", won.format(data.expenseTotal)],
    ["전월 이월", won.format(data.carryover)],
    ["현재 잔액", won.format(data.balance)],
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");

  const categoryEntries = state.settings.categories.map((category) => [category, data.categoryTotals[category] || 0]);
  $("#categoryCount").textContent = `${categoryEntries.filter(([, value]) => value > 0).length}개 사용`;
  $("#categoryRows").innerHTML = categoryEntries.map(([category, value]) => `
    <tr>
      <td><span class="category-dot" style="background:${categoryColor(category)}"></span>${escapeHtml(category)}</td>
      <td class="amount">${won.format(value)}</td>
      <td class="amount">${data.expenseTotal ? `${((value / data.expenseTotal) * 100).toFixed(1)}%` : "0.0%"}</td>
    </tr>
  `).join("");

  $("#groupRows").innerHTML = groupOrder.map((group) => `
    <tr>
      <td>${group}</td>
      <td class="amount">${won.format(totalForPaymentLabel(data, group))}</td>
    </tr>
  `).join("");
}

function renderSettings() {
  $("#categoryChips").innerHTML = state.settings.categories.map((category) => `
    <span class="chip" style="background:${categoryColor(category)}">${escapeHtml(category)}<button data-remove-category="${escapeHtml(category)}" type="button">×</button></span>
  `).join("");
  $("#incomeTypeChips").innerHTML = state.settings.incomeTypes.map((type) => `
    <span class="chip">${escapeHtml(type)}<button data-remove-income-type="${escapeHtml(type)}" type="button">×</button></span>
  `).join("");
  $("#paymentSettingRows").innerHTML = state.settings.paymentItems.map((item) => `
    <tr>
      <td>${escapeHtml(item.method)}</td>
      <td>${escapeHtml(item.group)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td><button class="delete-button" data-remove-payment="${escapeHtml(item.name)}" type="button">×</button></td>
    </tr>
  `).join("");
  $("#cardTargetRows").innerHTML = state.settings.paymentItems
    .filter((item) => item.method.startsWith("카드"))
    .map((item) => {
      const target = normalizeCardTarget(state.settings.cardTargets?.[item.name]);
      return `
      <tr>
        <td><span class="soft-badge payment-badge" style="background:${paymentColor({ method: item.method, payment: item.name })}">${escapeHtml(item.name)}</span></td>
        <td>
          <input class="target-input" data-card-target="${escapeHtml(item.name)}" data-target-level="primary" type="number" min="0" step="1" value="${target.primary}" />
        </td>
        <td>
          <input class="target-input" data-card-target="${escapeHtml(item.name)}" data-target-level="secondary" type="number" min="0" step="1" value="${target.secondary}" />
        </td>
      </tr>
    `;
    }).join("");
}

function renderAll() {
  renderSelectors();
  renderSummary();
  renderCardTargetMini();
  renderMethodList();
  renderChart();
  renderExpenses();
  renderIncomes();
  renderAnalysis();
  renderSettings();
}

function setExpenseEditMode(active) {
  $("#addExpense").textContent = active ? "저장" : "추가";
  $("#cancelExpenseEdit").classList.toggle("hidden", !active);
}

function setIncomeEditMode(active) {
  $("#addIncome").textContent = active ? "저장" : "추가";
  $("#cancelIncomeEdit").classList.toggle("hidden", !active);
}

function resetExpenseForm() {
  editingExpenseId = null;
  $("#expenseForm").reset();
  $("#expenseDate").value = `${currentMonth()}-01`;
  updatePaymentOptions();
  setExpenseEditMode(false);
}

function resetIncomeForm() {
  editingIncomeId = null;
  $("#incomeForm").reset();
  $("#incomeDate").value = `${currentMonth()}-01`;
  setIncomeEditMode(false);
}

function startExpenseEdit(id) {
  const row = state.expenses.find((item) => item.id === id);
  if (!row) return;
  editingExpenseId = id;
  $("#expenseDate").value = row.date;
  $("#expenseCategory").value = row.category;
  $("#expenseAmount").value = row.amount;
  $("#expenseMethod").value = row.method;
  updatePaymentOptions(row.payment);
  $("#expenseCard").value = row.payment;
  $("#expenseMemo").value = row.memo || "";
  setExpenseEditMode(true);
  $(".nav-tab[data-view='expenses']").click();
  $("#expenseAmount").focus();
}

function startIncomeEdit(id) {
  const row = state.incomes.find((item) => item.id === id);
  if (!row) return;
  editingIncomeId = id;
  $("#incomeDate").value = row.date;
  $("#incomeAmount").value = row.amount;
  $("#incomeType").value = row.type;
  $("#incomeMemo").value = row.memo || "";
  setIncomeEditMode(true);
  $(".nav-tab[data-view='income']").click();
  $("#incomeAmount").focus();
}

function addExpense() {
  const payment = $("#expenseCard").value;
  const paymentItem = getPaymentItem(payment);
  const nextRow = {
    id: editingExpenseId || newId("expense"),
    date: $("#expenseDate").value,
    category: $("#expenseCategory").value,
    amount: Number($("#expenseAmount").value),
    method: $("#expenseMethod").value || paymentItem?.method || "카드(원)",
    payment,
    memo: $("#expenseMemo").value.trim(),
  };
  if (editingExpenseId) {
    state.expenses = state.expenses.map((row) => row.id === editingExpenseId ? nextRow : row);
  } else {
    state.expenses.push(nextRow);
  }
  saveState();
  resetExpenseForm();
  renderAll();
}

function addIncome() {
  const nextRow = {
    id: editingIncomeId || newId("income"),
    date: $("#incomeDate").value,
    amount: Number($("#incomeAmount").value),
    type: $("#incomeType").value,
    memo: $("#incomeMemo").value.trim(),
  };
  if (editingIncomeId) {
    state.incomes = state.incomes.map((row) => row.id === editingIncomeId ? nextRow : row);
  } else {
    state.incomes.push(nextRow);
  }
  saveState();
  resetIncomeForm();
  renderAll();
}

function addUnique(list, value) {
  const clean = value.trim();
  if (clean && !list.includes(clean)) list.push(clean);
}

function parseMoney(value) {
  const clean = String(value ?? "").replace(/[₩,\s]/g, "");
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dotted = text.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (dotted) return `${dotted[1]}-${dotted[2].padStart(2, "0")}-${dotted[3].padStart(2, "0")}`;
  const slashed = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashed) return `${slashed[1]}-${slashed[2].padStart(2, "0")}-${slashed[3].padStart(2, "0")}`;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return "";
}

function parsePastedTable(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const delimiter = rows[0].includes("\t") ? "\t" : ",";
  return rows.map((row) => splitRow(row, delimiter));
}

function splitRow(row, delimiter) {
  if (delimiter === "\t") return row.split("\t").map((cell) => cell.trim());
  const cells = [];
  let cell = "";
  let inQuote = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"' && row[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuote = !inQuote;
    } else if (char === "," && !inQuote) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function rowsToObjects(table) {
  const headers = table[0].map((header) => header.replace(/\s/g, ""));
  return table.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function importSheetData() {
  const table = parsePastedTable($("#sheetPasteArea").value);
  if (table.length < 2) return;
  const rows = rowsToObjects(table);
  const target = $("#importTarget").value;
  if (target === "expenses") {
    const imported = rows.map((row) => {
      const payment = row["상세수단"] || row["카드사"] || row["결제수단상세"] || row["상세결제수단"] || row["카드"] || "";
      const item = getPaymentItem(payment) || getPaymentItemByGroup(row["카드그룹"]);
      const method = item?.method || row["결제수단"] || "카드(원)";
      return {
        id: newId("expense-import"),
        date: parseDate(row["날짜"]),
        category: row["카테고리"] || "기타",
        amount: parseMoney(row["금액"]),
        method,
        payment: payment || item?.name || "",
        memo: row["메모"] || "",
      };
    }).filter((row) => row.date && row.amount > 0);
    state.expenses.push(...imported);
  } else {
    const imported = rows.map((row) => ({
      id: newId("income-import"),
      date: parseDate(row["날짜"]),
      amount: parseMoney(row["금액"]),
      type: row["수입항목"] || row["항목"] || "기타(원)",
      memo: row["메모"] || "",
    })).filter((row) => row.date && row.amount > 0);
    state.incomes.push(...imported);
  }
  $("#sheetPasteArea").value = "";
  saveState();
  renderAll();
}

function setDefaultDates() {
  const month = currentMonth();
  $("#expenseDate").value = `${month}-01`;
  $("#incomeDate").value = `${month}-01`;
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `가계부-${currentMonth()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function restoreBackup() {
  const backup = localStorage.getItem(BACKUP_KEY);
  if (!backup) {
    alert("복구할 백업이 아직 없어요.");
    return;
  }
  if (!confirm("이전 저장 상태로 되돌릴까요? 지금 화면의 내용은 백업으로 밀려나요.")) return;
  localStorage.setItem(BACKUP_KEY, localStorage.getItem(STORAGE_KEY) || "");
  state = normalizeState(JSON.parse(backup));
  saveState();
  boot();
}

function boot() {
  const today = new Date();
  const defaultMonth = state.expenses[0]?.date?.slice(0, 7) || today.toISOString().slice(0, 7);
  $("#todayLabel").textContent = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  $("#monthPicker").value = defaultMonth;
  setDefaultDates();
  renderAll();
  syncFileState();
  setupCloud();
}

$$(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".nav-tab").forEach((button) => button.classList.toggle("active", button === tab));
    $$(".view").forEach((view) => view.classList.remove("active"));
    $(`#${tab.dataset.view}View`).classList.add("active");
    renderChart();
  });
});

$$(".switch-button").forEach((button) => {
  button.addEventListener("click", () => {
    expenseViewMode = button.dataset.expenseView;
    expenseGroupFilter = null;
    $$(".switch-button").forEach((item) => item.classList.toggle("active", item === button));
    renderExpenses();
  });
});

$$(".settings-tab").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.settingsTab;
    $$(".settings-tab").forEach((item) => item.classList.toggle("active", item === button));
    $$(".settings-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.settingsPanel === tab));
  });
});

on("#monthPicker", "change", () => {
  setDefaultDates();
  renderAll();
});
on("#expenseFilterCategory", "change", (event) => {
  expenseFilters.category = event.target.value;
  expenseGroupFilter = null;
  renderExpenses();
});
on("#expenseFilterMethod", "change", (event) => {
  expenseFilters.method = event.target.value;
  expenseGroupFilter = null;
  renderExpenseFilters();
  renderExpenses();
});
on("#expenseFilterPayment", "change", (event) => {
  expenseFilters.payment = event.target.value;
  expenseGroupFilter = null;
  renderExpenses();
});
on("#clearExpenseFilters", "click", () => {
  expenseFilters = { category: "", method: "", payment: "" };
  expenseGroupFilter = null;
  renderExpenseFilters();
  renderExpenses();
});
on("#addExpense", "click", () => $("#expenseForm").requestSubmit());
on("#addIncome", "click", () => $("#incomeForm").requestSubmit());
on("#cancelExpenseEdit", "click", () => {
  resetExpenseForm();
  renderSelectors();
});
on("#cancelIncomeEdit", "click", () => {
  resetIncomeForm();
  renderSelectors();
});
on("#clearExpenses", "click", () => {
  if (!confirm("현재 조회월의 지출 내역을 모두 삭제할까요?")) return;
  const month = currentMonth();
  state.expenses = state.expenses.filter((row) => !inMonth(row, month));
  resetExpenseForm();
  saveState();
  renderAll();
});
on("#clearIncomes", "click", () => {
  if (!confirm("현재 조회월의 수입 내역을 모두 삭제할까요?")) return;
  const month = currentMonth();
  state.incomes = state.incomes.filter((row) => !inMonth(row, month));
  resetIncomeForm();
  saveState();
  renderAll();
});
on("#expenseForm", "submit", (event) => {
  event.preventDefault();
  addExpense();
});
on("#incomeForm", "submit", (event) => {
  event.preventDefault();
  addIncome();
});
on("#exportJson", "click", downloadJson);
on("#importJson", "change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imported = normalizeState(JSON.parse(await file.text()));
  state = imported;
  const firstDate = state.expenses[0]?.date || state.incomes[0]?.date;
  if (firstDate) $("#monthPicker").value = firstDate.slice(0, 7);
  setDefaultDates();
  saveState();
  renderAll();
  alert("가져오기 완료. 해당 월로 이동했어요.");
  event.target.value = "";
});
on("#resetSample", "click", () => {
  if (!confirm("샘플 데이터로 되돌릴까요? 현재 저장 내용은 백업으로 남겨둘게요.")) return;
  state = clone(sampleState);
  saveState();
  boot();
});
on("#restoreBackup", "click", restoreBackup);
on("#sendLoginLink", "click", sendCloudLoginLink);
on("#signOutCloud", "click", signOutCloud);
on("#syncCloudNow", "click", async () => {
  if (!cloudUser) {
    renderCloudStatus("로그인 필요");
    return;
  }
  await saveCloudState(true);
});
on("#addCategory", "click", () => {
  addUnique(state.settings.categories, $("#newCategory").value);
  $("#newCategory").value = "";
  saveState();
  renderAll();
});
on("#addIncomeType", "click", () => {
  addUnique(state.settings.incomeTypes, $("#newIncomeType").value);
  $("#newIncomeType").value = "";
  saveState();
  renderAll();
});
on("#addPaymentItem", "click", () => {
  const method = $("#newPaymentMethod").value;
  const group = $("#newPaymentGroup").value.trim();
  const name = $("#newPaymentName").value.trim();
  if (!group || !name || state.settings.paymentItems.some((item) => item.name === name)) return;
  state.settings.paymentItems.push({ method, group, name });
  if (method.startsWith("카드") && state.settings.cardTargets[name] === undefined) state.settings.cardTargets[name] = { primary: 0, secondary: 0 };
  $("#newPaymentGroup").value = "";
  $("#newPaymentName").value = "";
  saveState();
  renderAll();
});
on("#importSheetData", "click", importSheetData);
document.addEventListener("click", (event) => {
  const groupFilter = event.target.closest("[data-group-filter]")?.dataset.groupFilter;
  const clearGroupFilter = event.target.closest("[data-clear-group-filter]");
  if (groupFilter) {
    expenseGroupFilter = groupFilter;
    renderExpenses();
    return;
  }
  if (clearGroupFilter) {
    expenseGroupFilter = null;
    renderExpenses();
    return;
  }
  const editExpenseId = event.target.closest("[data-edit-expense]")?.dataset.editExpense;
  const editIncomeId = event.target.closest("[data-edit-income]")?.dataset.editIncome;
  const expenseId = event.target.closest("[data-delete-expense]")?.dataset.deleteExpense;
  const incomeId = event.target.closest("[data-delete-income]")?.dataset.deleteIncome;
  const category = event.target.closest("[data-remove-category]")?.dataset.removeCategory;
  const incomeType = event.target.closest("[data-remove-income-type]")?.dataset.removeIncomeType;
  const paymentName = event.target.closest("[data-remove-payment]")?.dataset.removePayment;
  if (editExpenseId) {
    startExpenseEdit(editExpenseId);
    return;
  }
  if (editIncomeId) {
    startIncomeEdit(editIncomeId);
    return;
  }
  if (expenseId) state.expenses = state.expenses.filter((row) => row.id !== expenseId);
  if (incomeId) state.incomes = state.incomes.filter((row) => row.id !== incomeId);
  if (category) state.settings.categories = state.settings.categories.filter((item) => item !== category);
  if (incomeType) state.settings.incomeTypes = state.settings.incomeTypes.filter((item) => item !== incomeType);
  if (paymentName) {
    state.settings.paymentItems = state.settings.paymentItems.filter((item) => item.name !== paymentName);
    delete state.settings.cardTargets[paymentName];
  }
  if (expenseId || incomeId || category || incomeType || paymentName) {
    if (expenseId === editingExpenseId) resetExpenseForm();
    if (incomeId === editingIncomeId) resetIncomeForm();
    saveState();
    renderAll();
  }
});
document.addEventListener("change", (event) => {
  const cardName = event.target.closest("[data-card-target]")?.dataset.cardTarget;
  if (!cardName) return;
  const level = event.target.closest("[data-card-target]")?.dataset.targetLevel || "primary";
  const target = normalizeCardTarget(state.settings.cardTargets[cardName]);
  target[level] = Number(event.target.value || 0);
  state.settings.cardTargets[cardName] = target;
  saveState();
  renderSummary();
  renderCardTargetMini();
  renderMethodList();
});
on("#expenseMethod", "change", () => {
  updatePaymentOptions();
});
on("#expenseCard", "change", () => {
  const item = getPaymentItem($("#expenseCard").value);
  if (item) $("#expenseMethod").value = item.method;
  updateExpenseGroup();
});

try {
  boot();
  registerServiceWorker();
} catch (error) {
  showError(`앱 실행 오류: ${error.message}`);
}

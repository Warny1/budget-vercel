const STORAGE_KEY = "household-budget-app-v1";
const BACKUP_KEY = `${STORAGE_KEY}-backup`;
const SHARED_SESSION_KEY = `${STORAGE_KEY}-shared-session`;
const API_STATE_URL = "./api/state";
const SUPABASE_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const SHARED_STATE_TABLE = "shared_budget_states";
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
  expenses: [],
  incomes: [],
  events: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const lunarFormatter = new Intl.DateTimeFormat("ko-KR-u-ca-chinese", { month: "numeric", day: "numeric" });
const lunarDateCache = new Map();

function on(selector, eventName, handler) {
  const element = $(selector);
  if (element) element.addEventListener(eventName, handler);
}

function closestTarget(event, selector) {
  return event.target instanceof Element ? event.target.closest(selector) : null;
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
let editingEventId = null;
let dashboardOverviewOpen = false;
let filePersistenceReady = false;
let cloudClient = null;
let sharedSession = loadSharedSession();
let cloudSaveTimer = null;
let applyingCloudState = false;
let cloudSetupPromise = null;
let supabaseLoadPromise = null;

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

function loadSharedSession() {
  const saved = localStorage.getItem(SHARED_SESSION_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (!parsed.householdId || !parsed.lookupKey || !parsed.secret) return null;
    return parsed;
  } catch {
    return null;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}

function cloudKeysConfigured() {
  const config = window.BUDGET_CONFIG || {};
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
}

function cloudConfigured() {
  return Boolean(cloudKeysConfigured() && window.supabase?.createClient);
}

function supabaseProjectUrl() {
  const config = window.BUDGET_CONFIG || {};
  return String(config.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function bytesToBase64(bytes) {
  const array = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < array.length; index += 0x8000) {
    binary += String.fromCharCode(...array.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

async function sha256Hex(value) {
  const hash = await crypto.subtle.digest("SHA-256", textBytes(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deriveSharedSession(householdId, password) {
  const cleanId = householdId.trim().toLowerCase();
  const cleanPassword = password.trim();
  if (!cleanId || !cleanPassword) throw new Error("아이디와 비밀번호를 입력해 주세요.");
  const secret = await sha256Hex(`원수살림:${cleanId}:${cleanPassword}`);
  return {
    householdId: cleanId,
    lookupKey: await sha256Hex(`원수살림-찾기:${cleanId}:${secret}`),
    secret,
  };
}

async function sharedCryptoKey(session = sharedSession) {
  const baseKey = await crypto.subtle.importKey("raw", textBytes(session.secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: textBytes("원수살림-v1"), info: textBytes(`state:${session.householdId}`) },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSharedState(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sharedCryptoKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textBytes(JSON.stringify(data)));
  return { version: 1, iv: bytesToBase64(iv), data: bytesToBase64(encrypted) };
}

async function decryptSharedState(payload) {
  if (!payload?.iv || !payload?.data) throw new Error("공유 데이터를 읽을 수 없어요.");
  const key = await sharedCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.data));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function loadSupabaseClient() {
  if (window.supabase?.createClient) return Promise.resolve();
  if (supabaseLoadPromise) return supabaseLoadPromise;
  supabaseLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SUPABASE_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Supabase 파일을 불러오지 못했어요.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SUPABASE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Supabase 파일을 불러오지 못했어요."));
    document.head.appendChild(script);
  });
  return supabaseLoadPromise;
}

function renderCloudStatus(message) {
  const field = $("#cloudStatus");
  if (!field) return;
  if (message) {
    field.textContent = message;
    return;
  }
  if (!cloudKeysConfigured()) {
    field.textContent = "공유 저장소 설정 필요";
    return;
  }
  if (!cloudConfigured()) {
    field.textContent = "공유 저장소 연결 대기";
    return;
  }
  field.textContent = sharedSession ? `${sharedSession.householdId} 연결됨` : "공유 로그인 필요";
}

function cloudErrorMessage(error, fallback) {
  const message = error?.message || "";
  if (message.includes("relation") || message.includes("does not exist")) return "공유 테이블 생성 필요";
  if (message.includes("permission") || message.includes("policy") || message.includes("RLS")) return "공유 테이블 권한 확인 필요";
  return fallback;
}

async function setupCloud() {
  if (cloudClient) return;
  if (cloudSetupPromise) return cloudSetupPromise;
  cloudSetupPromise = setupCloudConnection().finally(() => {
    cloudSetupPromise = null;
  });
  return cloudSetupPromise;
}

async function setupCloudConnection() {
  renderCloudStatus();
  if (!cloudKeysConfigured()) return;
  try {
    await loadSupabaseClient();
  } catch (error) {
    renderCloudStatus(error.message);
    return;
  }
  const config = window.BUDGET_CONFIG;
  cloudClient = window.supabase.createClient(supabaseProjectUrl(), config.SUPABASE_ANON_KEY);
  renderCloudStatus();
  if (sharedSession) await loadCloudState();
}

async function loadCloudState() {
  if (!cloudClient || !sharedSession) return;
  renderCloudStatus("공유 가계부 불러오는 중");
  const { data, error } = await cloudClient
    .from(SHARED_STATE_TABLE)
    .select("payload")
    .eq("household_key", sharedSession.lookupKey)
    .maybeSingle();
  if (error) {
    renderCloudStatus(cloudErrorMessage(error, "공유 가계부 불러오기 실패"));
    return;
  }
  if (data?.payload) {
    try {
      const cloudState = await decryptSharedState(data.payload);
      applyingCloudState = true;
      state = normalizeState(cloudState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyingCloudState = false;
      renderAll();
      renderCloudStatus("공유 가계부 불러옴");
      return;
    } catch {
      renderCloudStatus("아이디 또는 비밀번호 확인 필요");
      return;
    }
  }
  await saveCloudState(true);
}

async function saveCloudState(immediate = false) {
  if (!cloudClient || !sharedSession || applyingCloudState) return;
  const write = async () => {
    const payload = await encryptSharedState(state);
    const { error } = await cloudClient
      .from(SHARED_STATE_TABLE)
      .upsert({
        household_key: sharedSession.lookupKey,
        household_name: sharedSession.householdId,
        payload,
        updated_at: new Date().toISOString(),
      });
    renderCloudStatus(error ? cloudErrorMessage(error, "공유 저장 실패") : "공유 저장됨");
  };
  clearTimeout(cloudSaveTimer);
  if (immediate) {
    await write();
    return;
  }
  cloudSaveTimer = setTimeout(() => {
    write().catch(() => renderCloudStatus("공유 저장 실패"));
  }, 500);
}

async function connectSharedBudget() {
  if (!cloudClient) await setupCloud();
  if (!cloudClient) {
    renderCloudStatus("공유 저장소 설정 필요");
    return;
  }
  try {
    sharedSession = await deriveSharedSession($("#sharedBudgetId").value, $("#sharedBudgetPassword").value);
    localStorage.setItem(SHARED_SESSION_KEY, JSON.stringify(sharedSession));
    $("#sharedBudgetPassword").value = "";
    renderCloudStatus("공유 가계부 연결 중");
    await loadCloudState();
  } catch (error) {
    renderCloudStatus(error.message);
  }
}

async function signOutCloud() {
  sharedSession = null;
  localStorage.removeItem(SHARED_SESSION_KEY);
  state = clone(sampleState);
  saveState();
  renderAll();
  renderCloudStatus("연결 해제됨");
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
  next.events = (next.events || []).map(normalizeEvent).filter((event) => event.title);
  return next;
}

function normalizeEvent(event) {
  const calendar = event.calendar === "lunar" ? "lunar" : "solar";
  const repeat = ["once", "yearly", "monthly"].includes(event.repeat) ? event.repeat : "once";
  const date = event.date || "";
  const month = Number(event.month || date.slice(5, 7) || 0);
  const day = Number(event.day || date.slice(8, 10) || 0);
  const year = Number(event.year || date.slice(0, 4) || 0);
  return {
    id: event.id || newId("event"),
    title: String(event.title || "").trim(),
    calendar,
    repeat,
    date,
    year,
    month,
    day,
    memo: String(event.memo || "").trim(),
  };
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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date) {
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function todayKey() {
  return toDateKey(new Date());
}

function currentMonthKey() {
  return todayKey().slice(0, 7);
}

function defaultDateForMonth(month = currentMonth()) {
  const today = todayKey();
  return today.startsWith(month) ? today : `${month}-01`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
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

function lunarParts(date) {
  const parts = lunarFormatter.formatToParts(date);
  const month = Number((parts.find((part) => part.type === "month")?.value || "").replace(/\D/g, ""));
  const day = Number((parts.find((part) => part.type === "day")?.value || "").replace(/\D/g, ""));
  return { month, day };
}

function solarDateForLunar(year, lunarMonth, lunarDay) {
  const key = `${year}-${lunarMonth}-${lunarDay}`;
  if (lunarDateCache.has(key)) return lunarDateCache.get(key);
  let found = "";
  for (let date = new Date(year, 0, 1); date.getFullYear() === year; date = addDays(date, 1)) {
    const lunar = lunarParts(date);
    if (lunar.month === lunarMonth && lunar.day === lunarDay) {
      found = toDateKey(date);
      break;
    }
  }
  lunarDateCache.set(key, found);
  return found;
}

function eventDateLabel(event) {
  const prefix = event.calendar === "lunar" ? "음력 " : "";
  if (event.repeat === "monthly") return `${prefix}매달 ${event.day}일`;
  if (event.repeat === "yearly") return `${prefix}매년 ${event.month}월 ${event.day}일`;
  if (event.calendar === "lunar") return `음력 ${event.year}년 ${event.month}월 ${event.day}일`;
  return event.date;
}

function repeatLabel(event) {
  const labels = { once: "일회성", yearly: "매년", monthly: "매달" };
  return `${event.calendar === "lunar" ? "음력 · " : "양력 · "}${labels[event.repeat]}`;
}

function shortDateLabel(value) {
  const today = new Date();
  const year = Number(value.slice(0, 4));
  const monthDay = value.slice(5).replace("-", "/");
  return year === today.getFullYear() ? monthDay : `${year} ${monthDay}`;
}

function eventOccurrenceDate(event, year, month) {
  if (event.repeat === "once") {
    if (event.calendar === "lunar") {
      const solar = solarDateForLunar(event.year || year, event.month, event.day);
      return solar?.startsWith(`${year}-${pad2(month)}`) ? solar : "";
    }
    return event.date?.startsWith(`${year}-${pad2(month)}`) ? event.date : "";
  }
  if (event.repeat === "yearly") {
    const solar = event.calendar === "lunar"
      ? solarDateForLunar(year, event.month, event.day)
      : event.day <= daysInMonth(year, event.month) ? dateKey(year, event.month, event.day) : "";
    return solar?.startsWith(`${year}-${pad2(month)}`) ? solar : "";
  }
  if (event.calendar === "lunar") {
    for (let day = 1; day <= daysInMonth(year, month); day += 1) {
      const solar = dateKey(year, month, day);
      const lunar = lunarParts(parseDateKey(solar));
      if (lunar.day === event.day) return solar;
    }
    return "";
  }
  return event.day <= daysInMonth(year, month) ? dateKey(year, month, event.day) : "";
}

function eventOccurrencesForMonth(monthValue = currentMonth()) {
  const [year, month] = monthValue.split("-").map(Number);
  return state.events
    .map((event) => ({ event, date: eventOccurrenceDate(event, year, month) }))
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function upcomingEvents(limit = 5) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const monthKeys = [];
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
    monthKeys.push(dateKey(date.getFullYear(), date.getMonth() + 1, 1).slice(0, 7));
  }
  return monthKeys
    .flatMap((month) => eventOccurrencesForMonth(month))
    .filter((item) => item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
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

function dashboardInsight(data, targetEntries) {
  const topCategory = data.topCategory[0] === "-" ? "지출" : data.topCategory[0];
  const topRatio = data.expenseTotal && data.topCategory[1] ? Math.round((data.topCategory[1] / data.expenseTotal) * 100) : 0;
  const nextTarget = targetEntries.find((entry) => entry.remaining > 0);
  if (!data.expenseTotal) return "아직 조용한 달이에요. 첫 지출을 남겨볼까요?";
  if (data.balance < 0) return `${topCategory} 지출이 ${topRatio}%예요. 이번 달은 조금 숨 고르기 모드.`;
  if (nextTarget) return `${topCategory} 지출이 제일 크고, ${nextTarget.name}은 ${nextTarget.phase} ${nextTarget.rate}%까지 왔어요.`;
  return `${topCategory} 지출이 제일 큰 달이에요. 카드 실적은 다 채웠으니 아껴쓰세요~`;
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
  $("#monthlyInsight").textContent = dashboardInsight(data, targetEntries);
  $("#heroBalance").textContent = won.format(data.balance);
  $("#heroBalance").classList.toggle("negative", data.balance < 0);
  const nextTarget = targetEntries.find((entry) => entry.remaining > 0);
  const recommended = !targetEntries.length
    ? "목표 없음"
    : nextTarget
      ? `${nextTarget.name} ${nextTarget.phase} 채우기`
      : "아껴쓰세요~";

  const cards = [
    ["전월 이월", won.format(data.carryover), data.carryover < 0, "analysis"],
    ["이번달 수입", won.format(data.incomeTotal), false, "income"],
    ["이번달 지출", won.format(data.expenseTotal), false, "expenses"],
    ["현재 잔액", won.format(data.balance), data.balance < 0, "analysis"],
    ["추천 카드", recommended, false, "recommended", nextTarget?.name || ""],
  ];

  $("#summaryCards").innerHTML = cards.map(([label, value, negative, action, valueKey], index) => `
    <button class="summary-card summary-card-${index + 1} ${negative ? "negative" : ""}" data-dashboard-action="${action}" data-dashboard-value="${escapeHtml(valueKey || "")}" type="button">
      <span>${label}</span>
      <strong>${value}</strong>
    </button>
  `).join("");
  renderDashboardDrilldown(data, targetEntries);
}

function renderDashboardDrilldown(data = monthlyData(), targetEntries = cardTargetEntries(data)) {
  const panel = $("#dashboardDrilldown");
  if (!panel) return;
  panel.classList.toggle("hidden", !dashboardOverviewOpen);
  if (!dashboardOverviewOpen) {
    panel.innerHTML = "";
    return;
  }
  const upcoming = upcomingEvents(2);
  const nextTarget = targetEntries.find((entry) => entry.remaining > 0);
  const topCategory = data.topCategory[0] === "-" ? "아직 없음" : data.topCategory[0];
  const monthFlow = data.incomeTotal - data.expenseTotal;
  panel.innerHTML = `
    <div class="drilldown-card">
      <span>이번 달 흐름</span>
      <strong class="${monthFlow < 0 ? "negative" : "positive"}">${monthFlow >= 0 ? "+" : ""}${won.format(monthFlow)}</strong>
    </div>
    <button class="drilldown-card" data-dashboard-action="category" data-dashboard-value="${escapeHtml(data.topCategory[0] === "-" ? "" : data.topCategory[0])}" type="button">
      <span>최다 지출</span>
      <strong>${escapeHtml(topCategory)}</strong>
    </button>
    <button class="drilldown-card" data-dashboard-action="recommended" data-dashboard-value="${escapeHtml(nextTarget?.name || "")}" type="button">
      <span>다음 카드</span>
      <strong>${nextTarget ? `${escapeHtml(nextTarget.name)} ${nextTarget.phase} ${nextTarget.rate}%` : "아껴쓰세요~"}</strong>
    </button>
    <button class="drilldown-card" data-dashboard-action="calendar" type="button">
      <span>다가오는 일정</span>
      <strong class="upcoming-lines">${upcoming.length ? upcoming.map(({ event, date }) => `<em>${shortDateLabel(date)} ${escapeHtml(event.title)}</em>`).join("") : "<em>등록된 일정 없음</em>"}</strong>
    </button>
  `;
}

function renderMethodList() {
  const data = monthlyData();
  const order = ["카드(원)", "카드(수)", "원 계좌이체", "수연 계좌이체", "원 용돈", "수연이 용돈"];
  $("#methodList").innerHTML = order.map((group) => {
    const value = totalForPaymentLabel(data, group);
    const width = data.expenseTotal ? Math.round((value / data.expenseTotal) * 100) : 0;
    return `
      <button class="method-row" data-dashboard-action="method" data-dashboard-value="${escapeHtml(group)}" type="button">
        <strong>${group}</strong>
        <div class="bar"><span style="width:${width}%"></span></div>
        <span class="amount">${won.format(value)}</span>
      </button>
    `;
  }).join("");
}

function renderCardTargetMini() {
  const entries = cardTargetEntries();
  $("#cardTargetMini").innerHTML = entries.map(({ name, phase, rate }) => `
    <button class="target-mini-card" data-dashboard-action="payment" data-dashboard-value="${escapeHtml(name)}" type="button">
      <div>
        <span>${escapeHtml(name)}</span>
        <strong>${phase} ${rate}%</strong>
      </div>
      <div class="mini-progress" aria-hidden="true"><span style="width:${rate}%"></span></div>
    </button>
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

function renderEventAlert() {
  const events = upcomingEvents(3);
  const panel = $("#eventAlertPanel");
  panel.dataset.dashboardAction = "calendar";
  panel.innerHTML = events.length ? `
    <div>
      <strong>다가오는 집안행사</strong>
      <span>${events.map(({ event, date }) => `${shortDateLabel(date)} ${escapeHtml(event.title)}`).join(" · ")}</span>
    </div>
  ` : `
    <div>
      <strong>다가오는 집안행사</strong>
      <span>등록된 일정이 없어요.</span>
    </div>
  `;
}

function renderCalendar() {
  const month = currentMonth();
  const [year, monthNo] = month.split("-").map(Number);
  const events = eventOccurrencesForMonth(month);
  const byDate = events.reduce((map, item) => {
    if (!map[item.date]) map[item.date] = [];
    map[item.date].push(item.event);
    return map;
  }, {});
  const firstDay = new Date(year, monthNo - 1, 1).getDay();
  const cells = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(`<div class="calendar-cell muted"></div>`);
  for (let day = 1; day <= daysInMonth(year, monthNo); day += 1) {
    const key = dateKey(year, monthNo, day);
    const lunar = lunarParts(parseDateKey(key));
    const dayEvents = byDate[key] || [];
    cells.push(`
      <div class="calendar-cell ${dayEvents.length ? "has-event" : ""}">
        <div class="calendar-day"><strong>${day}</strong><span>음 ${lunar.month}.${lunar.day}</span></div>
        ${dayEvents.map((event) => `<div class="calendar-event-dot ${event.calendar === "lunar" ? "lunar" : ""}">${escapeHtml(event.title)}</div>`).join("")}
      </div>
    `);
  }
  $("#calendarMonthLabel").textContent = monthLabel(month);
  $("#calendarCount").textContent = `${events.length}개 일정`;
  $("#calendarGrid").innerHTML = `
    ${["일", "월", "화", "수", "목", "금", "토"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
    ${cells.join("")}
  `;

  const upcoming = upcomingEvents(8);
  $("#upcomingEventList").innerHTML = upcoming.length ? upcoming.map(({ event, date }) => `
    <div class="event-item">
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <span>${shortDateLabel(date)} · ${eventDateLabel(event)}</span>
      </div>
      <em class="${event.calendar === "lunar" ? "lunar" : ""}">${event.calendar === "lunar" ? "음력" : "양력"}</em>
    </div>
  `).join("") : `<p class="empty">다가오는 일정 없음</p>`;

  $("#eventRows").innerHTML = state.events.length ? state.events.map((event) => `
    <tr>
      <td>${escapeHtml(event.title)}</td>
      <td><span class="soft-badge ${event.calendar === "lunar" ? "lunar-badge" : ""}">${repeatLabel(event)}</span></td>
      <td>${eventDateLabel(event)}</td>
      <td>${escapeHtml(event.memo)}</td>
      <td>
        <div class="row-actions">
          <button class="edit-button" data-edit-event="${event.id}" type="button">수정</button>
          <button class="delete-button" data-delete-event="${event.id}" type="button">삭제</button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td class="empty" colspan="5">등록된 일정 없음</td></tr>`;
}

function renderSettings() {
  const sharedIdField = $("#sharedBudgetId");
  if (sharedIdField && sharedSession && !sharedIdField.value) sharedIdField.value = sharedSession.householdId;
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
  renderEventAlert();
  renderCalendar();
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

function setEventEditMode(active) {
  $("#addEvent").textContent = active ? "저장" : "추가";
  $("#cancelEventEdit").classList.toggle("hidden", !active);
}

function resetExpenseForm(preferredDate = "") {
  editingExpenseId = null;
  const nextDate = preferredDate && preferredDate.startsWith(currentMonth()) ? preferredDate : defaultDateForMonth();
  $("#expenseForm").reset();
  $("#expenseDate").value = nextDate;
  updatePaymentOptions();
  setExpenseEditMode(false);
}

function resetIncomeForm(preferredDate = "") {
  editingIncomeId = null;
  const nextDate = preferredDate && preferredDate.startsWith(currentMonth()) ? preferredDate : defaultDateForMonth();
  $("#incomeForm").reset();
  $("#incomeDate").value = nextDate;
  setIncomeEditMode(false);
}

function updateEventFields() {
  const repeat = $("#eventRepeat").value;
  const calendar = $("#eventCalendarType").value;
  const isOnceSolar = repeat === "once" && calendar === "solar";
  $("#eventDate").classList.toggle("hidden", !isOnceSolar);
  $("#eventMonth").classList.toggle("hidden", repeat === "monthly" || isOnceSolar);
  $("#eventDay").classList.toggle("hidden", isOnceSolar);
  $("#eventDate").required = isOnceSolar;
  $("#eventMonth").required = !isOnceSolar && repeat !== "monthly";
  $("#eventDay").required = !isOnceSolar;
}

function resetEventForm() {
  editingEventId = null;
  $("#eventForm").reset();
  $("#eventCalendarType").value = "solar";
  $("#eventRepeat").value = "once";
  $("#eventDate").value = defaultDateForMonth();
  $("#eventMonth").value = Number(currentMonth().slice(5, 7));
  $("#eventDay").value = 1;
  updateEventFields();
  setEventEditMode(false);
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

function startEventEdit(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  editingEventId = id;
  $("#eventTitle").value = event.title;
  $("#eventCalendarType").value = event.calendar;
  $("#eventRepeat").value = event.repeat;
  $("#eventDate").value = event.date || `${currentMonth()}-01`;
  $("#eventMonth").value = event.month || Number(currentMonth().slice(5, 7));
  $("#eventDay").value = event.day || 1;
  $("#eventMemo").value = event.memo || "";
  updateEventFields();
  setEventEditMode(true);
  $(".nav-tab[data-view='calendar']").click();
  $("#eventTitle").focus();
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
  resetExpenseForm(nextRow.date);
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
  resetIncomeForm(nextRow.date);
  renderAll();
}

function addEvent() {
  const repeat = $("#eventRepeat").value;
  const calendar = $("#eventCalendarType").value;
  const date = $("#eventDate").value;
  const isOnceSolar = repeat === "once" && calendar === "solar";
  const month = isOnceSolar ? Number(date.slice(5, 7)) : Number($("#eventMonth").value || currentMonth().slice(5, 7));
  const day = isOnceSolar ? Number(date.slice(8, 10)) : Number($("#eventDay").value || 1);
  const nextEvent = normalizeEvent({
    id: editingEventId || newId("event"),
    title: $("#eventTitle").value,
    calendar,
    repeat,
    date: isOnceSolar ? date : "",
    year: isOnceSolar ? Number(date.slice(0, 4)) : Number(currentMonth().slice(0, 4)),
    month,
    day,
    memo: $("#eventMemo").value,
  });
  if (!nextEvent.title || !nextEvent.day || (!isOnceSolar && repeat !== "monthly" && !nextEvent.month)) return;
  if (editingEventId) {
    state.events = state.events.map((event) => event.id === editingEventId ? nextEvent : event);
  } else {
    state.events.push(nextEvent);
  }
  saveState();
  resetEventForm();
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

function moveToDateMonth(value) {
  if (!value) return;
  const month = value.slice(0, 7);
  if ($("#monthPicker").value !== month) $("#monthPicker").value = month;
}

function setQuickDate(targetId, action) {
  const field = $(`#${targetId}`);
  if (!field) return;
  const base = field.value ? parseDateKey(field.value) : parseDateKey(defaultDateForMonth());
  const today = new Date();
  const nextDate = action === "today"
    ? today
    : action === "yesterday"
      ? addDays(today, -1)
      : action === "prev"
        ? addDays(base, -1)
        : addDays(base, 1);
  field.value = toDateKey(nextDate);
  moveToDateMonth(field.value);
  renderAll();
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
  $("#expenseDate").value = defaultDateForMonth(month);
  $("#incomeDate").value = defaultDateForMonth(month);
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

function openExpenseList({ view = "all", category = "", method = "", payment = "", group = "" } = {}) {
  activateView("expenses");
  expenseFilters = { category, method, payment };
  expenseViewMode = view;
  expenseGroupFilter = group;
  $$(".switch-button").forEach((button) => button.classList.toggle("active", button.dataset.expenseView === view));
  renderExpenseFilters();
  renderExpenses();
}

function openPaymentLabel(label) {
  if (label === "원 계좌이체") {
    openExpenseList({ method: "계좌이체", payment: "원" });
    return;
  }
  if (label === "수연 계좌이체") {
    openExpenseList({ method: "계좌이체", payment: "수연" });
    return;
  }
  if (label === "원 용돈" || label === "수연이 용돈") {
    openExpenseList({ method: "현금", payment: label });
    return;
  }
  openExpenseList({ method: label, view: "method", group: label });
}

function handleDashboardAction(action, value) {
  if (action === "toggle-overview") {
    dashboardOverviewOpen = !dashboardOverviewOpen;
    renderDashboardDrilldown();
    return;
  }
  if (action === "calendar") {
    activateView("calendar");
    return;
  }
  if (action === "income") {
    activateView("income");
    return;
  }
  if (action === "analysis") {
    activateView("analysis");
    return;
  }
  if (action === "expenses") {
    openExpenseList();
    return;
  }
  if (action === "category") {
    if (value) openExpenseList({ category: value, view: "category", group: value });
    else openExpenseList({ view: "category" });
    return;
  }
  if (action === "payment" || action === "recommended") {
    if (value) openExpenseList({ payment: value });
    else activateView("analysis");
    return;
  }
  if (action === "method") openPaymentLabel(value);
}

function activateView(viewName) {
  const view = $(`#${viewName}View`);
  if (!view) return;
  $$(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  $$(".view").forEach((item) => item.classList.toggle("active", item === view));
  renderChart();
}

function activateExpenseView(viewName) {
  expenseViewMode = viewName;
  expenseGroupFilter = null;
  $$(".switch-button").forEach((button) => button.classList.toggle("active", button.dataset.expenseView === viewName));
  renderExpenses();
}

function activateSettingsTab(tabName) {
  $$(".settings-tab").forEach((button) => button.classList.toggle("active", button.dataset.settingsTab === tabName));
  $$(".settings-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.settingsPanel === tabName));
}

function boot() {
  const today = new Date();
  const defaultMonth = currentMonthKey();
  $("#todayLabel").textContent = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  $("#monthPicker").value = defaultMonth;
  setDefaultDates();
  resetEventForm();
  renderAll();
  syncFileState();
  setupCloud();
}

document.addEventListener("click", (event) => {
  const navTab = closestTarget(event, "[data-view]");
  if (navTab) {
    event.stopImmediatePropagation();
    activateView(navTab.dataset.view);
    return;
  }

  const switchButton = closestTarget(event, "[data-expense-view]");
  if (switchButton) {
    event.stopImmediatePropagation();
    activateExpenseView(switchButton.dataset.expenseView);
    return;
  }

  const settingsTab = closestTarget(event, "[data-settings-tab]");
  if (settingsTab) {
    event.stopImmediatePropagation();
    activateSettingsTab(settingsTab.dataset.settingsTab);
    return;
  }

  const dateButton = closestTarget(event, "[data-date-action]");
  if (dateButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setQuickDate(dateButton.dataset.dateTarget, dateButton.dataset.dateAction);
    return;
  }

  const dashboardButton = closestTarget(event, "[data-dashboard-action]");
  if (dashboardButton) {
    if (dashboardButton.classList.contains("dashboard-hero") && closestTarget(event, "button,label,input")) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    handleDashboardAction(dashboardButton.dataset.dashboardAction, dashboardButton.dataset.dashboardValue || "");
    return;
  }

  const button = closestTarget(event, "button");
  if (!button) return;
  const actions = {
    clearExpenseFilters: () => {
      expenseFilters = { category: "", method: "", payment: "" };
      expenseGroupFilter = null;
      renderExpenseFilters();
      renderExpenses();
    },
    addExpense: () => $("#expenseForm")?.requestSubmit(),
    addIncome: () => $("#incomeForm")?.requestSubmit(),
    addEvent: () => $("#eventForm")?.requestSubmit(),
    cancelExpenseEdit: () => {
      resetExpenseForm();
      renderSelectors();
    },
    cancelIncomeEdit: () => {
      resetIncomeForm();
      renderSelectors();
    },
    cancelEventEdit: resetEventForm,
    clearExpenses: () => {
      if (!confirm("현재 조회월의 지출 내역을 모두 삭제할까요?")) return;
      const month = currentMonth();
      state.expenses = state.expenses.filter((row) => !inMonth(row, month));
      resetExpenseForm();
      saveState();
      renderAll();
    },
    clearIncomes: () => {
      if (!confirm("현재 조회월의 수입 내역을 모두 삭제할까요?")) return;
      const month = currentMonth();
      state.incomes = state.incomes.filter((row) => !inMonth(row, month));
      resetIncomeForm();
      saveState();
      renderAll();
    },
    exportJson: downloadJson,
    resetSample: () => {
      if (!confirm("빈 가계부로 초기화할까요? 현재 저장 내용은 백업으로 남겨둘게요.")) return;
      state = clone(sampleState);
      saveState();
      boot();
    },
    restoreBackup,
    connectSharedBudget,
    signOutCloud,
    syncCloudNow: async () => {
      if (!sharedSession) {
        renderCloudStatus("공유 로그인 필요");
        return;
      }
      if (!cloudClient) await setupCloud();
      await saveCloudState(true);
    },
    addCategory: () => {
      addUnique(state.settings.categories, $("#newCategory").value);
      $("#newCategory").value = "";
      saveState();
      renderAll();
    },
    addIncomeType: () => {
      addUnique(state.settings.incomeTypes, $("#newIncomeType").value);
      $("#newIncomeType").value = "";
      saveState();
      renderAll();
    },
    addPaymentItem: () => {
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
    },
    importSheetData,
  };
  const action = actions[button.id];
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  Promise.resolve(action()).catch((error) => showError(`버튼 실행 오류: ${error.message}`));
}, true);

$$(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activateView(tab.dataset.view);
  });
});

$$(".switch-button").forEach((button) => {
  button.addEventListener("click", () => {
    activateExpenseView(button.dataset.expenseView);
  });
});

$$(".settings-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activateSettingsTab(button.dataset.settingsTab);
  });
});

on("#monthPicker", "change", () => {
  setDefaultDates();
  renderAll();
});
on("#expenseDate", "change", (event) => {
  moveToDateMonth(event.target.value);
  renderAll();
});
on("#incomeDate", "change", (event) => {
  moveToDateMonth(event.target.value);
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
on("#eventForm", "submit", (event) => {
  event.preventDefault();
  addEvent();
});
on("#eventCalendarType", "change", updateEventFields);
on("#eventRepeat", "change", updateEventFields);
on("#addEvent", "click", () => $("#eventForm").requestSubmit());
on("#cancelEventEdit", "click", resetEventForm);
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
  if (!confirm("빈 가계부로 초기화할까요? 현재 저장 내용은 백업으로 남겨둘게요.")) return;
  state = clone(sampleState);
  saveState();
  boot();
});
on("#restoreBackup", "click", restoreBackup);
on("#connectSharedBudget", "click", connectSharedBudget);
on("#signOutCloud", "click", signOutCloud);
on("#syncCloudNow", "click", async () => {
  if (!sharedSession) {
    renderCloudStatus("공유 로그인 필요");
    return;
  }
  if (!cloudClient) await setupCloud();
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
  const groupFilter = closestTarget(event, "[data-group-filter]")?.dataset.groupFilter;
  const clearGroupFilter = closestTarget(event, "[data-clear-group-filter]");
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
  const editExpenseId = closestTarget(event, "[data-edit-expense]")?.dataset.editExpense;
  const editIncomeId = closestTarget(event, "[data-edit-income]")?.dataset.editIncome;
  const editEventId = closestTarget(event, "[data-edit-event]")?.dataset.editEvent;
  const expenseId = closestTarget(event, "[data-delete-expense]")?.dataset.deleteExpense;
  const incomeId = closestTarget(event, "[data-delete-income]")?.dataset.deleteIncome;
  const eventId = closestTarget(event, "[data-delete-event]")?.dataset.deleteEvent;
  const category = closestTarget(event, "[data-remove-category]")?.dataset.removeCategory;
  const incomeType = closestTarget(event, "[data-remove-income-type]")?.dataset.removeIncomeType;
  const paymentName = closestTarget(event, "[data-remove-payment]")?.dataset.removePayment;
  if (editExpenseId) {
    startExpenseEdit(editExpenseId);
    return;
  }
  if (editIncomeId) {
    startIncomeEdit(editIncomeId);
    return;
  }
  if (editEventId) {
    startEventEdit(editEventId);
    return;
  }
  if (expenseId) state.expenses = state.expenses.filter((row) => row.id !== expenseId);
  if (incomeId) state.incomes = state.incomes.filter((row) => row.id !== incomeId);
  if (eventId) state.events = state.events.filter((row) => row.id !== eventId);
  if (category) state.settings.categories = state.settings.categories.filter((item) => item !== category);
  if (incomeType) state.settings.incomeTypes = state.settings.incomeTypes.filter((item) => item !== incomeType);
  if (paymentName) {
    state.settings.paymentItems = state.settings.paymentItems.filter((item) => item.name !== paymentName);
    delete state.settings.cardTargets[paymentName];
  }
  if (expenseId || incomeId || eventId || category || incomeType || paymentName) {
    if (expenseId === editingExpenseId) resetExpenseForm();
    if (incomeId === editingIncomeId) resetIncomeForm();
    if (eventId === editingEventId) resetEventForm();
    saveState();
    renderAll();
  }
});
document.addEventListener("change", (event) => {
  const cardName = closestTarget(event, "[data-card-target]")?.dataset.cardTarget;
  if (!cardName) return;
  const level = closestTarget(event, "[data-card-target]")?.dataset.targetLevel || "primary";
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

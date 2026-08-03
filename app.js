const STORAGE_KEY = "household-budget-app-v1";
const BACKUP_KEY = `${STORAGE_KEY}-backup`;
const SHARED_SESSION_KEY = `${STORAGE_KEY}-shared-session`;
const SUPABASE_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const SHARED_STATE_TABLE = "shared_budget_states";
const newId = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const PAYMENT_METHODS = ["카드(원)", "카드(수)", "현금", "계좌이체"];
const EXPENSE_SOURCES = ["공용"];
const CANCELLATION_CATEGORY = "취소";
const ALLOWANCE_CARD_WON = "원 용돈카드";
const ALLOWANCE_CARD_SUYEON = "수연 용돈카드";
const DEFAULT_DASHBOARD_TITLE = "우리집 이번 달";
const DASHBOARD_MEMO_LIMIT = 10;
const SAVINGS_TYPES = ["비상금", "적금", "주식", "기타"];
const DEFAULT_SAVINGS_DETAILS = {
  "비상금": ["생활비", "병원비"],
  "적금": ["청약", "여행적금"],
  "주식": ["국내주식", "해외주식"],
  "기타": ["기타"],
};
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
  "국민(수)": "#FFD9E8",
  "롯데(수)": "#FFE8B8",
  "현대(수)": "#F2DDF7",
  [ALLOWANCE_CARD_WON]: "#E0F5D9",
  [ALLOWANCE_CARD_SUYEON]: "#FFE0CC",
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
  "국민(수)": { primary: 200000, secondary: 0 },
  "롯데(수)": { primary: 400000, secondary: 0 },
  "현대(수)": { primary: 300000, secondary: 0 },
  [ALLOWANCE_CARD_WON]: { primary: 0, secondary: 0 },
  [ALLOWANCE_CARD_SUYEON]: { primary: 0, secondary: 0 },
};
const DEFAULT_BUDGET_DETAILS = {
  "고정": ["은행이자", "관리비", "통신비", "보험"],
};

const sampleState = {
  settings: {
    categories: ["생활", "식재료", "외식", "교통", "고정", "관계", "쇼핑(Flex)", "의료", "문화", "여행", "기타"],
    incomeTypes: ["급여(원)", "급여(수)", "기타(원)", "기타(수)", "축의금", "환급"],
    monthlyBudgets: {},
    monthlyBudgetDetails: {},
    budgetExcludedCategories: [],
    budgetCustomCategories: [],
    dashboardMemo: DEFAULT_DASHBOARD_TITLE,
    savingsInitialAmount: 0,
    savingsInitialAmounts: {},
    savingsDetails: DEFAULT_SAVINGS_DETAILS,
    cardTargets: DEFAULT_CARD_TARGETS,
    paymentItems: [
      { group: "카드(원)", name: "국민(원)", method: "카드(원)" },
      { group: "카드(원)", name: "삼성(원)", method: "카드(원)" },
      { group: "카드(원)", name: "신한(원)", method: "카드(원)" },
      { group: "카드(원)", name: "현대(원)", method: "카드(원)" },
      { group: "카드(수)", name: "국민(수)", method: "카드(수)" },
      { group: "카드(수)", name: "롯데(수)", method: "카드(수)" },
      { group: "카드(수)", name: "현대(수)", method: "카드(수)" },
      { group: "카드(원)", name: ALLOWANCE_CARD_WON, method: "카드(원)" },
      { group: "카드(수)", name: ALLOWANCE_CARD_SUYEON, method: "카드(수)" },
      { group: "현금", name: "현금", method: "현금" },
      { group: "계좌이체", name: "원", method: "계좌이체" },
      { group: "계좌이체", name: "수연", method: "계좌이체" },
    ],
  },
  expenses: [],
  incomes: [],
  savings: [],
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
let expenseFilters = { category: "", method: "", payment: "", source: "" };
let expenseVisibleLimit = 10;
let editingExpenseId = null;
let editingIncomeId = null;
let editingEventId = null;
let dashboardOverviewOpen = false;
let activeCardUsageName = "";
let activeExpenseFilterPicker = "";
let activeBudgetDetailCategory = "";
let activeSavingsType = SAVINGS_TYPES[0];
let activeSavingsDetail = "전체";
let viewHistory = [];
let cloudClient = null;
let sharedSession = loadSharedSession();
let cloudSaveTimer = null;
let cloudRevision = 0;
let cloudBaseState = null;
let cloudWriteQueue = Promise.resolve();
let applyingCloudState = false;
let cloudSetupPromise = null;
let supabaseLoadPromise = null;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartedOnInteractive = false;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeStateValue(base, local, remote) {
  if (valuesEqual(local, base)) return clone(remote);
  if (valuesEqual(remote, base) || valuesEqual(local, remote)) return clone(local);
  if (Array.isArray(local) && Array.isArray(remote)) {
    const objectItems = [...local, ...remote].filter((item) => item && typeof item === "object");
    const keyName = objectItems.some((item) => item.id) ? "id" : objectItems.some((item) => item.name) ? "name" : "";
    if (keyName) {
      const baseMap = new Map((Array.isArray(base) ? base : []).map((item) => [item?.[keyName], item]));
      const localMap = new Map(local.map((item) => [item?.[keyName], item]));
      const remoteMap = new Map(remote.map((item) => [item?.[keyName], item]));
      return [...new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()])]
        .filter(Boolean)
        .map((key) => {
          const baseItem = baseMap.get(key);
          const localItem = localMap.get(key);
          const remoteItem = remoteMap.get(key);
          if (localItem === undefined) return valuesEqual(remoteItem, baseItem) ? null : clone(remoteItem);
          if (remoteItem === undefined) return valuesEqual(localItem, baseItem) ? null : clone(localItem);
          return mergeStateValue(baseItem, localItem, remoteItem);
        })
        .filter(Boolean);
    }
    return [...new Set([...local, ...remote])];
  }
  if (local && remote && typeof local === "object" && typeof remote === "object") {
    const baseObject = base && typeof base === "object" ? base : {};
    return Object.fromEntries([...new Set([...Object.keys(baseObject), ...Object.keys(local), ...Object.keys(remote)])].map((key) => [
      key,
      mergeStateValue(baseObject[key], local[key], remote[key]),
    ]).filter(([, value]) => value !== undefined));
  }
  return clone(local);
}

function mergeBudgetStates(base, local, remote) {
  return normalizeState(mergeStateValue(base || clone(sampleState), local, remote));
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
  if (message.includes("revision") || message.includes("save_shared_budget_state")) return "공유 SQL 업데이트 필요";
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
    .select("payload, revision")
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
      state = cloudBaseState ? mergeBudgetStates(cloudBaseState, state, cloudState) : normalizeState(cloudState);
      cloudBaseState = clone(state);
      cloudRevision = Number(data.revision || 0);
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
    let localSnapshot = clone(state);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const payload = await encryptSharedState(localSnapshot);
      const { data, error } = await cloudClient.rpc("save_shared_budget_state", {
        p_household_key: sharedSession.lookupKey,
        p_household_name: sharedSession.householdId,
        p_payload: payload,
        p_expected_revision: cloudRevision,
      });
      if (error) {
        renderCloudStatus(cloudErrorMessage(error, "공유 저장 실패"));
        return;
      }
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.saved) {
        cloudRevision = Number(result.current_revision || cloudRevision + 1);
        cloudBaseState = clone(localSnapshot);
        renderCloudStatus(attempt ? "충돌 병합 후 저장됨" : "공유 저장됨");
        return;
      }
      if (!result?.current_payload) {
        renderCloudStatus("공유 저장 충돌 확인 필요");
        return;
      }
      const remoteState = normalizeState(await decryptSharedState(result.current_payload));
      const mergedSnapshot = mergeBudgetStates(cloudBaseState, localSnapshot, remoteState);
      state = mergeBudgetStates(localSnapshot, state, mergedSnapshot);
      localSnapshot = clone(state);
      cloudBaseState = clone(remoteState);
      cloudRevision = Number(result.current_revision || 0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
    }
    renderCloudStatus("동시 수정이 많아 다시 동기화해 주세요");
  };
  clearTimeout(cloudSaveTimer);
  if (immediate) {
    cloudWriteQueue = cloudWriteQueue.then(write, write);
    await cloudWriteQueue;
    return;
  }
  cloudSaveTimer = setTimeout(() => {
    cloudWriteQueue = cloudWriteQueue.then(write, write);
    cloudWriteQueue.catch(() => renderCloudStatus("공유 저장 실패"));
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
  cloudRevision = 0;
  cloudBaseState = null;
  localStorage.removeItem(SHARED_SESSION_KEY);
  state = clone(sampleState);
  saveState();
  renderAll();
  renderCloudStatus("연결 해제됨");
}

function normalizeState(source) {
  const next = clone(source);
  next.settings.categories = (next.settings.categories || clone(sampleState).settings.categories)
    .filter((category) => category !== CANCELLATION_CATEGORY);
  next.settings.monthlyBudgets = Object.fromEntries(
    Object.entries(next.settings.monthlyBudgets || {}).map(([name, amount]) => [name, Math.max(Number(amount) || 0, 0)]),
  );
  next.settings.monthlyBudgetDetails = Object.fromEntries(
    Object.entries(next.settings.monthlyBudgetDetails || {}).map(([category, items]) => [
      category,
      Array.isArray(items) ? items.map((item) => ({
        id: item.id || newId("budget-detail"),
        name: String(item.name || "").trim(),
        amount: Math.max(Number(item.amount) || 0, 0),
      })) : [],
    ]),
  );
  Object.entries(next.settings.monthlyBudgetDetails).forEach(([category, items]) => {
    if (items.length) next.settings.monthlyBudgets[category] = items.reduce((total, item) => total + item.amount, 0);
  });
  next.settings.budgetExcludedCategories = [...new Set(next.settings.budgetExcludedCategories || [])];
  next.settings.budgetCustomCategories = [...new Set(next.settings.budgetCustomCategories || [])]
    .filter((name) => name && !next.settings.categories.includes(name) && name !== "저축" && name !== CANCELLATION_CATEGORY);
  next.settings.dashboardMemo = String(next.settings.dashboardMemo || DEFAULT_DASHBOARD_TITLE).trim().slice(0, DASHBOARD_MEMO_LIMIT) || DEFAULT_DASHBOARD_TITLE;
  const legacySavingsInitialAmount = Math.max(Number(next.settings.savingsInitialAmount || 0), 0);
  next.settings.savingsInitialAmounts = Object.fromEntries(
    SAVINGS_TYPES.map((type) => [
      type,
      Math.max(Number(next.settings.savingsInitialAmounts?.[type] || 0), 0),
    ]),
  );
  if (legacySavingsInitialAmount && !Object.values(next.settings.savingsInitialAmounts).some(Boolean)) {
    next.settings.savingsInitialAmounts[SAVINGS_TYPES[0]] = legacySavingsInitialAmount;
  }
  next.settings.savingsInitialAmount = Object.values(next.settings.savingsInitialAmounts).reduce((total, amount) => total + amount, 0);
  next.settings.savingsDetails = Object.fromEntries(
    SAVINGS_TYPES.map((type) => [
      type,
      [...new Set([
        ...(next.settings.savingsDetails?.[type] || []),
        ...(DEFAULT_SAVINGS_DETAILS[type] || []),
      ].map((detail) => String(detail || "").trim()).filter(Boolean))],
    ]),
  );
  next.settings.cardTargets = { ...DEFAULT_CARD_TARGETS, ...(next.settings.cardTargets || {}) };
  if (next.settings.cardTargets["국제(수)"] !== undefined) {
    next.settings.cardTargets["국민(수)"] = next.settings.cardTargets["국제(수)"];
    delete next.settings.cardTargets["국제(수)"];
  }
  if (next.settings.cardTargets["국체(수)"] !== undefined) {
    next.settings.cardTargets["국민(수)"] = next.settings.cardTargets["국체(수)"];
    delete next.settings.cardTargets["국체(수)"];
  }
  next.settings.cardTargets = Object.fromEntries(Object.entries(next.settings.cardTargets).map(([name, target]) => [name, normalizeCardTarget(target)]));
  next.settings.paymentItems = (next.settings.paymentItems || []).map((item) => {
    if (item.name === "국제(수)" || item.name === "국체(수)") return { ...item, name: "국민(수)" };
    if (item.method === "카드" && (item.group === "카드(원)" || item.group === "카드(수)")) {
      return { ...item, method: item.group };
    }
    return item;
  }).filter((item) => !["원 용돈", "수연이 용돈"].includes(item.name));
  next.settings.paymentItems = Array.from(new Map(next.settings.paymentItems.map((item) => [item.name, item])).values());
  ensurePaymentItem(next.settings.paymentItems, { group: "카드(원)", name: ALLOWANCE_CARD_WON, method: "카드(원)" });
  ensurePaymentItem(next.settings.paymentItems, { group: "카드(수)", name: ALLOWANCE_CARD_SUYEON, method: "카드(수)" });
  if (!next.settings.paymentItems.some((item) => item.method === "현금")) {
    next.settings.paymentItems.push({ group: "현금", name: "현금", method: "현금" });
  }
  next.expenses = next.expenses.map((row) => {
    const legacyAllowance = ["원 용돈", "수연이 용돈"].includes(row.payment) ? row.payment : "";
    const sourceAllowance = allowanceCardForSource(row.source);
    let paymentName = row.payment;
    if (legacyAllowance) paymentName = allowanceCardForSource(legacyAllowance);
    else if (sourceAllowance) paymentName = sourceAllowance;
    else if (row.payment === "국제(수)" || row.payment === "국체(수)") paymentName = "국민(수)";
    const item = next.settings.paymentItems.find((payment) => payment.name === paymentName);
    const method = row.method === "카드" && item?.method ? item.method : row.method;
    const source = "공용";
    return {
      ...row,
      category: row.category === CANCELLATION_CATEGORY ? "기타" : row.category,
      amount: Math.abs(Number(row.amount || 0)),
      method: item?.method || method || "현금",
      payment: paymentName || "현금",
      source,
      cancelled: Boolean(row.cancelled || row.category === CANCELLATION_CATEGORY),
    };
  });
  next.savings = (next.savings || []).map((row) => ({
    id: row.id || newId("saving"),
    date: row.date || todayKey(),
    amount: Number(row.amount) || 0,
    type: SAVINGS_TYPES.includes(row.type) ? row.type : SAVINGS_TYPES[0],
    detail: String(row.detail || "기본").trim(),
    memo: String(row.memo || "").trim(),
    ...(row.transferId ? { transferId: row.transferId } : {}),
  })).filter((row) => row.date && row.amount !== 0);
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

function ensurePaymentItem(items, item) {
  if (!items.some((row) => row.name === item.name)) items.push(item);
}

function allowanceCardForSource(source) {
  if (source === "원 용돈") return ALLOWANCE_CARD_WON;
  if (source === "수연이 용돈") return ALLOWANCE_CARD_SUYEON;
  return "";
}

function saveState() {
  const previous = localStorage.getItem(STORAGE_KEY);
  const next = JSON.stringify(state);
  if (previous && previous !== next) localStorage.setItem(BACKUP_KEY, previous);
  localStorage.setItem(STORAGE_KEY, next);
  saveCloudState();
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

function savingsDetailsForType(type = activeSavingsType) {
  return [...new Set(["기본", ...(state.settings.savingsDetails?.[type] || [])]
    .map((detail) => String(detail || "").trim())
    .filter(Boolean))];
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

function isCancellationExpense(row) {
  return Boolean(row.cancelled || row.category === CANCELLATION_CATEGORY);
}

function expenseValue(row) {
  const amount = Math.abs(Number(row.amount || 0));
  return isCancellationExpense(row) ? -amount : amount;
}

function expenseSum(rows) {
  return rows.reduce((total, row) => total + expenseValue(row), 0);
}

function formatSignedWon(value) {
  return `${value > 0 ? "+" : ""}${won.format(value)}`;
}

function formatExpenseAmount(row) {
  return isCancellationExpense(row) ? formatSignedWon(Math.abs(Number(row.amount || 0))) : won.format(row.amount);
}

function byKey(rows, keyFn, valueFn = (row) => Number(row.amount || 0)) {
  return rows.reduce((map, row) => {
    const key = keyFn(row) || "기타";
    map[key] = (map[key] || 0) + valueFn(row);
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
      const used = expenseSum(data.expenses.filter((row) => row.payment === name));
      const activeTarget = used < primary || secondary <= primary ? primary : secondary;
      const phase = used < primary || secondary <= primary ? "1차" : "2차";
      const remaining = Math.max(activeTarget - used, 0);
      const rate = activeTarget ? Math.min(Math.round((used / activeTarget) * 100), 100) : 0;
      return { name, primary, secondary, used, remaining, rate, phase };
    })
    .filter((entry) => entry.primary > 0 || entry.secondary > 0 || entry.used !== 0);
}

function totalForPaymentLabel(data, label) {
  if (label === "원 계좌이체") return expenseSum(data.expenses.filter((row) => row.method === "계좌이체" && row.payment === "원"));
  if (label === "수연 계좌이체") return expenseSum(data.expenses.filter((row) => row.method === "계좌이체" && row.payment === "수연"));
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
  const savings = (state.savings || []).filter((row) => inMonth(row, month));
  const carryover = sum(state.incomes.filter((row) => beforeMonth(row, month))) - expenseSum(state.expenses.filter((row) => beforeMonth(row, month)));
  const expenseTotal = expenseSum(expenses);
  const incomeTotal = sum(incomes);
  const savingsTotal = sum(savings);
  const savingsInitialTotal = Object.values(state.settings.savingsInitialAmounts || {}).reduce((total, amount) => total + Number(amount || 0), 0);
  const savingsBalance = savingsInitialTotal + sum(state.savings || []);
  const groupTotals = byKey(expenses, paymentGroup, expenseValue);
  const categoryTotals = byKey(expenses, (row) => row.category, expenseValue);
  const topCategory = Object.entries(categoryTotals).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])[0] || ["-", 0];
  return {
    month,
    expenses,
    incomes,
    savings,
    carryover,
    expenseTotal,
    incomeTotal,
    savingsTotal,
    savingsBalance,
    balance: carryover + incomeTotal - expenseTotal,
    groupTotals,
    categoryTotals,
    topCategory,
    cardUsage: (groupTotals["카드(원)"] || 0) + (groupTotals["카드(수)"] || 0),
  };
}

function dashboardInsight(data, targetEntries) {
  const topCategory = data.topCategory[0] === "-" ? "지출" : data.topCategory[0];
  const nextTarget = targetEntries.find((entry) => entry.remaining > 0);
  if (!data.expenseTotal) return ["첫 지출 기다림", "기록 시작하기"];
  const topInsight = `${topCategory} 지출 최다`;
  if (data.balance < 0) return [topInsight, "잔액 부족"];
  if (nextTarget) return [topInsight, `${nextTarget.name} ${nextTarget.phase} ${nextTarget.rate}%`];
  return [topInsight, "카드 실적 달성"];
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

function renderCategoryPicker() {
  const select = $("#expenseCategory");
  const selected = select.value || state.settings.categories[0] || "";
  const label = $("#expenseCategoryPickerLabel");
  const dot = $(".category-picker-dot");
  if (label) label.textContent = selected || "카테고리";
  if (dot) dot.style.background = categoryColor(selected);
  $("#categoryChoiceGrid").innerHTML = state.settings.categories.map((category) => `
    <button class="category-choice ${category === selected ? "active" : ""}" data-category-choice="${escapeHtml(category)}" type="button">
      <span style="background:${categoryColor(category)}"></span>
      <strong>${escapeHtml(category)}</strong>
    </button>
  `).join("");
}

function openCategoryPicker() {
  renderCategoryPicker();
  const dialog = $("#categoryDialog");
  if (dialog?.showModal) dialog.showModal();
}

function closeCategoryPicker() {
  const dialog = $("#categoryDialog");
  if (dialog?.open) dialog.close();
}

function selectExpenseCategory(category) {
  if (!state.settings.categories.includes(category)) return;
  $("#expenseCategory").value = category;
  renderCategoryPicker();
  closeCategoryPicker();
}

function renderPaymentPickers() {
  const method = $("#expenseMethod").value || PAYMENT_METHODS[0];
  const payment = $("#expenseCard").value || "";
  $("#expenseMethodPickerLabel").textContent = method || "결제수단";
  $("#expenseCardPickerLabel").textContent = payment || "종류";
  $("#paymentMethodChoiceGrid").innerHTML = PAYMENT_METHODS.map((value) => `
    <button class="category-choice payment-choice ${value === method ? "active" : ""}" data-payment-method-choice="${escapeHtml(value)}" type="button">
      <span style="background:${METHOD_FALLBACK_COLORS[value] || "#EEF3F7"}"></span>
      <strong>${escapeHtml(value)}</strong>
    </button>
  `).join("");
  const items = paymentItemsForMethod(method);
  $("#paymentCardChoiceGrid").innerHTML = items.map((item) => `
    <button class="category-choice payment-choice ${item.name === payment ? "active" : ""}" data-payment-card-choice="${escapeHtml(item.name)}" type="button">
      <span style="background:${PAYMENT_COLORS[item.name] || METHOD_FALLBACK_COLORS[method] || "#EEF3F7"}"></span>
      <strong>${escapeHtml(item.name)}</strong>
    </button>
  `).join("");
}

function renderIncomeTypePicker() {
  const select = $("#incomeType");
  const selected = select.value || state.settings.incomeTypes[0] || "";
  $("#incomeTypePickerLabel").textContent = selected || "수입항목";
  $("#incomeTypeChoiceGrid").innerHTML = state.settings.incomeTypes.map((type, index) => `
    <button class="category-choice payment-choice ${type === selected ? "active" : ""}" data-income-type-choice="${escapeHtml(type)}" type="button">
      <span style="background:${FALLBACK_COLORS[index % FALLBACK_COLORS.length]}"></span>
      <strong>${escapeHtml(type)}</strong>
    </button>
  `).join("");
}

function selectIncomeType(type) {
  if (!state.settings.incomeTypes.includes(type)) return;
  $("#incomeType").value = type;
  renderIncomeTypePicker();
  closePickerDialog("incomeTypeDialog");
}

function openPickerDialog(dialogId) {
  if (dialogId === "incomeTypeDialog") renderIncomeTypePicker();
  else renderPaymentPickers();
  const dialog = $(`#${dialogId}`);
  if (dialog?.showModal) dialog.showModal();
}

function closePickerDialog(dialogId) {
  const dialog = $(`#${dialogId}`);
  if (dialog?.open) dialog.close();
}

function selectExpenseMethod(method) {
  if (!PAYMENT_METHODS.includes(method)) return;
  $("#expenseMethod").value = method;
  updatePaymentOptions();
  renderPaymentPickers();
  closePickerDialog("paymentMethodDialog");
}

function selectExpenseCard(payment) {
  const item = getPaymentItem(payment);
  if (!item || item.method !== $("#expenseMethod").value) return;
  $("#expenseCard").value = payment;
  updateExpenseGroup();
  renderPaymentPickers();
  closePickerDialog("paymentCardDialog");
}

function renderExpenseSourceSegment() {
  const selected = $("#expenseSource").value || "공용";
  const segment = $("#expenseSourceSegment");
  if (!segment) return;
  segment.innerHTML = EXPENSE_SOURCES.map((source) => `
    <button class="${source === selected ? "active" : ""}" data-expense-source-choice="${escapeHtml(source)}" type="button">${escapeHtml(source.replace(" 용돈", ""))}</button>
  `).join("");
}

function selectExpenseSource(source) {
  if (!EXPENSE_SOURCES.includes(source)) return;
  $("#expenseSource").value = source;
  renderExpenseSourceSegment();
}

function renderSelectors() {
  const currentMethod = $("#expenseMethod").value;
  const selectedMethod = PAYMENT_METHODS.includes(currentMethod) ? currentMethod : "카드(원)";
  const selectedPayment = $("#expenseCard").value;
  optionList($("#expenseCategory"), state.settings.categories);
  optionList($("#expenseMethod"), PAYMENT_METHODS, selectedMethod);
  optionList($("#expenseSource"), EXPENSE_SOURCES, $("#expenseSource").value || "공용");
  optionList($("#incomeType"), state.settings.incomeTypes);
  updatePaymentOptions(selectedPayment);
  renderExpenseFilters();
  renderCategoryPicker();
  renderPaymentPickers();
  renderExpenseSourceSegment();
  renderIncomeTypePicker();
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
  $("#expenseFilterCategoryLabel").textContent = expenseFilters.category || "카테고리 전체";
  $("#expenseFilterMethodLabel").textContent = expenseFilters.method || "결제수단 전체";
  $("#expenseFilterPaymentLabel").textContent = expenseFilters.payment || "상세수단 전체";
}

function expenseFilterPickerOptions(type) {
  if (type === "category") {
    return { title: "카테고리 선택", allLabel: "카테고리 전체", values: state.settings.categories, selected: expenseFilters.category };
  }
  if (type === "method") {
    return { title: "결제수단 선택", allLabel: "결제수단 전체", values: PAYMENT_METHODS, selected: expenseFilters.method };
  }
  const values = expenseFilters.method
    ? expensePaymentNames().filter((name) => getPaymentItem(name)?.method === expenseFilters.method)
    : expensePaymentNames();
  return { title: "상세수단 선택", allLabel: "상세수단 전체", values, selected: expenseFilters.payment };
}

function openExpenseFilterPicker(type) {
  if (!["category", "method", "payment"].includes(type)) return;
  activeExpenseFilterPicker = type;
  const { title, allLabel, values, selected } = expenseFilterPickerOptions(type);
  $("#expenseFilterDialogTitle").textContent = title;
  $("#expenseFilterChoiceGrid").innerHTML = ["", ...values].map((value) => {
    const label = value || allLabel;
    const color = type === "category"
      ? categoryColor(value)
      : type === "method"
        ? METHOD_FALLBACK_COLORS[value] || "#EEF3F7"
        : PAYMENT_COLORS[value] || "#EEF3F7";
    return `
      <button class="category-choice payment-choice ${value === selected ? "active" : ""}" data-expense-filter-choice="${escapeHtml(value)}" type="button">
        <span style="background:${value ? color : "#EEF3F7"}"></span>
        <strong>${escapeHtml(label)}</strong>
      </button>
    `;
  }).join("");
  const dialog = $("#expenseFilterDialog");
  if (dialog?.showModal) dialog.showModal();
}

function selectExpenseFilter(value) {
  if (!activeExpenseFilterPicker) return;
  expenseFilters[activeExpenseFilterPicker] = value;
  if (activeExpenseFilterPicker === "method") expenseFilters.payment = "";
  expenseGroupFilter = null;
  expenseVisibleLimit = 10;
  renderExpenseFilters();
  renderExpenses();
  closePickerDialog("expenseFilterDialog");
}

function updatePaymentOptions(preferredPayment) {
  const method = $("#expenseMethod").value || "카드(원)";
  const items = paymentItemsForMethod(method);
  const selected = items.some((item) => item.name === preferredPayment) ? preferredPayment : items[0]?.name;
  optionList($("#expenseCard"), items.map((item) => item.name), selected);
  $("#expenseCard").disabled = items.length === 0;
  updateExpenseGroup();
  renderPaymentPickers();
}

function updateExpenseGroup() {
  const item = getPaymentItem($("#expenseCard").value);
  const field = $("#expenseGroup");
  if (field) field.value = item?.group || "";
}

function setExpenseCancelToggle(active) {
  const button = $("#expenseCancelToggle");
  if (!button) return;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

function toggleExpenseCancel() {
  setExpenseCancelToggle($("#expenseCancelToggle")?.getAttribute("aria-pressed") !== "true");
}

function renderSummary() {
  const data = monthlyData();
  const targetEntries = cardTargetEntries(data);
  $("#dashboardMonth").textContent = monthLabel(data.month);
  $("#dashboardTitle").textContent = state.settings.dashboardMemo || DEFAULT_DASHBOARD_TITLE;
  renderMonthStepper();
  $("#analysisMonth").textContent = monthLabel(data.month);
  $("#topCategoryLabel").textContent = `이번달 최다 지출: ${data.topCategory[0]}`;
  $("#expenseMonthTotal").textContent = won.format(data.expenseTotal);
  $("#incomeMonthTotal").textContent = won.format(data.incomeTotal);
  $("#monthlyInsight").innerHTML = dashboardInsight(data, targetEntries)
    .map((insight) => `<span>${escapeHtml(insight)}</span>`)
    .join("");
  $("#heroBalance").textContent = won.format(data.balance);
  $("#heroBalance").classList.toggle("negative", data.balance < 0);
  const nextTarget = targetEntries.find((entry) => entry.remaining > 0);
  const recommended = !targetEntries.length
    ? "목표 없음"
    : nextTarget
      ? nextTarget.name
      : "아껴쓰세요~";

  const cards = [
    ["이번달 수입", won.format(data.incomeTotal), false, "income"],
    ["이번달 지출", won.format(data.expenseTotal), false, "expenses"],
    ["전월 이월", won.format(data.carryover), data.carryover < 0, "analysis"],
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
  const order = ["카드(원)", "카드(수)", "원 계좌이체", "수연 계좌이체", "현금"];
  $("#methodList").innerHTML = order.map((group) => {
    const value = totalForPaymentLabel(data, group);
    const width = data.expenseTotal > 0 ? Math.max(Math.round((value / data.expenseTotal) * 100), 0) : 0;
    return `
      <button class="method-row" data-dashboard-action="method" data-dashboard-value="${escapeHtml(group)}" type="button">
        <strong>${group}</strong>
        <div class="bar"><span style="width:${width}%"></span></div>
        <span class="amount">${won.format(value)}</span>
      </button>
    `;
  }).join("");
}

function renderRecentList() {
  const list = $("#recentList");
  if (!list) return;
  const rows = state.expenses
    .filter((row) => inMonth(row, currentMonth()))
    .slice()
    .sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`))
    .slice(0, 5);
  list.innerHTML = rows.length ? rows.map((row) => {
    return `
      <button class="recent-item" data-dashboard-action="category" data-dashboard-value="${escapeHtml(row.category)}" type="button">
        <span class="recent-dot" style="background:${categoryColor(row.category)}"></span>
        <span class="recent-main">
          <strong>${escapeHtml(row.category)}</strong>
          <small>${shortDateLabel(row.date)} · ${escapeHtml(row.payment)}</small>
        </span>
        <b class="${isCancellationExpense(row) ? "positive" : ""}">${formatExpenseAmount(row)}</b>
      </button>
    `;
  }).join("") : `<p class="empty-card">이번 달 기록이 아직 없어요.</p>`;
}

function renderCardTargetMini() {
  const entries = cardTargetEntries();
  if (!entries.some((entry) => entry.name === activeCardUsageName)) activeCardUsageName = "";
  const activeEntry = entries.find((entry) => entry.name === activeCardUsageName);
  const detail = activeEntry ? (() => {
    const target = activeEntry.phase === "2차" ? activeEntry.secondary : activeEntry.primary;
    const status = target > 0
      ? activeEntry.remaining > 0
        ? `${won.format(activeEntry.remaining)} 남음`
        : "목표 달성"
      : "목표 없음";
    return `
      <div class="target-mini-detail">
        <div>
          <span>${escapeHtml(activeEntry.name)} 사용액</span>
          <strong>${won.format(activeEntry.used)}</strong>
        </div>
        <div>
          <span>${target ? `${escapeHtml(activeEntry.phase)} 목표` : "목표"}</span>
          <strong>${target ? won.format(target) : "미설정"}</strong>
        </div>
        <div>
          <span>상태</span>
          <strong>${escapeHtml(status)}</strong>
        </div>
        <button class="ghost-button target-detail-button" data-dashboard-action="card-usage-list" data-dashboard-value="${escapeHtml(activeEntry.name)}" type="button">내역 보기</button>
      </div>
    `;
  })() : "";
  $("#cardTargetMini").innerHTML = entries.length ? `
    ${entries.map(({ name, rate }) => `
      <button class="target-mini-card ${name === activeCardUsageName ? "active" : ""}" data-dashboard-action="card-usage" data-dashboard-value="${escapeHtml(name)}" title="${escapeHtml(name)} 사용 상세 보기" type="button">
        <div>
          <span>${escapeHtml(name)}</span>
          <strong>${rate}%</strong>
        </div>
        <div class="mini-progress" aria-hidden="true"><span style="width:${rate}%"></span></div>
      </button>
    `).join("")}
    ${detail}
  ` : `<p class="empty-card card-usage-empty">이번 달 카드 지출이 아직 없어요.</p>`;
}

function renderChart() {
  const panel = $("#categoryBreakdown");
  const data = monthlyData();
  const entries = Object.entries(data.categoryTotals).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  if (!panel) return;
  if (!entries.length || !data.expenseTotal) {
    panel.innerHTML = `<p class="empty-card">이번 달 지출이 아직 없어요.</p>`;
    return;
  }
  const topTotal = entries.slice(0, 5).reduce((total, [, value]) => total + value, 0);
  const otherTotal = Math.max(data.expenseTotal - topTotal, 0);
  const rows = [
    ...entries.slice(0, 5),
    ...(otherTotal > 0 ? [["그 외", otherTotal]] : []),
  ];
  panel.innerHTML = `
    ${rows.map(([label, value], index) => {
      const percent = Math.round((value / data.expenseTotal) * 100);
      return `
        <button class="category-breakdown-row" data-dashboard-action="category" data-dashboard-value="${label === "그 외" ? "" : escapeHtml(label)}" type="button">
          <span class="category-rank">${index + 1}</span>
          <span class="category-breakdown-main">
            <span><i style="background:${categoryColor(label)}"></i>${escapeHtml(label)}</span>
            <b>${won.format(value)} · ${percent}%</b>
          </span>
          <span class="category-breakdown-bar"><i style="width:${percent}%; background:${categoryColor(label)}"></i></span>
        </button>
      `;
    }).join("")}
  `;
}

function renderExpenses() {
  const rows = state.expenses
    .filter((row) => inMonth(row, currentMonth()))
    .filter((row) => !expenseFilters.category || row.category === expenseFilters.category)
    .filter((row) => !expenseFilters.method || row.method === expenseFilters.method)
    .filter((row) => !expenseFilters.payment || row.payment === expenseFilters.payment)
    .filter((row) => !expenseFilters.source || row.source === expenseFilters.source)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const tableBody = $("#expenseRows");
  tableBody.className = `compact-expense-rows ${expenseViewMode}-view`;
  tableBody.innerHTML = rows.length ? renderExpenseRows(rows) : `<tr><td class="empty" colspan="9">내역 없음</td></tr>`;
}

function renderExpenseRows(rows) {
  if (expenseViewMode === "all") return rows.map(renderExpenseRow).join("");
  const labels = {
    date: "날짜",
    category: "카테고리",
    method: "결제수단",
    card: "카드사",
  };
  const grouped = rows.reduce((map, row) => {
    const key = expenseViewMode === "date"
      ? row.date
      : expenseViewMode === "category"
        ? row.category
        : expenseViewMode === "card"
          ? row.payment
          : row.method;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const entries = [...grouped.entries()].sort((a, b) => {
    if (expenseViewMode === "date") return b[0].localeCompare(a[0]);
    return expenseSum(b[1]) - expenseSum(a[1]);
  });
  if (!expenseGroupFilter) {
    return entries.map(([label, groupRows]) => `
      <tr class="group-row">
        <td colspan="9">
          <button class="group-filter-button" data-group-filter="${escapeHtml(label)}" type="button">
            <strong>${escapeHtml(label)}</strong><span>${labels[expenseViewMode]} 합계 ${won.format(expenseSum(groupRows))} · ${groupRows.length}건</span>
          </button>
        </td>
      </tr>
    `).join("");
  }
  const selectedRows = grouped.get(expenseGroupFilter) || [];
  const visibleRows = selectedRows.slice(0, expenseVisibleLimit);
  const remaining = selectedRows.length - visibleRows.length;
  return `
    <tr class="group-row">
      <td colspan="9">
        <div class="group-selection">
          <div><strong>${escapeHtml(expenseGroupFilter)}</strong><span>${won.format(expenseSum(selectedRows))} · ${selectedRows.length}건</span></div>
          <button class="group-clear-button" data-clear-group-filter="true" type="button">목록으로</button>
        </div>
      </td>
    </tr>
    ${visibleRows.map(renderExpenseRow).join("")}
    ${remaining > 0 ? `
      <tr class="load-more-row">
        <td colspan="9"><button class="ghost-button load-more-button" data-load-more-expenses="true" type="button">더보기 ${Math.min(10, remaining)}건</button></td>
      </tr>
    ` : ""}
  `;
}

function renderExpenseRow(row) {
  return `
    <tr class="${isCancellationExpense(row) ? "cancellation-row" : ""}">
      <td>${row.date}</td>
      <td>${escapeHtml(row.category)}</td>
      <td class="amount">${formatExpenseAmount(row)}</td>
      <td>${escapeHtml(row.method)}</td>
      <td class="payment-cell">
        <span class="soft-badge payment-badge" style="background:${paymentColor(row)}">${escapeHtml(row.payment)}</span>
      </td>
      <td class="source-cell"></td>
      <td class="expense-memo">${escapeHtml(row.memo)}</td>
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
  const groupOrder = ["카드(원)", "카드(수)", "원 계좌이체", "수연 계좌이체", "현금"];
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
      <td class="amount">${value < 0 ? formatSignedWon(Math.abs(value)) : won.format(value)}</td>
      <td class="amount">${data.expenseTotal > 0 && value > 0 ? `${((value / data.expenseTotal) * 100).toFixed(1)}%` : value < 0 ? "취소" : "0.0%"}</td>
    </tr>
  `).join("");

  $("#groupRows").innerHTML = groupOrder.map((group) => `
    <tr>
      <td>${group}</td>
      <td class="amount">${won.format(totalForPaymentLabel(data, group))}</td>
    </tr>
  `).join("");
}

function budgetEntries(data = monthlyData()) {
  const budgets = state.settings.monthlyBudgets || {};
  return [
    ...budgetSettingNames().filter((name) => name !== "저축").map((name) => ({
      name,
      target: Number(budgets[name] || 0),
      actual: Number(data.categoryTotals[name] || 0),
      type: "expense",
    })),
    ...(!state.settings.budgetExcludedCategories.includes("저축") ? [{
      name: "저축",
      target: Number(budgets["저축"] || 0),
      actual: data.savingsTotal,
      type: "saving",
    }] : []),
  ];
}

function budgetSettingNames() {
  const excluded = new Set(state.settings.budgetExcludedCategories || []);
  return [...new Set([
    ...state.settings.categories.filter((name) => name !== "저축" && name !== CANCELLATION_CATEGORY),
    ...(state.settings.budgetCustomCategories || []),
    "저축",
  ])].filter((name) => !excluded.has(name));
}

function budgetDetailItems(category) {
  return state.settings.monthlyBudgetDetails?.[category] || [];
}

function ensureBudgetDetailItems(category) {
  if (budgetDetailItems(category).length) return;
  const currentTotal = Number(state.settings.monthlyBudgets?.[category] || 0);
  const suggestions = DEFAULT_BUDGET_DETAILS[category] || [];
  const items = suggestions.map((name) => ({ id: newId("budget-detail"), name, amount: 0 }));
  if (currentTotal > 0) items.push({ id: newId("budget-detail"), name: "기존 예산", amount: currentTotal });
  if (!items.length) items.push({ id: newId("budget-detail"), name: "", amount: currentTotal });
  state.settings.monthlyBudgetDetails[category] = items;
}

function syncBudgetDetailTotal(category) {
  const total = budgetDetailItems(category).reduce((sumValue, item) => sumValue + Math.max(Number(item.amount) || 0, 0), 0);
  state.settings.monthlyBudgets[category] = total;
}

function renderBudgetDetailDialog() {
  const category = activeBudgetDetailCategory;
  if (!category) return;
  const items = budgetDetailItems(category);
  const total = items.reduce((sumValue, item) => sumValue + Number(item.amount || 0), 0);
  $("#budgetDetailDialogTitle").textContent = `${category} 세부 예산`;
  $("#budgetDetailTotal").textContent = `합계 ${won.format(total)}`;
  $("#budgetDetailRows").innerHTML = items.map((item) => `
    <div class="budget-detail-row">
      <input data-budget-detail-name="${item.id}" type="text" value="${escapeHtml(item.name)}" placeholder="세부 항목" aria-label="${escapeHtml(category)} 세부 항목 이름" />
      <input data-budget-detail-amount="${item.id}" type="number" min="0" step="10000" value="${Number(item.amount || 0)}" aria-label="${escapeHtml(item.name || category)} 예산 금액" />
      <button class="delete-button" data-delete-budget-detail="${item.id}" type="button" aria-label="세부 항목 삭제">×</button>
    </div>
  `).join("");
}

function openBudgetDetailDialog(category) {
  if (!budgetSettingNames().includes(category)) return;
  activeBudgetDetailCategory = category;
  ensureBudgetDetailItems(category);
  syncBudgetDetailTotal(category);
  saveState();
  renderBudgetDetailDialog();
  renderBudget();
  renderSettings();
  const dialog = $("#budgetDetailDialog");
  if (dialog?.showModal) dialog.showModal();
}

function closeBudgetDetailDialog() {
  closePickerDialog("budgetDetailDialog");
  activeBudgetDetailCategory = "";
}

function addBudgetDetail() {
  if (!activeBudgetDetailCategory) return;
  state.settings.monthlyBudgetDetails[activeBudgetDetailCategory].push({
    id: newId("budget-detail"),
    name: "",
    amount: 0,
  });
  saveState();
  renderBudgetDetailDialog();
}

function addBudgetCategory() {
  const field = $("#newBudgetCategory");
  const name = field.value.trim();
  if (!name) return;
  state.settings.budgetExcludedCategories = state.settings.budgetExcludedCategories.filter((item) => item !== name);
  if (!state.settings.categories.includes(name) && name !== "저축" && !state.settings.budgetCustomCategories.includes(name)) {
    state.settings.budgetCustomCategories.push(name);
  }
  field.value = "";
  saveState();
  renderBudget();
  renderSettings();
}

function removeBudgetCategory(name) {
  if (!name) return;
  if (!state.settings.budgetExcludedCategories.includes(name)) state.settings.budgetExcludedCategories.push(name);
  state.settings.budgetCustomCategories = state.settings.budgetCustomCategories.filter((item) => item !== name);
  saveState();
  renderBudget();
  renderSettings();
}

function renderSavings(data = monthlyData()) {
  const initialField = $("#savingsInitialAmount");
  if (!initialField) return;
  const savingsRows = state.savings || [];
  const selectedType = SAVINGS_TYPES.includes(activeSavingsType) ? activeSavingsType : SAVINGS_TYPES[0];
  const detailOptions = savingsDetailsForType(selectedType);
  if (activeSavingsDetail !== "전체" && !detailOptions.includes(activeSavingsDetail)) activeSavingsDetail = "전체";
  const typeRowsAll = savingsRows.filter((row) => (row.type || SAVINGS_TYPES[0]) === selectedType);
  const typeRows = activeSavingsDetail === "전체"
    ? typeRowsAll
    : typeRowsAll.filter((row) => (row.detail || "기본") === activeSavingsDetail);
  const typeInitialAmount = Number(state.settings.savingsInitialAmounts?.[selectedType] || 0);
  const typeMonthTotal = sum(typeRowsAll.filter((row) => inMonth(row, data.month)));
  const typeBalance = typeInitialAmount + sum(typeRowsAll);
  initialField.value = typeInitialAmount || "";
  optionList($("#savingsDetail"), detailOptions, detailOptions.includes($("#savingsDetail").value) ? $("#savingsDetail").value : detailOptions[0]);
  optionList($("#savingsWithdrawDetail"), detailOptions, detailOptions.includes($("#savingsWithdrawDetail").value) ? $("#savingsWithdrawDetail").value : detailOptions[0]);
  const savingsPageMonth = $("#savingsPageMonth");
  if (savingsPageMonth) savingsPageMonth.textContent = monthLabel(data.month);
  $("#savingsMonthLabel").textContent = `${monthLabel(data.month)} · ${selectedType}`;
  $("#savingsBalance").textContent = won.format(typeBalance);
  $("#savingsMonthTotal").textContent = won.format(typeMonthTotal);
  $("#savingsTypeTabs").innerHTML = SAVINGS_TYPES.map((type) => {
    const initial = Number(state.settings.savingsInitialAmounts?.[type] || 0);
    const balance = initial + sum(savingsRows.filter((row) => (row.type || SAVINGS_TYPES[0]) === type));
    return `
      <button class="savings-type-tab ${type === selectedType ? "active" : ""}" data-savings-type="${escapeHtml(type)}" type="button">
        <span>${escapeHtml(type)}</span>
        <strong>${won.format(balance)}</strong>
      </button>
    `;
  }).join("");
  $("#savingsDetailTabs").innerHTML = ["전체", ...detailOptions].map((detail) => {
    const rowsForDetail = detail === "전체" ? typeRowsAll : typeRowsAll.filter((row) => (row.detail || "기본") === detail);
    const detailTotal = detail === "전체" ? typeBalance : sum(rowsForDetail);
    return `
      <button class="savings-detail-tab ${detail === activeSavingsDetail ? "active" : ""}" data-savings-detail="${escapeHtml(detail)}" type="button">
        <span>${escapeHtml(detail)}</span>
        <strong>${won.format(detailTotal)}</strong>
      </button>
    `;
  }).join("");
  $("#savingsRows").innerHTML = typeRows.length ? typeRows
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((row) => `
      <div class="savings-row ${row.amount < 0 ? "withdrawal" : ""}">
        <span>${shortDateLabel(row.date)}</span>
        <strong>${won.format(row.amount)}</strong>
        <small>${escapeHtml(row.detail || "기본")}</small>
        <em>${escapeHtml(row.memo || (row.amount < 0 ? "저금 인출" : "저금"))}</em>
        <button class="delete-button" data-delete-saving="${row.id}" type="button">삭제</button>
      </div>
    `).join("") : `<p class="empty-card">${escapeHtml(selectedType)} 기록이 없어요.</p>`;
}

function addSavings() {
  const amount = Math.max(Number($("#savingsAmount").value || 0), 0);
  if (!amount) return;
  state.savings.push({
    id: newId("saving"),
    date: defaultDateForMonth(),
    amount,
    type: activeSavingsType,
    detail: $("#savingsDetail").value || "기본",
    memo: $("#savingsMemo").value.trim(),
  });
  $("#savingsAmount").value = "";
  $("#savingsMemo").value = "";
  saveState();
  renderAll();
}

function withdrawSavings() {
  const amount = Math.max(Number($("#savingsWithdrawAmount").value || 0), 0);
  if (!amount) return;
  const typeRows = (state.savings || []).filter((row) => (row.type || SAVINGS_TYPES[0]) === activeSavingsType);
  const typeBalance = Number(state.settings.savingsInitialAmounts?.[activeSavingsType] || 0) + sum(typeRows);
  if (amount > typeBalance) {
    alert(`${activeSavingsType}에 ${won.format(typeBalance)}만 있어요.`);
    return;
  }
  const date = $("#savingsWithdrawDate").value || defaultDateForMonth();
  const detail = $("#savingsWithdrawDetail").value || "기본";
  const memo = $("#savingsWithdrawMemo").value.trim() || "저금 인출";
  const transferId = newId("savings-transfer");
  if (!state.settings.incomeTypes.includes("저금 인출")) state.settings.incomeTypes.push("저금 인출");
  state.savings.push({
    id: newId("saving"),
    date,
    amount: -amount,
    type: activeSavingsType,
    detail,
    memo,
    transferId,
  });
  state.incomes.push({
    id: newId("income"),
    date,
    amount,
    type: "저금 인출",
    memo,
    savingsTransferId: transferId,
  });
  $("#savingsWithdrawAmount").value = "";
  $("#savingsWithdrawMemo").value = "";
  $("#savingsWithdrawDate").value = defaultDateForMonth();
  saveState();
  renderAll();
}

function updateSavingsInitialAmount() {
  state.settings.savingsInitialAmounts[activeSavingsType] = Math.max(Number($("#savingsInitialAmount").value || 0), 0);
  state.settings.savingsInitialAmount = Object.values(state.settings.savingsInitialAmounts).reduce((total, amount) => total + Number(amount || 0), 0);
  saveState();
  renderAll();
}

function activateSavingsType(type) {
  if (!SAVINGS_TYPES.includes(type)) return;
  activeSavingsType = type;
  activeSavingsDetail = "전체";
  renderSavings();
}

function activateSavingsDetail(detail) {
  if (detail !== "전체" && !savingsDetailsForType().includes(detail)) return;
  activeSavingsDetail = detail;
  renderSavings();
}

function addSavingsDetail() {
  const field = $("#newSavingsDetail");
  const detail = field.value.trim();
  if (!detail) return;
  if (detail.length > 12) {
    alert("세부항목은 12자까지만 가능해요.");
    return;
  }
  const details = savingsDetailsForType(activeSavingsType);
  if (details.includes(detail)) {
    field.value = "";
    activeSavingsDetail = detail;
    renderSavings();
    return;
  }
  if (!state.settings.savingsDetails[activeSavingsType]) state.settings.savingsDetails[activeSavingsType] = [];
  state.settings.savingsDetails[activeSavingsType].push(detail);
  activeSavingsDetail = detail;
  field.value = "";
  saveState();
  renderAll();
}

function editDashboardMemo() {
  const current = state.settings.dashboardMemo || DEFAULT_DASHBOARD_TITLE;
  const next = prompt("우리집 이번달 메모를 입력해줘. 10자까지 저장돼요. 빈칸이면 기본 문구로 돌아가요.", current);
  if (next === null) return;
  const memo = next.trim();
  if (memo.length > DASHBOARD_MEMO_LIMIT) {
    alert("메모는 10자까지만 가능해요.");
    return;
  }
  state.settings.dashboardMemo = memo || DEFAULT_DASHBOARD_TITLE;
  saveState();
  renderSummary();
}

function renderBudget() {
  const data = monthlyData();
  const entries = budgetEntries(data);
  const expenseEntries = entries.filter((entry) => entry.type === "expense");
  const totalTarget = expenseEntries.reduce((total, entry) => total + entry.target, 0);
  const totalActual = expenseEntries.reduce((total, entry) => total + entry.actual, 0);
  const remaining = totalTarget - totalActual;
  $("#budgetMonth").textContent = monthLabel(data.month);
  $("#budgetTotalTarget").textContent = won.format(totalTarget);
  $("#budgetTotalActual").textContent = won.format(totalActual);
  $("#budgetTotalStatus").textContent = !totalTarget
    ? "예산 설정 필요"
    : remaining >= 0
      ? `${won.format(remaining)} 남음`
      : `${won.format(Math.abs(remaining))} 초과`;
  $("#budgetTotalStatus").classList.toggle("over", remaining < 0);
  renderSavings(data);
  $("#budgetRows").innerHTML = entries.map((entry) => {
    const rate = entry.target ? Math.round((entry.actual / entry.target) * 100) : 0;
    const difference = entry.target - entry.actual;
    const isOver = entry.type === "expense" && entry.target > 0 && difference < 0;
    const achieved = entry.type === "saving" && entry.target > 0 && difference <= 0;
    const status = !entry.target
      ? "목표 미설정"
      : entry.type === "saving"
        ? achieved
          ? `${won.format(Math.abs(difference))} 더 모음`
          : `${won.format(difference)} 부족`
        : isOver
          ? `${won.format(Math.abs(difference))} 초과`
          : `${won.format(difference)} 아낌`;
    return `
      <article class="budget-row ${isOver ? "over" : ""} ${achieved ? "achieved" : ""}">
        <div class="budget-row-head">
          <div>
            <span class="category-dot" style="background:${entry.type === "saving" ? "#8FCFA4" : categoryColor(entry.name)}"></span>
            <strong>${escapeHtml(entry.name)}</strong>
          </div>
          <em>${escapeHtml(status)}</em>
        </div>
        <div class="budget-amounts">
          <strong>${won.format(entry.actual)}</strong>
          <span>/ ${won.format(entry.target)}</span>
        </div>
        <div class="budget-progress" aria-label="${escapeHtml(entry.name)} ${rate}%">
          <span style="width:${Math.min(rate, 100)}%"></span>
        </div>
      </article>
    `;
  }).join("");
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
  $("#monthlyBudgetRows").innerHTML = budgetSettingNames().map((name) => `
    <div class="budget-setting-card">
      <button class="budget-setting-row" data-budget-detail-open="${escapeHtml(name)}" type="button">
        <span><i style="background:${name === "저축" ? "#8FCFA4" : categoryColor(name)}"></i>${escapeHtml(name)}</span>
        <span class="budget-setting-summary">
          <strong>${won.format(Number(state.settings.monthlyBudgets?.[name] || 0))}</strong>
          <small>${budgetDetailItems(name).length ? `${budgetDetailItems(name).length}개 항목 · 수정` : "눌러서 수정"}</small>
        </span>
        <b aria-hidden="true">›</b>
      </button>
      <button class="budget-setting-remove" data-remove-budget-category="${escapeHtml(name)}" type="button">제거</button>
    </div>
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
  renderRecentList();
  renderChart();
  renderEventAlert();
  renderCalendar();
  renderExpenses();
  renderIncomes();
  renderAnalysis();
  renderBudget();
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

function resetExpenseForm(preferredDate = "", preferredMethod = "", preferredPayment = "") {
  editingExpenseId = null;
  const nextDate = preferredDate && preferredDate.startsWith(currentMonth()) ? preferredDate : defaultDateForMonth();
  $("#expenseForm").reset();
  $("#expenseDate").value = nextDate;
  if (PAYMENT_METHODS.includes(preferredMethod)) $("#expenseMethod").value = preferredMethod;
  $("#expenseSource").value = "공용";
  updatePaymentOptions(preferredPayment);
  setExpenseCancelToggle(false);
  renderExpenseSourceSegment();
  setExpenseEditMode(false);
}

function resetIncomeForm(preferredDate = "") {
  editingIncomeId = null;
  const nextDate = preferredDate && preferredDate.startsWith(currentMonth()) ? preferredDate : defaultDateForMonth();
  $("#incomeForm").reset();
  $("#incomeDate").value = nextDate;
  renderIncomeTypePicker();
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
  renderCategoryPicker();
  $("#expenseAmount").value = row.amount;
  $("#expenseMethod").value = row.method;
  updatePaymentOptions(row.payment);
  $("#expenseCard").value = row.payment;
  setExpenseCancelToggle(isCancellationExpense(row));
  $("#expenseSource").value = row.source || "공용";
  renderExpenseSourceSegment();
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
  renderIncomeTypePicker();
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
    source: $("#expenseSource").value || "공용",
    cancelled: $("#expenseCancelToggle")?.getAttribute("aria-pressed") === "true",
    memo: $("#expenseMemo").value.trim(),
  };
  if (editingExpenseId) {
    state.expenses = state.expenses.map((row) => row.id === editingExpenseId ? nextRow : row);
  } else {
    state.expenses.push(nextRow);
  }
  saveState();
  resetExpenseForm(nextRow.date, nextRow.method, nextRow.payment);
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
      const rawPayment = row["상세수단"] || row["카드사"] || row["결제수단상세"] || row["상세결제수단"] || row["카드"] || "";
      const legacyAllowance = ["원 용돈", "수연이 용돈"].includes(rawPayment) ? rawPayment : "";
      const sourceValue = row["지출구분"] || row["용돈구분"] || row["구분"] || legacyAllowance || "공용";
      const allowancePayment = allowanceCardForSource(legacyAllowance || sourceValue);
      const payment = allowancePayment || (rawPayment === "국체(수)" || rawPayment === "국제(수)" ? "국민(수)" : rawPayment);
      const item = getPaymentItem(payment) || getPaymentItemByGroup(row["카드그룹"]);
      const method = item?.method || row["결제수단"] || "카드(원)";
      return {
        id: newId("expense-import"),
        date: parseDate(row["날짜"]),
        category: row["카테고리"] || "기타",
        amount: parseMoney(row["금액"]),
        method,
        payment: payment || item?.name || "",
        source: "공용",
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
  const savingsWithdrawDate = $("#savingsWithdrawDate");
  if (savingsWithdrawDate) savingsWithdrawDate.value = defaultDateForMonth(month);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `원수살림-${currentMonth()}.json`;
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

function openExpenseList({ view = "all", category = "", method = "", payment = "", source = "", group = "" } = {}) {
  activateView("expenses");
  expenseFilters = { category, method, payment, source };
  expenseViewMode = view;
  expenseGroupFilter = group;
  expenseVisibleLimit = 10;
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
  if (action === "budget") {
    activateView("budget");
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
  if (action === "card-usage") {
    activeCardUsageName = activeCardUsageName === value ? "" : value;
    renderCardTargetMini();
    return;
  }
  if (action === "card-usage-list") {
    if (value) openExpenseList({ payment: value });
    return;
  }
  if (action === "method") openPaymentLabel(value);
}

function activateView(viewName, options = {}) {
  const view = $(`#${viewName}View`);
  if (!view) return;
  const currentView = activeViewName();
  const shouldTrack = options.track !== false && currentView !== viewName;
  if (shouldTrack && currentView) viewHistory.push(currentView);
  $$(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  $$(".view").forEach((item) => item.classList.toggle("active", item === view));
  setMenuOpen(false);
  renderChart();
}

function activeViewName() {
  return $(".nav-tab.active")?.dataset.view || "dashboard";
}

function navigateViewByOffset(offset) {
  const tabs = $$(".nav-tab");
  const index = tabs.findIndex((button) => button.dataset.view === activeViewName());
  const nextIndex = Math.min(Math.max(index + offset, 0), tabs.length - 1);
  if (nextIndex !== index && tabs[nextIndex]) activateView(tabs[nextIndex].dataset.view);
}

function goBackView() {
  const previous = viewHistory.pop();
  if (previous) activateView(previous, { track: false });
  else activateView("dashboard", { track: false });
}

function goDashboard() {
  viewHistory = [];
  activateView("dashboard", { track: false });
}

function renderMonthStepper() {
  const label = $("#monthStepperLabel");
  if (!label) return;
  const [, monthNo] = currentMonth().split("-").map(Number);
  label.textContent = `${monthNo}월`;
}

function shiftCurrentMonth(offset) {
  const [year, month] = currentMonth().split("-").map(Number);
  const next = new Date(year, month - 1 + Number(offset || 0), 1);
  $("#monthPicker").value = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
  setDefaultDates();
  renderAll();
}

function setMenuOpen(open) {
  const shell = $(".sidebar");
  const button = $("#menuToggle");
  if (!shell || !button) return;
  shell.classList.toggle("menu-open", open);
  button.setAttribute("aria-expanded", String(open));
}

function shouldIgnoreSwipe(event) {
  return Boolean(closestTarget(event, "button,input,select,textarea,label,dialog,.table-scroll,.nav-tabs,.mobile-top-controls"));
}

function handleSwipeStart(event) {
  const touch = event.touches?.[0];
  if (!touch) return;
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
  swipeStartedOnInteractive = shouldIgnoreSwipe(event);
}

function handleSwipeEnd(event) {
  if (swipeStartedOnInteractive) return;
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  const deltaX = touch.clientX - swipeStartX;
  const deltaY = touch.clientY - swipeStartY;
  if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
  navigateViewByOffset(deltaX < 0 ? 1 : -1);
}

function activateExpenseView(viewName) {
  expenseViewMode = viewName;
  expenseGroupFilter = null;
  expenseVisibleLimit = 10;
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
  setupCloud();
}

document.addEventListener("click", (event) => {
  const categoryChoice = closestTarget(event, "[data-category-choice]");
  if (categoryChoice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectExpenseCategory(categoryChoice.dataset.categoryChoice);
    return;
  }

  const paymentMethodChoice = closestTarget(event, "[data-payment-method-choice]");
  if (paymentMethodChoice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectExpenseMethod(paymentMethodChoice.dataset.paymentMethodChoice);
    return;
  }

  const paymentCardChoice = closestTarget(event, "[data-payment-card-choice]");
  if (paymentCardChoice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectExpenseCard(paymentCardChoice.dataset.paymentCardChoice);
    return;
  }

  const expenseFilterChoice = closestTarget(event, "[data-expense-filter-choice]");
  if (expenseFilterChoice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectExpenseFilter(expenseFilterChoice.dataset.expenseFilterChoice);
    return;
  }

  const incomeTypeChoice = closestTarget(event, "[data-income-type-choice]");
  if (incomeTypeChoice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectIncomeType(incomeTypeChoice.dataset.incomeTypeChoice);
    return;
  }

  const expenseSourceChoice = closestTarget(event, "[data-expense-source-choice]");
  if (expenseSourceChoice) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectExpenseSource(expenseSourceChoice.dataset.expenseSourceChoice);
    return;
  }

  const expenseFilterPicker = closestTarget(event, "[data-filter-picker]");
  if (expenseFilterPicker) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openExpenseFilterPicker(expenseFilterPicker.dataset.filterPicker);
    return;
  }

  const budgetDetailOpen = closestTarget(event, "[data-budget-detail-open]");
  if (budgetDetailOpen) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openBudgetDetailDialog(budgetDetailOpen.dataset.budgetDetailOpen);
    return;
  }

  const removeBudgetCategoryName = closestTarget(event, "[data-remove-budget-category]")?.dataset.removeBudgetCategory;
  if (removeBudgetCategoryName) {
    event.preventDefault();
    event.stopImmediatePropagation();
    removeBudgetCategory(removeBudgetCategoryName);
    return;
  }

  const deleteBudgetDetailId = closestTarget(event, "[data-delete-budget-detail]")?.dataset.deleteBudgetDetail;
  if (deleteBudgetDetailId && activeBudgetDetailCategory) {
    event.preventDefault();
    event.stopImmediatePropagation();
    state.settings.monthlyBudgetDetails[activeBudgetDetailCategory] = budgetDetailItems(activeBudgetDetailCategory)
      .filter((item) => item.id !== deleteBudgetDetailId);
    syncBudgetDetailTotal(activeBudgetDetailCategory);
    saveState();
    renderBudgetDetailDialog();
    renderBudget();
    renderSettings();
    return;
  }

  const deleteSavingId = closestTarget(event, "[data-delete-saving]")?.dataset.deleteSaving;
  if (deleteSavingId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const savingRow = (state.savings || []).find((row) => row.id === deleteSavingId);
    state.savings = (state.savings || []).filter((row) => row.id !== deleteSavingId);
    if (savingRow?.transferId) {
      state.incomes = state.incomes.filter((row) => row.savingsTransferId !== savingRow.transferId);
    }
    saveState();
    renderAll();
    return;
  }

  const savingsTypeButton = closestTarget(event, "[data-savings-type]");
  if (savingsTypeButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activateSavingsType(savingsTypeButton.dataset.savingsType);
    return;
  }

  const savingsDetailButton = closestTarget(event, "[data-savings-detail]");
  if (savingsDetailButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activateSavingsDetail(savingsDetailButton.dataset.savingsDetail);
    return;
  }

  const dashboardMemoButton = closestTarget(event, "[data-edit-dashboard-memo]");
  if (dashboardMemoButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    editDashboardMemo();
    return;
  }

  const navTab = closestTarget(event, "[data-view]");
  if (navTab) {
    event.stopImmediatePropagation();
    activateView(navTab.dataset.view);
    return;
  }

  const monthShift = closestTarget(event, "[data-month-shift]");
  if (monthShift) {
    event.preventDefault();
    event.stopImmediatePropagation();
    shiftCurrentMonth(monthShift.dataset.monthShift);
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
      expenseFilters = { category: "", method: "", payment: "", source: "" };
      expenseGroupFilter = null;
      expenseVisibleLimit = 10;
      renderExpenseFilters();
      renderExpenses();
    },
    menuToggle: () => setMenuOpen(!$(".sidebar")?.classList.contains("menu-open")),
    mobileHomeButton: goDashboard,
    expenseCancelToggle: toggleExpenseCancel,
    addExpense: () => $("#expenseForm")?.requestSubmit(),
    addIncome: () => $("#incomeForm")?.requestSubmit(),
    addSavingsDetail,
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
    settingsExportJson: downloadJson,
    resetSample: () => {
      if (!confirm("빈 가계부로 초기화할까요? 현재 저장 내용은 백업으로 남겨둘게요.")) return;
      state = clone(sampleState);
      saveState();
      boot();
    },
    restoreBackup,
    openBudgetSettings: () => {
      activateView("settings");
      activateSettingsTab("budget");
    },
    addSavings,
    withdrawSavings,
    addBudgetDetail,
    addBudgetCategory,
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

on(".main", "touchstart", handleSwipeStart);
on(".main", "touchend", handleSwipeEnd);

on("#monthPicker", "change", () => {
  setDefaultDates();
  renderAll();
});
on("#expenseDate", "change", (event) => {
  moveToDateMonth(event.target.value);
  renderAll();
});
on("#expenseCategoryPickerButton", "click", openCategoryPicker);
on("#closeCategoryDialog", "click", closeCategoryPicker);
on("#categoryDialog", "click", (event) => {
  if (event.target === $("#categoryDialog")) closeCategoryPicker();
});
on("#expenseMethodPickerButton", "click", () => openPickerDialog("paymentMethodDialog"));
on("#expenseCardPickerButton", "click", () => openPickerDialog("paymentCardDialog"));
on("#closePaymentMethodDialog", "click", () => closePickerDialog("paymentMethodDialog"));
on("#closePaymentCardDialog", "click", () => closePickerDialog("paymentCardDialog"));
on("#paymentMethodDialog", "click", (event) => {
  if (event.target === $("#paymentMethodDialog")) closePickerDialog("paymentMethodDialog");
});
on("#paymentCardDialog", "click", (event) => {
  if (event.target === $("#paymentCardDialog")) closePickerDialog("paymentCardDialog");
});
on("#closeExpenseFilterDialog", "click", () => closePickerDialog("expenseFilterDialog"));
on("#expenseFilterDialog", "click", (event) => {
  if (event.target === $("#expenseFilterDialog")) closePickerDialog("expenseFilterDialog");
});
on("#incomeTypePickerButton", "click", () => openPickerDialog("incomeTypeDialog"));
on("#closeIncomeTypeDialog", "click", () => closePickerDialog("incomeTypeDialog"));
on("#incomeTypeDialog", "click", (event) => {
  if (event.target === $("#incomeTypeDialog")) closePickerDialog("incomeTypeDialog");
});
on("#closeBudgetDetailDialog", "click", closeBudgetDetailDialog);
on("#closeBudgetDetailDone", "click", closeBudgetDetailDialog);
on("#budgetDetailDialog", "click", (event) => {
  if (event.target === $("#budgetDetailDialog")) closeBudgetDetailDialog();
});
on("#budgetDetailDialog", "close", () => {
  activeBudgetDetailCategory = "";
});
on("#incomeDate", "change", (event) => {
  moveToDateMonth(event.target.value);
  renderAll();
});
on("#expenseFilterCategory", "change", (event) => {
  expenseFilters.category = event.target.value;
  expenseGroupFilter = null;
  expenseVisibleLimit = 10;
  renderExpenses();
});
on("#expenseFilterMethod", "change", (event) => {
  expenseFilters.method = event.target.value;
  expenseGroupFilter = null;
  expenseVisibleLimit = 10;
  renderExpenseFilters();
  renderExpenses();
});
on("#expenseFilterPayment", "change", (event) => {
  expenseFilters.payment = event.target.value;
  expenseGroupFilter = null;
  expenseVisibleLimit = 10;
  renderExpenses();
});
on("#clearExpenseFilters", "click", () => {
  expenseFilters = { category: "", method: "", payment: "", source: "" };
  expenseGroupFilter = null;
  expenseVisibleLimit = 10;
  renderExpenseFilters();
  renderExpenses();
});
on("#addExpense", "click", () => $("#expenseForm").requestSubmit());
on("#addIncome", "click", () => $("#incomeForm").requestSubmit());
on("#addSavings", "click", addSavings);
on("#savingsInitialAmount", "change", updateSavingsInitialAmount);
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
    expenseVisibleLimit = 10;
    renderExpenses();
    return;
  }
  if (clearGroupFilter) {
    expenseGroupFilter = null;
    expenseVisibleLimit = 10;
    renderExpenses();
    return;
  }
  if (closestTarget(event, "[data-load-more-expenses]")) {
    expenseVisibleLimit += 10;
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
  if (incomeId) {
    const incomeRow = state.incomes.find((row) => row.id === incomeId);
    state.incomes = state.incomes.filter((row) => row.id !== incomeId);
    if (incomeRow?.savingsTransferId) {
      state.savings = (state.savings || []).filter((row) => row.transferId !== incomeRow.savingsTransferId);
    }
  }
  if (eventId) state.events = state.events.filter((row) => row.id !== eventId);
  if (category) {
    state.settings.categories = state.settings.categories.filter((item) => item !== category);
    delete state.settings.monthlyBudgets[category];
    delete state.settings.monthlyBudgetDetails[category];
  }
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
  const budgetDetailNameId = closestTarget(event, "[data-budget-detail-name]")?.dataset.budgetDetailName;
  const budgetDetailAmountId = closestTarget(event, "[data-budget-detail-amount]")?.dataset.budgetDetailAmount;
  if ((budgetDetailNameId || budgetDetailAmountId) && activeBudgetDetailCategory) {
    const detailId = budgetDetailNameId || budgetDetailAmountId;
    const detail = budgetDetailItems(activeBudgetDetailCategory).find((item) => item.id === detailId);
    if (!detail) return;
    if (budgetDetailNameId) detail.name = event.target.value.trim();
    if (budgetDetailAmountId) detail.amount = Math.max(Number(event.target.value || 0), 0);
    syncBudgetDetailTotal(activeBudgetDetailCategory);
    saveState();
    renderBudgetDetailDialog();
    renderBudget();
    renderSettings();
    return;
  }
  const budgetName = closestTarget(event, "[data-monthly-budget]")?.dataset.monthlyBudget;
  if (budgetName) {
    state.settings.monthlyBudgets[budgetName] = Math.max(Number(event.target.value || 0), 0);
    saveState();
    renderBudget();
    return;
  }
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
  renderPaymentPickers();
});

try {
  boot();
  registerServiceWorker();
} catch (error) {
  showError(`앱 실행 오류: ${error.message}`);
}

/* Investment values are tracked separately and never enter household cash-flow records. */
let tossSessionKey = null;
let tossRequest = null;
let stockQuoteRequest = null;
let editingInvestmentId = "";

const DOMESTIC_INVESTMENT_EXCHANGES = ["KRX", "KOSDAQ"];

function resetTossForSession() {
  const next = sharedSession?.lookupKey || null;
  if (tossSessionKey === next) return;
  tossSessionKey = next;
  tossRequest?.abort();
  tossRequest = null;
  document.querySelector("#tossTotals")?.replaceChildren();
  document.querySelector("#tossHoldings")?.replaceChildren();
  const hash = document.querySelector("#tossSetupHash");
  if (hash) hash.textContent = "";
  const status = document.querySelector("#tossStatus");
  if (status) status.textContent = next ? "불러오기를 누르면 최신 보유 자산을 조회해요." : "공유 로그인 후 이용해 주세요.";
}

async function tossViewerToken(session) {
  return sha256Hex(`원수살림-토스조회-v1:${session.lookupKey}:${session.secret}`);
}

function investmentMoney(amount, currency = "KRW") {
  if (amount === null || !Number.isFinite(Number(amount))) return "정보 없음";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(Number(amount));
}

function investmentPercent(value) {
  if (!Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function investmentQuoteDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function investmentPositions() {
  return state.settings.investmentPositions || [];
}

function positionMetrics(position) {
  const quantity = position.investedAmount / position.averagePrice;
  const value = position.lastPrice ? quantity * position.lastPrice : null;
  const profit = value === null ? null : value - position.investedAmount;
  const rate = profit === null ? null : (profit / position.investedAmount) * 100;
  return { quantity, value, profit, rate };
}

function profitClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
}

function renderManualInvestmentTotals() {
  const totals = document.querySelector("#manualInvestmentTotals");
  if (!totals) return;
  totals.replaceChildren();
  const groups = new Map();
  investmentPositions().forEach((position) => {
    const metrics = positionMetrics(position);
    const group = groups.get(position.currency) || { invested: 0, value: 0, quoted: 0 };
    group.invested += position.investedAmount;
    if (metrics.value !== null) {
      group.value += metrics.value;
      group.quoted += 1;
    }
    groups.set(position.currency, group);
  });
  groups.forEach((group, currency) => {
    const profit = group.quoted ? group.value - group.invested : null;
    const rate = profit === null || !group.invested ? null : (profit / group.invested) * 100;
    const card = document.createElement("section");
    card.className = "investment-total";
    const heading = document.createElement("h4");
    heading.textContent = currency === "KRW" ? "국내 주식" : "미국 주식";
    card.append(heading);
    [["투자금", investmentMoney(group.invested, currency)], ["현재 자산", group.quoted ? investmentMoney(group.value, currency) : "시세 확인 전"], ["평가손익", profit === null ? "—" : `${investmentMoney(profit, currency)} · ${investmentPercent(rate)}`]].forEach(([label, value], index) => {
      const row = document.createElement("div");
      const name = document.createElement("span");
      const amount = document.createElement("strong");
      name.textContent = label;
      amount.textContent = value;
      if (index === 2) amount.className = profitClass(profit);
      row.append(name, amount);
      card.append(row);
    });
    totals.append(card);
  });
}

function renderManualInvestmentHoldings() {
  const list = document.querySelector("#manualInvestmentHoldings");
  if (!list) return;
  list.replaceChildren();
  if (!investmentPositions().length) {
    const empty = document.createElement("div");
    empty.className = "manual-investment-empty";
    empty.innerHTML = "<strong>등록된 주식이 없어요</strong><span>종목코드와 투자금, 평균 매수가를 입력해보세요.</span>";
    list.append(empty);
    return;
  }
  investmentPositions().forEach((position) => {
    const metrics = positionMetrics(position);
    const card = document.createElement("article");
    card.className = "investment-position-card";
    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "investment-position-title";
    const name = document.createElement("strong");
    name.textContent = position.name || position.symbol;
    const market = document.createElement("span");
    market.className = "investment-market-badge";
    market.textContent = `${position.symbol} · ${position.exchange}`;
    title.append(name, market);
    const meta = document.createElement("span");
    meta.className = "investment-position-meta";
    meta.textContent = `${metrics.quantity.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주 · 평균 ${investmentMoney(position.averagePrice, position.currency)} · 현재 ${investmentMoney(position.lastPrice, position.currency)}`;
    info.append(title, meta);
    const value = document.createElement("div");
    value.className = `investment-position-value ${profitClass(metrics.profit)}`;
    const current = document.createElement("strong");
    current.textContent = metrics.value === null ? "시세 확인 전" : investmentMoney(metrics.value, position.currency);
    const change = document.createElement("span");
    change.textContent = metrics.profit === null ? "—" : `${investmentMoney(metrics.profit, position.currency)} · ${investmentPercent(metrics.rate)}`;
    value.append(current, change);
    const actions = document.createElement("div");
    actions.className = "investment-position-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.editInvestment = position.id;
    edit.textContent = "수정";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.dataset.deleteInvestment = position.id;
    remove.textContent = "삭제";
    actions.append(edit, remove);
    card.append(info, value, actions);
    list.append(card);
  });
}

function renderManualInvestments() {
  renderManualInvestmentTotals();
  renderManualInvestmentHoldings();
  const exchange = document.querySelector("#newInvestmentExchange")?.value || "KRX";
  const unit = DOMESTIC_INVESTMENT_EXCHANGES.includes(exchange) ? "원" : "달러";
  const amountHint = document.querySelector("#investmentCurrencyHint");
  const priceHint = document.querySelector("#investmentPriceCurrencyHint");
  if (amountHint) amountHint.textContent = unit;
  if (priceHint) priceHint.textContent = unit;
}

function resetInvestmentForm() {
  editingInvestmentId = "";
  document.querySelector("#investmentEntryForm")?.reset();
  const saveButton = document.querySelector("#saveInvestmentPosition");
  if (saveButton) saveButton.textContent = "종목 저장";
  document.querySelector("#cancelInvestmentEdit")?.classList.add("hidden");
  renderManualInvestments();
}

async function refreshStockQuotes(force = false) {
  const positions = investmentPositions();
  const status = document.querySelector("#stockQuoteStatus");
  if (!positions.length) {
    if (status) status.textContent = "종목을 등록하면 하루 한 번 시세를 확인해요.";
    return;
  }
  const quoteDate = investmentQuoteDate();
  const targets = force ? positions : positions.filter((position) => position.quoteDate !== quoteDate || !position.lastPrice);
  if (!targets.length) {
    const latest = positions.map((position) => position.quotedAt).filter(Boolean).sort().at(-1);
    if (status) status.textContent = `오늘 시세 반영 완료${latest ? ` · ${new Date(latest).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}` : ""}`;
    return;
  }
  if (stockQuoteRequest) return stockQuoteRequest;
  const button = document.querySelector("#refreshStockQuotes");
  if (button) button.disabled = true;
  if (status) status.textContent = "오늘 주식 시세를 확인하고 있어요.";
  const keys = targets.map((position) => `${position.symbol}:${position.exchange}`).join(",");
  stockQuoteRequest = (async () => {
    try {
      const response = await fetch(`/api/stock-quotes?symbols=${encodeURIComponent(keys)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "시세를 확인하지 못했어요.");
      const quoteMap = new Map((data.quotes || []).map((quote) => [`${quote.symbol}:${quote.exchange}`, quote]));
      state.settings.investmentPositions = positions.map((position) => {
        const quote = quoteMap.get(`${position.symbol}:${position.exchange}`);
        if (!quote) return position;
        return { ...position, name: position.name || quote.name, currency: quote.currency, lastPrice: quote.price, changePercent: quote.changePercent, quoteDate, quotedAt: quote.quotedAt };
      });
      saveState();
      renderManualInvestments();
      const failed = data.errors?.length || 0;
      if (status) status.textContent = `${data.quotes.length}개 종목 오늘 시세 반영${failed ? ` · ${failed}개 확인 실패` : ""} · ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}`;
    } catch (error) {
      if (status) status.textContent = `${error.message} 이전 시세가 있으면 그대로 표시해요.`;
    } finally {
      if (button) button.disabled = false;
      stockQuoteRequest = null;
    }
  })();
  return stockQuoteRequest;
}

function saveInvestmentPosition(event) {
  event.preventDefault();
  const exchange = document.querySelector("#newInvestmentExchange").value;
  const symbol = document.querySelector("#newInvestmentSymbol").value.trim().toUpperCase();
  const name = document.querySelector("#newInvestmentName").value.trim();
  const investedAmount = Number(document.querySelector("#newInvestmentAmount").value || 0);
  const averagePrice = Number(document.querySelector("#newInvestmentAveragePrice").value || 0);
  const domestic = DOMESTIC_INVESTMENT_EXCHANGES.includes(exchange);
  const validSymbol = domestic ? /^\d{6}$/.test(symbol) : /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol);
  const status = document.querySelector("#stockQuoteStatus");
  if (!validSymbol || investedAmount <= 0 || averagePrice <= 0) {
    if (status) status.textContent = domestic ? "국내 종목코드 6자리와 투자금, 평균 매수가를 확인해 주세요." : "영문 종목코드와 투자금, 평균 매수가를 확인해 주세요.";
    return;
  }
  const existing = investmentPositions().find((position) => position.id === editingInvestmentId);
  const sameQuote = existing?.symbol === symbol && existing?.exchange === exchange;
  const next = {
    id: existing?.id || newId("investment"), exchange, symbol, name,
    currency: domestic ? "KRW" : "USD", investedAmount, averagePrice,
    lastPrice: sameQuote ? existing.lastPrice : null,
    changePercent: sameQuote ? existing.changePercent : null,
    quoteDate: sameQuote ? existing.quoteDate : "",
    quotedAt: sameQuote ? existing.quotedAt : "",
  };
  state.settings.investmentPositions = editingInvestmentId
    ? investmentPositions().map((position) => position.id === editingInvestmentId ? next : position)
    : [...investmentPositions(), next];
  saveState();
  resetInvestmentForm();
  refreshStockQuotes(true);
}

function startInvestmentEdit(id) {
  const position = investmentPositions().find((item) => item.id === id);
  if (!position) return;
  editingInvestmentId = id;
  document.querySelector("#newInvestmentExchange").value = position.exchange;
  document.querySelector("#newInvestmentSymbol").value = position.symbol;
  document.querySelector("#newInvestmentName").value = position.name;
  document.querySelector("#newInvestmentAmount").value = position.investedAmount;
  document.querySelector("#newInvestmentAveragePrice").value = position.averagePrice;
  document.querySelector("#saveInvestmentPosition").textContent = "수정 저장";
  document.querySelector("#cancelInvestmentEdit").classList.remove("hidden");
  renderManualInvestments();
  document.querySelector("#investmentEntryForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTossSnapshot(snapshot) {
  const totals = document.querySelector("#tossTotals");
  totals.replaceChildren();
  for (const total of snapshot.totals) {
    const card = document.createElement("section");
    card.className = "investment-total";
    const title = document.createElement("h4");
    title.textContent = total.currency === "KRW" ? "국내 주식 · KRW" : "미국 주식 · USD";
    card.append(title);
    for (const [label, key] of [["평가금액", "value"], ["매입금액", "cost"], ["평가손익", "profit"]]) {
      const row = document.createElement("div");
      const name = document.createElement("span");
      const value = document.createElement("strong");
      name.textContent = label;
      value.textContent = investmentMoney(total[key], total.currency);
      row.append(name, value);
      card.append(row);
    }
    totals.append(card);
  }
  const list = document.querySelector("#tossHoldings");
  list.replaceChildren();
  if (!snapshot.items.length) list.textContent = "보유 중인 국내·미국 주식이 없어요.";
  for (const item of snapshot.items) {
    const row = document.createElement("section");
    row.className = "investment-holding";
    const title = document.createElement("strong");
    title.textContent = `${item.name} (${item.symbol})`;
    const quantity = document.createElement("span");
    quantity.textContent = `${item.quantity ?? "—"}주 · ${item.currency}`;
    const value = document.createElement("strong");
    value.textContent = investmentMoney(item.value, item.currency);
    const profit = document.createElement("span");
    profit.textContent = `평가손익 ${investmentMoney(item.profit, item.currency)}`;
    row.append(title, value, quantity, profit);
    list.append(row);
  }
}

(() => {
  const savings = document.querySelector(".savings-panel");
  const investments = document.querySelector("#investmentPanel");
  const savingTab = document.querySelector("#assetSavingsTab");
  const investingTab = document.querySelector("#assetInvestmentTab");
  function show(investing) {
    savings.classList.toggle("hidden", investing);
    investments.classList.toggle("hidden", !investing);
    savingTab.setAttribute("aria-pressed", String(!investing));
    investingTab.setAttribute("aria-pressed", String(investing));
    savingTab.className = investing ? "ghost-button" : "primary-button";
    investingTab.className = investing ? "primary-button" : "ghost-button";
    if (investing) {
      resetTossForSession();
      renderManualInvestments();
      refreshStockQuotes(false);
    }
  }
  savingTab.addEventListener("click", () => show(false));
  investingTab.addEventListener("click", () => show(true));
  document.querySelector("#investmentEntryForm").addEventListener("submit", saveInvestmentPosition);
  document.querySelector("#cancelInvestmentEdit").addEventListener("click", resetInvestmentForm);
  document.querySelector("#newInvestmentExchange").addEventListener("change", renderManualInvestments);
  document.querySelector("#refreshStockQuotes").addEventListener("click", () => refreshStockQuotes(true));
  document.querySelector("#manualInvestmentHoldings").addEventListener("click", (event) => {
    const editId = event.target.closest("[data-edit-investment]")?.dataset.editInvestment;
    const deleteId = event.target.closest("[data-delete-investment]")?.dataset.deleteInvestment;
    if (editId) startInvestmentEdit(editId);
    if (deleteId && confirm("이 보유 종목을 삭제할까요?")) {
      state.settings.investmentPositions = investmentPositions().filter((position) => position.id !== deleteId);
      saveState();
      renderManualInvestments();
    }
  });
  document.querySelector("#tossSetupCode").addEventListener("click", async () => {
    const session = sharedSession;
    if (!session) {
      document.querySelector("#tossStatus").textContent = "공유 로그인부터 해 주세요.";
      return;
    }
    const hash = await sha256Hex(await tossViewerToken(session));
    if (sharedSession === session) document.querySelector("#tossSetupHash").textContent = hash;
  });
  document.querySelector("#refreshToss").addEventListener("click", async () => {
    resetTossForSession();
    const session = sharedSession;
    const status = document.querySelector("#tossStatus");
    if (!session) { status.textContent = "공유 로그인부터 해 주세요."; return; }
    const button = document.querySelector("#refreshToss");
    button.disabled = true;
    const controller = new AbortController();
    tossRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    const hasPrevious = document.querySelector("#tossTotals").childElementCount > 0;
    status.textContent = "토스증권 보유 자산을 조회하고 있어요.";
    try {
      const token = await tossViewerToken(session);
      const response = await fetch("/api/toss-holdings", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (sharedSession !== session) return;
      if (!response.ok) throw new Error(data.error || "조회에 실패했어요.");
      renderTossSnapshot(data);
      status.textContent = `${new Date(data.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} 조회 · 수수료·세금 차감 전`;
    } catch (error) {
      if (sharedSession === session) status.textContent = (error.name === "AbortError" ? "연결 시간이 초과됐어요. 다시 시도해 주세요." : error.message) + (hasPrevious ? " 이전 조회 결과를 표시하고 있어요." : "");
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      if (tossRequest === controller) tossRequest = null;
    }
  });
  resetTossForSession();
  renderManualInvestments();
})();

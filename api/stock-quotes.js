const ALLOWED_EXCHANGES = new Set(["KRX", "KOSDAQ", "NASDAQ", "NYSE", "NYSEARCA"]);
const quoteCache = new Map();
const pendingQuotes = new Map();
const CACHE_MS = 20 * 60 * 60 * 1000;

function quoteKey(symbol, exchange) { return `${symbol}:${exchange}`; }
function decodeGoogleText(value) { try { return JSON.parse(`"${value}"`); } catch { return value; } }

function parseGoogleFinanceQuote(html, symbol, exchange, now = new Date()) {
  const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedExchange = exchange.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\["${escapedSymbol}","${escapedExchange}"\\],"((?:[^"\\\\]|\\\\.)*)",\\d+,"([A-Z]{3})",\\[(-?\\d+(?:\\.\\d+)?),(-?\\d+(?:\\.\\d+)?),(-?\\d+(?:\\.\\d+)?)`);
  const match = html.match(pattern);
  if (!match) throw new Error("시세 응답 형식이 변경되었습니다.");
  const price = Number(match[3]);
  if (!(price > 0)) throw new Error("현재가를 확인할 수 없습니다.");
  return { symbol, exchange, name: decodeGoogleText(match[1]), currency: match[2], price, change: Number(match[4]), changePercent: Number(match[5]), quotedAt: now.toISOString() };
}

function parseRequestedSymbols(value) {
  const entries = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!entries.length || entries.length > 10) throw new Error("종목은 한 번에 1개부터 10개까지 조회할 수 있어요.");
  return [...new Set(entries)].map((entry) => {
    const [rawSymbol, rawExchange, ...rest] = entry.split(":");
    const symbol = String(rawSymbol || "").toUpperCase();
    const exchange = String(rawExchange || "").toUpperCase();
    const domestic = exchange === "KRX" || exchange === "KOSDAQ";
    const validSymbol = domestic ? /^\d{6}$/.test(symbol) : /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol);
    if (rest.length || !validSymbol || !ALLOWED_EXCHANGES.has(exchange)) throw new Error("지원하지 않는 종목코드나 거래소예요.");
    return { symbol, exchange };
  });
}

async function fetchQuote(symbol, exchange, { fetchImpl = fetch, now = new Date() } = {}) {
  const key = quoteKey(symbol, exchange);
  const cached = quoteCache.get(key);
  if (cached && now.getTime() - cached.savedAt < CACHE_MS) return cached.quote;
  if (pendingQuotes.has(key)) return pendingQuotes.get(key);
  const request = (async () => {
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}:${exchange}?hl=ko`;
    const response = await fetchImpl(url, { headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7", "User-Agent": "Mozilla/5.0 (compatible; WonsuLedger/1.0; +https://saitama-bigmac.vercel.app)" }, redirect: "error", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`시세 제공처 응답 오류 (${response.status})`);
    const quote = parseGoogleFinanceQuote(await response.text(), symbol, exchange, now);
    quoteCache.set(key, { savedAt: now.getTime(), quote });
    return quote;
  })().finally(() => pendingQuotes.delete(key));
  pendingQuotes.set(key, request);
  return request;
}

function createHandler({ fetchImpl = fetch, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "조회 요청만 지원합니다." }); }
    let requested;
    try { requested = parseRequestedSymbols(req.query?.symbols); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const results = await Promise.all(requested.map(async ({ symbol, exchange }) => {
      try { return { quote: await fetchQuote(symbol, exchange, { fetchImpl, now: now() }) }; }
      catch (error) { return { error: { symbol, exchange, message: error.message } }; }
    }));
    const quotes = results.flatMap((result) => result.quote ? [result.quote] : []);
    const errors = results.flatMap((result) => result.error ? [result.error] : []);
    if (!quotes.length) return res.status(502).json({ error: "주식 시세를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.", errors });
    return res.status(200).json({ quotes, errors });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.parseGoogleFinanceQuote = parseGoogleFinanceQuote;
module.exports.parseRequestedSymbols = parseRequestedSymbols;

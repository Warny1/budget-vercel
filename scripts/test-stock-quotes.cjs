const assert = require("node:assert/strict");
const { createHandler, parseGoogleFinanceQuote, parseRequestedSymbols } = require("../api/stock-quotes.js");

const fixture = `AF_initDataCallback({key: 'ds:2', data:[[[["/m/example",["AAPL","NASDAQ"],"애플",0,"USD",[348.78,-0.13,-0.037,2,2,3],null,348.91]]]]});`;
const quote = parseGoogleFinanceQuote(fixture, "AAPL", "NASDAQ", new Date("2026-10-30T01:00:00.000Z"));
assert.deepEqual({ name: quote.name, currency: quote.currency, price: quote.price }, { name: "애플", currency: "USD", price: 348.78 });
assert.deepEqual(parseRequestedSymbols("005930:KRX,AAPL:NASDAQ"), [{ symbol: "005930", exchange: "KRX" }, { symbol: "AAPL", exchange: "NASDAQ" }]);
assert.throws(() => parseRequestedSymbols("https://evil.example:KRX"));

function responseRecorder() {
  const result = { headers: {} };
  return { result, setHeader(name, value) { result.headers[name] = value; }, status(code) { result.code = code; return this; }, json(body) { result.body = body; return result; } };
}

(async () => {
  const handler = createHandler({ now: () => new Date("2026-10-30T01:00:00.000Z"), fetchImpl: async () => ({ ok: true, text: async () => fixture }) });
  const res = responseRecorder();
  await handler({ method: "GET", query: { symbols: "AAPL:NASDAQ" } }, res);
  assert.equal(res.result.code, 200);
  assert.equal(res.result.body.quotes[0].price, 348.78);
  assert.match(res.result.headers["Cache-Control"], /s-maxage/);
  console.log("Passed: stock quote parsing, symbol validation, handler response and cache headers.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

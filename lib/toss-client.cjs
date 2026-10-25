const BASE = 'https://openapi.tossinvest.com';
class TossError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function createTossClient({ clientId, clientSecret, accountSeq, fetchImpl = fetch }) {
  let token, expires = 0, pendingToken;
  async function request(path, options) {
    const response = await fetchImpl(BASE + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      const messages = {401:'토스증권 인증을 확인해 주세요.',403:'토스증권 허용 IP와 계좌 권한을 확인해 주세요.',429:'조회가 많습니다. 잠시 후 다시 시도해 주세요.'};
      throw new TossError(response.status, messages[response.status] || '토스증권 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
    return response.json();
  }
  async function accessToken() {
    if (token && Date.now() < expires) return token;
    if (!pendingToken) pendingToken = (async () => {
      const data = await request('/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}).toString() });
      if (!data.access_token || !(Number(data.expires_in) > 0)) throw new TossError(502,'토스증권 인증 응답을 확인할 수 없습니다.');
      token = data.access_token; expires = Date.now() + Math.max(0, Number(data.expires_in)-60)*1000;
      return token;
    })().finally(() => { pendingToken = null; });
    return pendingToken;
  }
  return { async holdings() {
    const access = await accessToken();
    try {
      const data = await request('/api/v1/holdings', {method:'GET',headers:{Authorization:`Bearer ${access}`,'X-Tossinvest-Account':accountSeq}});
      return normalizeHoldings(data.result);
    } catch(error) { if(error.status===401){token=null;expires=0;} throw error; }
  }};
}
function number(value) {
  if (value === null) return null;
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '' || !Number.isFinite(Number(value))) throw new TossError(502,'토스증권 자산 응답 형식이 변경되었습니다.');
  return Number(value);
}
function normalizeHoldings(data) {
  if(!data || !Array.isArray(data.items)) throw new TossError(502,'토스증권 보유 종목을 확인할 수 없습니다.');
  const totals = ['krw','usd'].map(currency => ({currency:currency.toUpperCase(),cost:number(data.totalPurchaseAmount?.[currency]),value:number(data.marketValue?.amount?.[currency]),profit:number(data.profitLoss?.amount?.[currency])}));
  const items = data.items.map(item => {
    if(!['KRW','USD'].includes(item.currency) || typeof item.symbol!=='string' || typeof item.name!=='string') throw new TossError(502,'지원하지 않는 종목 응답입니다.');
    return {symbol:item.symbol,name:item.name,currency:item.currency,quantity:number(item.quantity),cost:number(item.marketValue?.purchaseAmount),value:number(item.marketValue?.amount),profit:number(item.profitLoss?.amount)};
  });
  return {updatedAt:new Date().toISOString(),totals,items};
}
module.exports = {createTossClient,normalizeHoldings,TossError};

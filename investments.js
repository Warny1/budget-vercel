/* Investment snapshots remain in memory and never enter household cash-flow records. */
let tossSessionKey = null;
let tossRequest = null;
function resetTossForSession() {
  const next = sharedSession?.lookupKey || null;
  if (tossSessionKey === next) return;
  tossSessionKey = next;
  tossRequest?.abort(); tossRequest = null;
  document.querySelector('#tossTotals').replaceChildren();
  document.querySelector('#tossHoldings').replaceChildren();
  document.querySelector('#tossSetupHash').textContent = '';
  document.querySelector('#tossStatus').textContent = next ? '불러오기를 누르면 최신 보유 자산을 조회해요.' : '공유 로그인 후 이용해 주세요.';
}
async function tossViewerToken(session) {
  return sha256Hex(`원수살림-토스조회-v1:${session.lookupKey}:${session.secret}`);
}
function investmentMoney(amount,currency) {
  return amount===null ? '정보 없음' : new Intl.NumberFormat('ko-KR',{style:'currency',currency,maximumFractionDigits:currency==='KRW'?0:2}).format(amount);
}
function renderTossSnapshot(snapshot) {
  const totals=document.querySelector('#tossTotals');totals.replaceChildren();
  for(const total of snapshot.totals){
    const card=document.createElement('section');card.className='investment-total';
    const title=document.createElement('h4');title.textContent=total.currency==='KRW'?'국내 주식 · KRW':'미국 주식 · USD';card.append(title);
    for(const [label,key] of [['평가금액','value'],['매입금액','cost'],['평가손익','profit']]){
      const row=document.createElement('div');const name=document.createElement('span');const value=document.createElement('strong');
      name.textContent=label;value.textContent=investmentMoney(total[key],total.currency);row.append(name,value);card.append(row);
    }totals.append(card);
  }
  const list=document.querySelector('#tossHoldings');list.replaceChildren();
  if(!snapshot.items.length)list.textContent='보유 중인 국내·미국 주식이 없어요.';
  for(const item of snapshot.items){
    const row=document.createElement('section');row.className='investment-holding';
    const title=document.createElement('strong');title.textContent=`${item.name} (${item.symbol})`;
    const quantity=document.createElement('span');quantity.textContent=`${item.quantity??'—'}주 · ${item.currency}`;
    const value=document.createElement('strong');value.textContent=investmentMoney(item.value,item.currency);
    const profit=document.createElement('span');profit.textContent=`평가손익 ${investmentMoney(item.profit,item.currency)}`;
    row.append(title,value,quantity,profit);list.append(row);
  }
}
(() => {
  const savings=document.querySelector('.savings-panel');const investments=document.querySelector('#investmentPanel');
  const savingTab=document.querySelector('#assetSavingsTab');const investingTab=document.querySelector('#assetInvestmentTab');
  function show(investing){
    savings.classList.toggle('hidden',investing);investments.classList.toggle('hidden',!investing);
    savingTab.setAttribute('aria-pressed',String(!investing));investingTab.setAttribute('aria-pressed',String(investing));
    savingTab.className=investing?'ghost-button':'primary-button';
    investingTab.className=investing?'primary-button':'ghost-button';
  }
  savingTab.addEventListener('click',()=>show(false));investingTab.addEventListener('click',()=>{resetTossForSession();show(true);});
  document.querySelector('#tossSetupCode').addEventListener('click',async()=>{
    const session=sharedSession;if(!session){document.querySelector('#tossStatus').textContent='공유 로그인부터 해 주세요.';return;}
    const hash=await sha256Hex(await tossViewerToken(session));
    if(sharedSession===session)document.querySelector('#tossSetupHash').textContent=hash;
  });
  document.querySelector('#refreshToss').addEventListener('click',async()=>{
    resetTossForSession();const session=sharedSession;const status=document.querySelector('#tossStatus');
    if(!session){status.textContent='공유 로그인부터 해 주세요.';return;}
    const button=document.querySelector('#refreshToss');button.disabled=true;
    const controller=new AbortController();tossRequest=controller;const timeout=setTimeout(()=>controller.abort(),30000);
    const hasPrevious=document.querySelector('#tossTotals').childElementCount>0;
    status.textContent='토스증권 보유 자산을 조회하고 있어요.';
    try{
      const token=await tossViewerToken(session);
      const response=await fetch('/api/toss-holdings',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal});
      const data=await response.json();
      if(sharedSession!==session)return;
      if(!response.ok)throw new Error(data.error||'조회에 실패했어요.');
      renderTossSnapshot(data);
      status.textContent=`${new Date(data.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} 조회 · 수수료·세금 차감 전`;
    }catch(error){
      if(sharedSession===session)status.textContent=(error.name==='AbortError'?'연결 시간이 초과됐어요. 다시 시도해 주세요.':error.message)+(hasPrevious?' 이전 조회 결과를 표시하고 있어요.':'');
    }finally{clearTimeout(timeout);button.disabled=false;if(tossRequest===controller)tossRequest=null;}
  });
  resetTossForSession();
})();

const {createHash,timingSafeEqual} = require('node:crypto');
const {createTossClient} = require('../lib/toss-client.cjs');
function createHandler({env=process.env,fetchImpl=fetch}={}) {
  let client, cached, expires=0, pending;
  return async function handler(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'조회 요청만 지원합니다.'});}
    if(!env.TOSS_CLIENT_ID || !env.TOSS_CLIENT_SECRET || !env.TOSS_ACCOUNT_SEQ || !/^[a-f0-9]{64}$/.test(env.TOSS_VIEWER_TOKEN_HASH||'')) return res.status(503).json({error:'토스증권 연결 설정이 아직 완료되지 않았어요.'});
    const credential=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'')?.[1];
    if(!credential || !timingSafeEqual(createHash('sha256').update(credential).digest(),Buffer.from(env.TOSS_VIEWER_TOKEN_HASH,'hex'))) return res.status(401).json({error:'이 공유 가계부에는 토스증권 조회 권한이 없어요.'});
    try {
      if(cached && Date.now()<expires) return res.status(200).json(cached);
      if(!client) client=createTossClient({clientId:env.TOSS_CLIENT_ID,clientSecret:env.TOSS_CLIENT_SECRET,accountSeq:env.TOSS_ACCOUNT_SEQ,fetchImpl});
      if(!pending) pending=client.holdings().then(data=>{cached=data;expires=Date.now()+30000;return data;}).finally(()=>{pending=null;});
      return res.status(200).json(await pending);
    } catch(error) {
      return res.status(error.status===429?429:502).json({error:error.status?error.message:'연결에 실패했어요. 잠시 후 다시 시도해 주세요.'});
    }
  };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;

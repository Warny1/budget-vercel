const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createHandler}=require('../api/toss-holdings.js');
const {normalizeHoldings}=require('../lib/toss-client.cjs');
const fixtures=require('./fixtures/toss-holdings.json');
const token='a'.repeat(64);
const env={TOSS_CLIENT_ID:'test-id',TOSS_CLIENT_SECRET:'secret-must-never-leak',TOSS_ACCOUNT_SEQ:'1',TOSS_VIEWER_TOKEN_HASH:createHash('sha256').update(token).digest('hex')};
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};}
async function call(handler,auth=token,method='GET'){const r=res();await handler({method,headers:{authorization:`Bearer ${auth}`}},r);return r;}
(async()=>{
const calls=[];
const handler=createHandler({env,fetchImpl:async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>url.endsWith('/oauth2/token')?{access_token:'private-token',expires_in:86400}:fixtures.withHoldings};}});
assert.equal((await call(handler,'b'.repeat(64))).code,401);assert.equal(calls.length,0);
assert.equal((await call(handler,token,'POST')).code,405);assert.equal(calls.length,0);
const results=await Promise.all([call(handler),call(handler)]);assert.equal(calls.length,2);
assert.deepEqual(calls.map(c=>[new URL(c[0]).pathname,c[1].method]),[['/oauth2/token','POST'],['/api/v1/holdings','GET']]);
assert.equal(calls[1][1].headers['X-Tossinvest-Account'],'1');
const body=results[0].body;assert.equal(body.totals[0].value,7200000);assert.equal(body.totals[1].value,1785);assert.equal(body.items[1].currency,'USD');
assert.equal(results[0].headers['Cache-Control'],'private, no-store');
assert.ok(!JSON.stringify(body).includes('private-token'));assert.ok(!JSON.stringify(body).includes(env.TOSS_CLIENT_SECRET));
await call(handler);assert.equal(calls.length,2);
for(const fixture of Object.values(fixtures))normalizeHoldings(fixture.result);
assert.equal(normalizeHoldings(fixtures.emptyHoldings.result).items.length,0);
assert.throws(()=>normalizeHoldings({items:[]}),/형식/);
for(const status of [401,403,429,500]){
const failed=createHandler({env,fetchImpl:async()=>({ok:false,status})});const result=await call(failed);assert.equal(result.code,status===429?429:502);assert.ok(!JSON.stringify(result.body).includes(env.TOSS_CLIENT_SECRET));}
assert.equal((await call(createHandler({env:{}}))).code,503);
console.log('Passed: authorization, read-only routes, request deduplication, currency separation, empty/malformed payloads, provider errors, secret isolation.');
})();

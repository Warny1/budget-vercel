import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function extract(name) {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(match, name);
  const end = source.indexOf('\n}', match.index);
  return source.slice(match.index, end + 2);
}
const noop = () => {};
const fields = {};
const ctx = vm.createContext({
  console, setTimeout, clearTimeout, structuredClone,
  normalizeState: x => x, renderAll: noop, renderCloudStatus: noop,
  saveState: noop, resetExpenseForm: noop, resetIncomeForm: noop,
  getPaymentItem: () => null, newId: () => 'new',
  currentMonthKey: () => '2026-10', currentMonth: () => '2026-10', todayKey: () => '2026-10-26',
  recurringDateForMonth: (r,m) => `${m}-${String(r.day).padStart(2,'0')}`,
  savingsInitialForDetail: () => 0, sum: rows => rows.reduce((a,r) => a+r.amount,0),
  alert: noop, $: id => ({value: fields[id] || '', getAttribute: () => 'false'}),
});
const names = ['clone','valuesEqual','mergeStateValue','mergeBudgetStates','recurringOccurrenceKey','applyRecurringRules','skipRecurringRow','addExpense','addIncome','cloudCheckpointKey','persistCloudCheckpoint','loadCloudState','saveCloudState'];
vm.runInContext(names.map(extract).join('\n'),ctx);
ctx.sampleState = {expenses:[],incomes:[],savings:[],settings:{}};
const fresh = () => ({expenses:[],incomes:[],savings:[],settings:{recurringRules:[{id:'r',kind:'expense',day:5,amount:100,startMonth:'2026-10'}],recurringSkips:[]}});
ctx.state=fresh();
ctx.applyRecurringRules('2026-09');ctx.applyRecurringRules('2026-11');assert.equal(ctx.state.expenses.length,0);
ctx.state.settings.recurringRules.push({id:'later',day:31,amount:200});
ctx.applyRecurringRules();ctx.applyRecurringRules();assert.equal(ctx.state.expenses.length,1);
const generated=structuredClone(ctx.state.expenses[0]);
ctx.editingExpenseId=generated.id;
Object.assign(fields,{'#expenseDate':'2026-10-05','#expenseAmount':'120','#expenseMemo':'edited'});
ctx.addExpense();ctx.applyRecurringRules();assert.equal(ctx.state.expenses.length,1);assert.equal(ctx.state.expenses[0].recurringRuleId,'r');
ctx.skipRecurringRow(ctx.state.expenses[0]);ctx.state.expenses=[];ctx.applyRecurringRules();assert.equal(ctx.state.expenses.length,0);
ctx.state=fresh();ctx.applyRecurringRules();assert.equal(ctx.state.expenses[0].id,generated.id);
ctx.state.savings=[{id:'deposit',date:'2026-10-01',type:'적금',detail:'a',amount:1000},{id:'withdraw',date:'2026-10-02',type:'적금',detail:'a',amount:-100,transferId:'t'}];
ctx.state.incomes=[{id:'income',date:'2026-10-02',amount:100,savingsTransferId:'t'}];ctx.editingIncomeId='income';
Object.assign(fields,{'#incomeDate':'2026-10-03','#incomeAmount':'150','#incomeType':'기타(원)','#incomeMemo':'edited'});
ctx.addIncome();assert.equal(ctx.state.incomes[0].savingsTransferId,'t');assert.equal(ctx.state.incomes[0].type,'저금 인출');assert.equal(ctx.state.savings[1].amount,-150);assert.equal(ctx.state.savings[1].date,'2026-10-03');
fields['#incomeAmount']='1500';ctx.addIncome();assert.equal(ctx.state.incomes[0].amount,150);
const storage=new Map();ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
Object.assign(ctx,{STORAGE_KEY:'test',SHARED_STATE_TABLE:'test',sharedSession:{lookupKey:'family'},cloudBaseState:null,cloudRevision:0,cloudLoaded:false,applyingCloudState:false,cloudSaveTimer:null,cloudWriteQueue:Promise.resolve(),decryptSharedState:async x=>x,encryptSharedState:async x=>x,cloudErrorMessage:()=> 'error',confirm:()=>false});
let remote={expenses:[{id:'remote',amount:20}],incomes:[],savings:[],settings:{}};
let writes=0;
ctx.cloudClient={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{payload:remote,revision:1}})})})}),rpc:async()=>{writes++;return {data:{saved:true,current_revision:2}}}};
ctx.state={...structuredClone(ctx.sampleState),expenses:[{id:'local',amount:10}]};
await ctx.saveCloudState(true);assert.equal(writes,0);
await ctx.loadCloudState();assert.deepEqual(Array.from(ctx.state.expenses,r=>r.id).sort(),['local','remote']);assert.equal(writes,1);assert.ok(storage.has('test-before-cloud-load'));
// A reload must retain local offline additions and honor remote deletion of unchanged rows.
ctx.cloudBaseState=null;ctx.state.expenses.push({id:'offline',amount:30});remote={...structuredClone(ctx.sampleState),expenses:[{id:'remote',amount:20}]};
await ctx.loadCloudState();assert.deepEqual(Array.from(ctx.state.expenses,r=>r.id).sort(),['offline','remote']);
// Missing cloud account cannot silently create an empty household.
ctx.cloudClient.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})});
const before=writes;await ctx.loadCloudState();await ctx.saveCloudState(true);assert.equal(writes,before);assert.equal(ctx.cloudLoaded,false);
console.log('Passed: recurring dates/idempotency/edit/delete, linked withdrawal edit, cloud preservation/reload/deletion/missing account.');

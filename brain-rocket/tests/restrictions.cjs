const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function account(initial){
 let state=initial;const storage=new Map();
 const context=vm.createContext({window:{addEventListener(){},dispatchEvent(){}},document:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},Date,Set,Map,Promise,JSON,Math,CustomEvent:class{},setTimeout:()=>0,clearTimeout(){}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/account.js'),'utf8')+'\nglobalThis.account=Account',context);
 const a=context.account;
 a.useTransport(async(method,url)=>{
  if(url.includes('/auth/v1/token'))return {status:200,data:{access_token:'fixture',refresh_token:'refresh',expires_in:3600,user:{id:'actor',user_metadata:{username:'Actor'}}}};
  if(url.endsWith('/my_account_state'))return {status:200,data:state};
  if(url.includes('/br_')&&state.active===false)return {status:400,data:{message:'br_not_signed_in',code:'P0001'}};
  if(url.endsWith('/br_get_progress'))return {status:200,data:{doc:{bests:{},daily:{},dailyStreak:null},rev:1}};
  return {status:200,data:{}};
 });
 return {a,set:s=>state=s};
}
test('real bans and suspensions retain reason; lifting restriction resumes sync even when blind-banned',async()=>{
 for(const status of ['suspended','banned']){
  const {a,set}=account({active:false,status,reason:'Fixture reason',restrictedUntil:'2099-01-01T00:00:00Z'});
  assert.equal((await a.signIn('Actor','fixture')).restricted,true);assert.equal(a.status,'restricted');assert.equal(a.restriction.status,status);assert.equal(a.restriction.reason,'Fixture reason');
  set({active:true,status:'active',forceLightTheme:true});assert.equal(await a.recheck(),'signedIn');assert.equal(a.sync,'synced');
 }
});
test('blind ban alone never restricts a Brain Rocket account',async()=>{
 const {a}=account({active:true,status:'active',forceLightTheme:true,blindBanAt:new Date().toISOString()});
 assert.equal((await a.signIn('Actor','fixture')).restricted,false);assert.equal(a.status,'signedIn');assert.equal(a.restriction,null);
});

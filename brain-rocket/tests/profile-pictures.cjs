const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const nodes=[],listeners=[];let observer;
 const account={status:'signedIn',user:{id:'a'},CONFIG:{supabaseUrl:'https://example.supabase.co'},on:fn=>listeners.push(fn),pictureUrls:async names=>names.map(username=>({username,url:'https://example.supabase.co/storage/v1/object/sign/avatars/a/p.png?token=x',expiresAt:Date.now()+60000}))};
 const doc={hidden:false,querySelectorAll:()=>nodes,addEventListener(){},body:{},createElement:()=>({remove(){this.owner.img=null;},set src(v){this.value=v;queueMicrotask(()=>this.onload?.());},get src(){return this.value;}})};
 const ctx=vm.createContext({Account:account,document:doc,window:{addEventListener(){}},MutationObserver:class{constructor(fn){observer=fn}observe(){}},setTimeout:()=>0,clearTimeout(){},setInterval(){},Date,Map,Set,Promise,URL});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js/profile-pictures.js'),'utf8')+'\nglobalThis.pictures=ProfilePictures',ctx);
 function node(name){const n={dataset:{brAvatar:name},isConnected:true,img:null,querySelector(){return this.img},appendChild(img){img.owner=this;this.img=img}};nodes.push(n);return n;}
 return {api:ctx.pictures,account,node,emit:()=>listeners.forEach(fn=>fn())};
}
test('photos batch and cache repeated avatar spots; changes and removal refresh',async()=>{
 const f=fixture(),a=f.node('Alice'),b=f.node('Alice');let calls=0;
 const original=f.account.pictureUrls;f.account.pictureUrls=async names=>{calls++;assert.deepEqual([...names],['Alice']);return original(names)};
 await f.api.refresh();assert.ok(a.img&&b.img);await f.api.refresh(false);assert.equal(calls,1);
 f.account.pictureUrls=async()=>[];await f.api.refresh();assert.equal(a.img,null);assert.equal(b.img,null);
 assert.match(f.api.html('<Alice>'),/&lt;Alice&gt;/);assert.doesNotMatch(f.api.html('<Alice>'),/data-br-avatar="<Alice>/);
});
test('signout cancels in-flight photo application; failed reads leave initials',async()=>{
 const f=fixture(),a=f.node('Alice');let resolve;
 f.account.pictureUrls=()=>new Promise(r=>resolve=r);const pending=f.api.refresh();
 f.account.status='signedOut';f.account.user=null;f.emit();resolve([{username:'Alice',url:'https://example.supabase.co/storage/v1/object/sign/avatars/a/p.png',expiresAt:Date.now()+60000}]);
 await pending;assert.equal(a.img,null);
 f.account.status='signedIn';f.account.user={id:'b'};f.emit();f.account.pictureUrls=async()=>{throw Error('offline')};await f.api.refresh();assert.equal(a.img,null);
});

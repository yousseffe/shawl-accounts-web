// التخزين: IndexedDB (أكبر وأسرع وأأمن من localStorage) + لقطات احتياطية يومية داخل الجهاز
(function(root){
'use strict';
const DB='shawl_store',VER=1,KEEP=14;
let handle=null,timer=null,pending=null,lastSnap='';

function open(){
  if(handle)return Promise.resolve(handle);
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB,VER);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('snaps'))d.createObjectStore('snaps')};
    r.onsuccess=()=>{handle=r.result;res(handle)};
    r.onerror=()=>rej(r.error);
  });
}
const tx=(store,mode,fn)=>open().then(d=>new Promise((res,rej)=>{
  const t=d.transaction(store,mode),s=t.objectStore(store),out=fn(s);
  t.oncomplete=()=>res(out&&out.result!==undefined?out.result:undefined);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);
}));
const get=(store,key)=>tx(store,'readonly',s=>s.get(key));
const put=(store,key,val)=>tx(store,'readwrite',s=>s.put(val,key));

// تحميل البيانات: من IndexedDB، وإن لم توجد ننقل ما كان محفوظاً في localStorage (النسخة القديمة)
async function load(legacyKey){
  try{
    const cur=await get('kv','db');
    if(cur)return JSON.parse(cur);
    const old=localStorage.getItem(legacyKey);
    if(old){const d=JSON.parse(old);await put('kv','db',old);return d}
  }catch(e){console.error('load failed',e);throw e}
  return null;
}

// حفظ مؤجل قليلاً لتجميع التعديلات المتتالية، مع حفظ فوري عند إغلاق الصفحة
function save(db,onError){
  pending=db;clearTimeout(timer);
  timer=setTimeout(()=>flush(onError),250);
}
async function flush(onError){
  clearTimeout(timer);const db=pending;if(!db)return;pending=null;
  try{
    const json=JSON.stringify(db);
    await put('kv','db',json);
    await snapshot(json);
  }catch(e){if(onError)onError(e)}
}
// لقطة واحدة كل يوم (آخر 14 يوماً) تحمي من الحذف الخاطئ
async function snapshot(json){
  const day=new Date().toISOString().slice(0,10);
  if(lastSnap===day)return;
  await put('snaps',day,json);lastSnap=day;
  const keys=await tx('snaps','readonly',s=>s.getAllKeys());
  const old=(keys||[]).sort().slice(0,Math.max(0,keys.length-KEEP));
  if(old.length)await tx('snaps','readwrite',s=>{old.forEach(k=>s.delete(k))});
}
async function listSnaps(){const k=await tx('snaps','readonly',s=>s.getAllKeys());return(k||[]).sort().reverse()}
async function getSnap(day){return get('snaps',day).then(j=>j?JSON.parse(j):null)}

// طلب تخزين دائم حتى لا يمسحه المتصفح عند امتلاء مساحة الجهاز
async function persist(){try{return navigator.storage&&navigator.storage.persist?await navigator.storage.persist():false}catch(e){return false}}

if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
  addEventListener('pagehide',()=>flush());
}
root.Store={load,save,flush,persist,listSnaps,getSnap};
})(globalThis);

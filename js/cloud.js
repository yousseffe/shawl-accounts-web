// نسخ احتياطي سحابي تلقائي عبر Supabase (Auth + REST) — بدون أي مكتبات خارجية.
// الأمان: التطبيق يحمل فقط الرابط العام ومفتاح anon العام، والحماية الفعلية من Row Level Security (supabase/setup.sql)
(function(root){
'use strict';
const KEEP_DAYS=30,DEBOUNCE=45000,RETRY=120000;
const state={session:null,meta:{lastOk:0,lastErr:'',dirty:false},busy:false,timer:null,ver:0,subs:[]};
const cfg=()=>root.CLOUD_CONFIG||{};
const enabled=()=>!!(cfg().url&&cfg().anonKey);
const notify=()=>state.subs.forEach(f=>{try{f(status())}catch(e){}});
const onChange=f=>state.subs.push(f);
const kv=()=>root.Store;

function status(){return{enabled:enabled(),signedIn:!!state.session,email:state.session&&state.session.email,busy:state.busy,lastOk:state.meta.lastOk,lastErr:state.meta.lastErr,dirty:state.meta.dirty}}
async function persist(){try{await kv().setKV('cloud_session',state.session);await kv().setKV('cloud_meta',state.meta)}catch(e){}}
async function init(){
  try{state.session=(await kv().getKV('cloud_session'))||null;state.meta=Object.assign(state.meta,(await kv().getKV('cloud_meta'))||{})}catch(e){}
}

// ---------- ضغط البيانات ----------
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s)}
function unb64(t){const s=atob(t),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
async function pack(db){
  // لا نرفع الرقم السري للسحابة
  const json=JSON.stringify(Object.assign({},db,{pin:''}));
  if(typeof CompressionStream!=='undefined'){
    const out=new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    return{enc:'gzip-b64',payload:b64(new Uint8Array(await new Response(out).arrayBuffer()))};
  }
  return{enc:'json',payload:json};
}
async function unpack(row){
  if(row.enc==='gzip-b64'){
    const out=new Blob([unb64(row.payload)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(out).text());
  }
  return JSON.parse(row.payload);
}

// ---------- الاتصال ----------
async function api(path,o){
  o=o||{};
  const headers=Object.assign({apikey:cfg().anonKey,'Content-Type':'application/json'},o.token?{Authorization:'Bearer '+o.token}:{},o.headers||{});
  const r=await fetch(cfg().url.replace(/\/$/,'')+path,{method:o.method||'GET',headers,body:o.body?JSON.stringify(o.body):undefined});
  const text=await r.text();let j=null;try{j=text?JSON.parse(text):null}catch(e){}
  if(!r.ok){const e=new Error((j&&(j.msg||j.message||j.error_description||j.error))||('HTTP '+r.status));e.status=r.status;throw e}
  return j;
}
function arabicError(e){
  const m=String((e&&e.message)||e);
  if(e&&e.name==='TypeError'||/fetch|network/i.test(m))return 'لا يوجد اتصال بالإنترنت';
  if(/invalid login/i.test(m))return 'البريد أو كلمة المرور غير صحيحة';
  if(/not confirmed/i.test(m))return 'الحساب غير مفعّل بعد، تواصلي مع البائع';
  if(/valid email|invalid format|unable to validate/i.test(m))return 'البريد الإلكتروني غير صحيح';
  if(/rate limit|too many/i.test(m))return 'محاولات كثيرة، انتظري قليلاً ثم أعيدي المحاولة';
  return m;
}

function toSession(j){return{access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),email:(j.user&&j.user.email)||(state.session&&state.session.email)||'',user_id:(j.user&&j.user.id)||(state.session&&state.session.user_id)||''}}
async function signIn(email,password){
  const j=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  state.session=toSession(j);await persist();notify();return state.session;
}
async function signOut(){state.session=null;state.meta.dirty=false;clearTimeout(state.timer);await persist();notify()}
async function token(){
  const s=state.session;if(!s)throw new Error('غير مسجل الدخول');
  if(s.expires_at-60>Date.now()/1000)return s.access_token;
  try{
    const j=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});
    state.session=toSession(Object.assign({user:{email:s.email,id:s.user_id}},j));await persist();return state.session.access_token;
  }catch(e){
    if(e.status===400||e.status===401){state.session=null;state.meta.lastErr='انتهت جلسة الدخول، سجلي الدخول مرة أخرى';await persist();notify()}
    throw e;
  }
}

// ---------- الرفع والتحميل ----------
const dayStr=()=>new Date().toISOString().slice(0,10);
const isEmpty=db=>!(db.items&&db.items.length)&&!(db.sales&&db.sales.length)&&!(db.purchases&&db.purchases.length)&&!(db.parties&&db.parties.length);
async function upload(db,appVersion){
  const t=await token(),p=await pack(db);
  await api('/rest/v1/backups?on_conflict=user_id,day',{method:'POST',token:t,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:{user_id:state.session.user_id,day:dayStr(),payload:p.payload,enc:p.enc,items:(db.items||[]).length,sales:(db.sales||[]).length,app_version:appVersion||'',updated_at:new Date().toISOString()}});
  const old=new Date(Date.now()-KEEP_DAYS*864e5).toISOString().slice(0,10);
  api('/rest/v1/backups?day=lt.'+old,{method:'DELETE',token:t}).catch(()=>{});
}
async function latest(){
  const t=await token();
  const r=await api('/rest/v1/backups?select=day,updated_at,items,sales&order=updated_at.desc&limit=1',{token:t});
  return r&&r[0]||null;
}
async function download(){
  const t=await token();
  const r=await api('/rest/v1/backups?select=*&order=updated_at.desc&limit=1',{token:t});
  if(!r||!r[0])return null;
  return unpack(r[0]);
}

// ---------- الجدولة التلقائية ----------
function markDirty(getDb){
  state.ver++;state.meta.dirty=true;persist();
  if(enabled()&&state.session)schedule(getDb,DEBOUNCE);
}
function schedule(getDb,delay){clearTimeout(state.timer);state.timer=setTimeout(()=>run(getDb),delay)}
async function run(getDb,force){
  if(!enabled()||!state.session||state.busy)return false;
  if(!force&&typeof navigator!=='undefined'&&navigator.onLine===false)return false;
  const db=getDb();
  if(isEmpty(db))return false;   // لا نرفع بيانات فارغة فوق نسخة سليمة أبداً (حتى مع force)
  const v=state.ver;state.busy=true;notify();
  try{
    await upload(db,'1.0');
    state.meta.lastOk=Date.now();state.meta.lastErr='';
    if(state.ver===v)state.meta.dirty=false;else schedule(getDb,DEBOUNCE);
    return true;
  }catch(e){
    state.meta.lastErr=arabicError(e);schedule(getDb,RETRY);return false;
  }finally{state.busy=false;await persist();notify()}
}
function resume(getDb){if(enabled()&&state.session&&state.meta.dirty)schedule(getDb,5000)}

const api2={enabled,status,onChange,init,signIn,signOut,upload,latest,download,markDirty,run,resume,pack,unpack,arabicError,isEmpty,_state:state};
if(typeof module!=='undefined'&&module.exports)module.exports=api2;else root.Cloud=api2;
})(typeof globalThis!=='undefined'?globalThis:this);

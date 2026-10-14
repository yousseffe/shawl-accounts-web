// منطق الحسابات (بدون واجهة) — يُختبر آلياً في tests/core.test.js
(function(root){
'use strict';
const n=v=>{const x=Number(String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)));return isFinite(x)?x:0};
const r2=v=>Math.round((n(v)+Number.EPSILON)*100)/100;
const sum=(a,fn)=>a.reduce((t,x)=>t+fn(x),0);
const pad=x=>String(x).padStart(2,'0');
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addDays=(s,k)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+k);return dstr(d)};
const iname=i=>[i.name,i.color,i.size].filter(Boolean).join(' - ');
const SCHEMA=2;

const empty=()=>({v:SCHEMA,items:[],parties:[],sales:[],purchases:[],payments:[],expenses:[],returns:[],seq:{s:0,b:0},shop:'محل الشالات والطرح',phone:'',foot:'شكراً لزيارتكم 🌸',pin:'',lastBackup:0});

// يضمن أن أي بيانات قديمة تصبح بالشكل الحالي
function migrate(d){
  const base=empty(),o=Object.assign(base,d||{});
  ['items','parties','sales','purchases','payments','expenses','returns'].forEach(k=>{if(!Array.isArray(o[k]))o[k]=[]});
  o.seq=Object.assign({s:0,b:0},o.seq);
  o.v=SCHEMA;return o;
}

const findItem=(db,id)=>db.items.find(i=>i.id===id);
const findParty=(db,id)=>db.parties.find(p=>p.id===id);

// رصيد الطرف: موجب = عليه لنا (عميل) / علينا له (مورد)
function balance(db,pid){
  const p=findParty(db,pid);if(!p)return 0;
  const inv=sum((p.type==='c'?db.sales:db.purchases).filter(x=>x.partyId===pid),x=>x.total-x.paid);
  return r2(inv-sum(db.payments.filter(x=>x.partyId===pid),x=>x.amount));
}

function profit(db,a,b){
  const inr=d=>d>=a&&d<=b;
  const s=db.sales.filter(x=>inr(x.date)),rs=db.returns.filter(r=>r.kind==='s'&&inr(r.date));
  const sales=r2(sum(s,x=>x.total)-sum(rs,r=>r.amount));
  const cogs=r2(sum(s,x=>sum(x.lines,l=>l.qty*l.cost))-sum(rs,r=>sum(r.lines,l=>l.qty*l.cost)));
  const exp=r2(sum(db.expenses.filter(x=>inr(x.date)),x=>x.amount));
  return{sales,cogs,gross:r2(sales-cogs),exp,net:r2(sales-cogs-exp),list:s,count:s.length};
}

const returnedQty=(db,invId,itemId)=>sum(db.returns.filter(r=>r.invoiceId===invId),r=>sum(r.lines.filter(l=>l.itemId===itemId),l=>l.qty));

// إنشاء فاتورة بيع (k='s') أو شراء (k='b'). يرمي Error برسالة عربية عند وجود خطأ
function createInvoice(db,k,o){
  const sell=k==='s';
  if(!o.cart.length)throw new Error('الفاتورة فارغة');
  for(const l of o.cart)if(n(l.qty)<=0||n(l.price)<0)throw new Error('راجعي الكمية والسعر');
  const disc=sell?n(o.disc):0;
  const total=Math.max(0,r2(sum(o.cart,l=>n(l.qty)*n(l.price))-disc));
  const credit=o.method==='آجل';
  const paid=r2(Math.min(o.paid===''||o.paid==null?(credit?0:total):n(o.paid),total));
  if(paid<total&&!o.partyId)throw new Error('اختاري '+(sell?'العميلة':'المورد')+' لتسجيل المبلغ المتبقي كدين');
  const inv={id:o.id,no:++db.seq[k],date:o.date,ts:o.ts,partyId:o.partyId||'',total,paid,disc,method:o.method,
    lines:o.cart.map(l=>{const i=findItem(db,l.itemId);return{itemId:i.id,name:iname(i),qty:n(l.qty),price:n(l.price),cost:sell?i.cost:n(l.price)}})};
  o.cart.forEach(l=>{
    const i=findItem(db,l.itemId),q=n(l.qty);
    if(sell)i.qty=r2(i.qty-q);
    else{const q0=Math.max(0,i.qty);i.cost=(q0+q)>0?r2((q0*i.cost+q*n(l.price))/(q0+q)):n(l.price);i.qty=r2(i.qty+q)}
  });
  (sell?db.sales:db.purchases).push(inv);
  return inv;
}

function createReturn(db,k,invId,qtys,mode,o){
  const sell=k==='s',x=(sell?db.sales:db.purchases).find(y=>y.id===invId);
  if(!x)throw new Error('الفاتورة غير موجودة');
  const ls=[];
  x.lines.forEach(l=>{
    const max=l.qty-returnedQty(db,invId,l.itemId),q=Math.min(max,n(qtys[l.itemId]));
    if(q>0)ls.push({itemId:l.itemId,name:l.name,qty:q,price:l.price,cost:l.cost});
  });
  if(!ls.length)throw new Error('اكتبي كمية');
  const ratio=x.total+x.disc>0?x.total/(x.total+x.disc):1;
  const amount=r2(sum(ls,l=>l.qty*l.price)*ratio);
  ls.forEach(l=>{const it=findItem(db,l.itemId);if(it)it.qty=r2(it.qty+(sell?l.qty:-l.qty))});
  db.returns.push({id:o.id,date:o.date,kind:k,invoiceId:invId,partyId:x.partyId,lines:ls,amount,mode});
  if(mode==='credit'&&x.partyId)db.payments.push({id:o.payId,date:o.date,partyId:x.partyId,amount,ref:o.id,note:'مرتجع'});
  return amount;
}

function deleteInvoice(db,k,id){
  const sell=k==='s',x=(sell?db.sales:db.purchases).find(y=>y.id===id);
  if(!x)return;
  x.lines.forEach(l=>{const i=findItem(db,l.itemId);if(i)i.qty=r2(i.qty+(sell?1:-1)*(l.qty-returnedQty(db,id,l.itemId)))});
  const rids=db.returns.filter(r=>r.invoiceId===id).map(r=>r.id);
  db.returns=db.returns.filter(r=>r.invoiceId!==id);
  db.payments=db.payments.filter(p=>!rids.includes(p.ref));
  if(sell)db.sales=db.sales.filter(y=>y.id!==id);else db.purchases=db.purchases.filter(y=>y.id!==id);
}

const api={SCHEMA,n,r2,sum,dstr,addDays,iname,empty,migrate,balance,profit,returnedQty,createInvoice,createReturn,deleteInvoice};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Core=api;
})(typeof globalThis!=='undefined'?globalThis:this);

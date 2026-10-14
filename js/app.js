// ================= التخزين =================
const KEY='shawl_accounts_v1';
const{n,r2,sum,addDays,dstr}=Core;
const NATIVE=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
let db=Core.empty();
let saveFail=false;
function save(){Store.save(db,()=>{if(!saveFail)toast('تعذر حفظ البيانات! خذي نسخة احتياطية الآن','err');saveFail=true});Cloud.markDirty(()=>db)}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today=()=>dstr(new Date());
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=v=>(Math.round(n(v)*100)/100).toLocaleString('en-US');
const $=id=>document.getElementById(id);
const item=id=>db.items.find(i=>i.id===id);
const party=id=>db.parties.find(p=>p.id===id);
const iname=i=>[i.name,i.color,i.size].filter(Boolean).join(' - ');
const METHODS=['كاش','فودافون كاش','إنستاباي','آجل'];

// ================= واجهة مساعدة =================
function toast(m,t){const e=document.createElement('div');e.className='toast '+(t||'');e.textContent=m;$('toasts').appendChild(e);setTimeout(()=>e.remove(),2600)}
function sheet(title,body,acts,o){
  o=o||{};const w=document.createElement('div');w.className='ov';
  w.innerHTML='<div class="sh '+(o.wide?'wide':'')+'" role="dialog"><div class="shh"><h3>'+h(title)+'</h3><button class="x" aria-label="إغلاق">✕</button></div><div class="shb">'+body+'</div><div class="sha"></div></div>';
  document.body.appendChild(w);document.body.classList.add('hasov');
  const close=()=>{w.remove();if(!document.querySelector('.ov'))document.body.classList.remove('hasov');if(o.onclose)o.onclose()};
  w.querySelector('.x').onclick=close;
  w.addEventListener('mousedown',e=>{if(e.target===w)close()});
  const bar=w.querySelector('.sha');
  (acts||[]).filter(a=>!(a.pr&&NATIVE)).forEach(a=>{const b=document.createElement('button');b.className='btn '+(a.c||'');b.textContent=a.t;b.onclick=()=>{if(!a.fn||a.fn(close)!==false)close()};bar.appendChild(b)});
  if(!bar.children.length)bar.remove();
  if(!o.nofocus){const fi=w.querySelector('input:not([type=file]),select');if(fi)setTimeout(()=>fi.focus(),60)}
  return close;
}
const ask=(msg,t,c)=>new Promise(r=>{let ok=false;sheet('تأكيد','<p style="font-size:17px;margin:14px 0">'+h(msg)+'</p>',[{t:t||'تأكيد',c:c||'d',fn:()=>{ok=true;r(true)}},{t:'إلغاء',c:'s'}],{nofocus:1,onclose:()=>{if(!ok)r(false)}})});
const fld=(id,label,val,type,extra)=>'<label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+h(val)+'" '+(type==='number'?'inputmode="decimal" step="any" min="0" ':'')+(extra||'')+'>';
const chip=(t,on,fn)=>'<button class="chip '+(on?'on':'')+'" onclick="'+fn+'">'+h(t)+'</button>';
const stat=(l,v,c)=>'<div class="stat '+(c||'')+'"><small>'+l+'</small><b>'+v+'</b></div>';
const emptyBox=(i,t)=>'<div class="empty"><b>'+i+'</b>'+t+'</div>';
async function dl(name,text,mime){
  // داخل تطبيق الأندرويد لا تعمل روابط التنزيل، فنحفظ الملف ثم نفتح قائمة المشاركة (واتساب / درايف / ...)
  if(NATIVE){
    try{const P=Capacitor.Plugins,r=await P.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});await P.Share.share({title:name,url:r.uri})}
    catch(e){if(!/cancel/i.test((e&&e.message)||''))toast('تعذر حفظ الملف','err')}
    return;
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime||'text/plain'}));a.download=name;a.click();
}
const waPhone=p=>{p=String(p||'').replace(/\D/g,'');return p.startsWith('0')?'2'+p:p};
const waLink=(p,t)=>'https://wa.me/'+waPhone(p)+'?text='+encodeURIComponent(t);

// ================= الأرصدة =================
const balance=pid=>Core.balance(db,pid);
function balLabel(p){
  const b=balance(p.id),c=p.type==='c';
  if(Math.abs(b)<0.005)return '<span class="badge g">مسدد</span>';
  if(b>0)return '<span class="badge r">'+(c?'عليها ':'علينا له ')+f(b)+'</span>';
  return '<span class="badge o">'+(c?'لها رصيد ':'لنا عنده ')+f(-b)+'</span>';
}

// ================= الأرباح =================
const profit=(a,b)=>Core.profit(db,a,b);
function dailySales(a,b){
  const out=[];for(let d=a;d<=b&&out.length<62;d=addDays(d,1))out.push({d,v:profit(d,d).sales});return out;
}
function bars(data,fmt){
  const mx=Math.max(1,...data.map(x=>x.v));
  return '<div class="bars">'+data.map(x=>'<div><b>'+(x.v?f(x.v):'')+'</b><i style="height:'+Math.max(3,x.v/mx*100)+'%"></i>'+fmt(x.d)+'</div>').join('')+'</div>';
}
const wd=d=>new Date(d+'T12:00:00').toLocaleDateString('ar-EG',{weekday:'short'});
const dm=d=>+d.slice(8)+'/'+(+d.slice(5,7));

// ================= الحالة والتنقل =================
const S={view:'home',cart:[],party:'',disc:'',paid:'',method:'كاش',q:'',cat:'',low:false,ptab:'c',pq:'',iq:'',range:'month',from:'',to:''};
const NAV=[['home','الرئيسية','🏠'],['sell','بيع','🛍️'],['buy','شراء','📥'],['items','المخزون','👗'],['parties','الحسابات','👥'],['exp','المصروفات','💸'],['rep','التقارير','📊'],['set','الإعدادات','⚙️']];
const K=()=>S.view==='sell'?'s':'b';
function go(v){S.view=v;S.cart=[];S.party='';S.disc='';S.paid='';S.method='كاش';S.q='';S.iq='';S.cat='';S.low=false;S.pq='';render();window.scrollTo(0,0)}
function render(){
  $('nav').innerHTML='<div class="brand"><i>🧣</i>'+h(db.shop)+'</div>'+NAV.map(v=>'<button class="'+(v[0]===S.view?'on':'')+'" onclick="go(\''+v[0]+'\')"><span class="i">'+v[2]+'</span>'+v[1]+'</button>').join('');
  $('main').innerHTML=({home:homeV,sell:tradeV,buy:tradeV,items:itemsV,parties:partiesV,exp:expV,rep:repV,set:setV})[S.view]();
  if(S.view==='sell'||S.view==='buy'){grid();cartp()}
  if(S.view==='items')itemsRows();
  if(S.view==='parties')partiesList();
}

// ================= الرئيسية =================
function homeV(){
  const t=today(),pt=profit(t,t),pm=profit(t.slice(0,7)+'-01',t.slice(0,7)+'-31');
  const stock=sum(db.items,i=>i.qty*i.cost);
  const low=db.items.filter(i=>i.qty<=n(i.min)).sort((a,b)=>a.qty-b.qty);
  const debt=db.parties.filter(p=>p.type==='c'&&balance(p.id)>0.005).sort((a,b)=>balance(b.id)-balance(a.id));
  const sup=sum(db.parties.filter(p=>p.type==='s'),p=>Math.max(0,balance(p.id)));
  const need=(db.items.length||db.sales.length)&&Date.now()-db.lastBackup>7*864e5&&!Cloud.status().signedIn;
  const week=dailySales(addDays(t,-6),t);
  return '<div class="ph"><div><h2>أهلاً بكِ 👋</h2><small style="color:var(--m)">'+new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})+'</small></div><div class="row" style="flex:0"><button class="btn" onclick="go(\'sell\')">🛍️ فاتورة بيع</button><button class="btn s" onclick="go(\'buy\')">📥 شراء</button></div></div>'+
  '<div id="cloudbn">'+cloudBanner()+'</div>'+
  (need?'<div class="banner"><span>⚠️ لم تأخذي نسخة احتياطية منذ أكثر من أسبوع. البيانات على التابلت فقط.</span><button class="btn sm" onclick="exportDb()">حفظ نسخة الآن</button></div>':'')+
  (!db.items.length?'<div class="banner" style="background:var(--pl);border-color:var(--b)"><span>👋 ابدأي بإضافة أصنافك من «المخزون»، أو جرّبي البرنامج ببيانات تجريبية.</span><button class="btn sm" onclick="demo()">بيانات تجريبية</button></div>':'')+
  '<div class="grid">'+stat('مبيعات اليوم',f(pt.sales)+' ج','')+stat('ربح اليوم (قبل المصروفات)',f(pt.gross)+' ج','g')+stat('صافي ربح الشهر',f(pm.net)+' ج',pm.net<0?'r':'g')+stat('قيمة المخزون (تكلفة)',f(stock)+' ج','o')+'</div>'+
  '<div class="card"><b>مبيعات آخر 7 أيام</b>'+bars(week,d=>wd(d))+'</div>'+
  '<div class="two"><div class="card"><b>⚠️ أصناف على وشك النفاد ('+low.length+')</b>'+
  (low.slice(0,6).map(i=>'<div class="li"><span>'+h(iname(i))+'</span><span class="badge '+(i.qty<=0?'r':'o')+'">'+(i.qty<=0?'نفد':'متبقي '+i.qty)+'</span></div>').join('')||emptyBox('✅','المخزون كافٍ'))+'</div>'+
  '<div class="card"><b>💰 مستحقات العملاء ('+f(sum(debt,p=>balance(p.id)))+' ج)</b>'+
  (debt.slice(0,5).map(p=>'<div class="li"><span>'+h(p.name)+'</span><span><span class="badge r">'+f(balance(p.id))+'</span> '+(p.phone?'<button class="btn w sm" onclick="remind(\''+p.id+'\')">واتساب</button>':'')+'</span></div>').join('')||emptyBox('👍','لا توجد ديون'))+
  (sup>0?'<div class="li"><span>مستحق للموردين</span><b class="neg">'+f(sup)+' ج</b></div>':'')+'</div></div>';
}
function remind(pid){
  const p=party(pid);window.open(waLink(p.phone,'السلام عليكم '+p.name+'، تذكير بسيط بأن المبلغ المستحق لدى '+db.shop+' هو '+f(balance(pid))+' جنيه. شكراً لكِ 🌸'),'_blank');
}

// ================= البيع والشراء =================
function tradeV(){
  const sell=K()==='s';
  const cats=[...new Set(db.items.map(i=>i.cat).filter(Boolean))];window.CATS=cats;
  return '<div class="pos"><section class="pl"><div class="ph"><h2>'+(sell?'🛍️ فاتورة بيع':'📥 فاتورة شراء')+'</h2></div>'+
  '<div class="srch"><input id="q" placeholder="🔍 ابحثي بالاسم أو اللون أو الباركود" value="'+h(S.q)+'" oninput="S.q=this.value;grid()" onkeydown="if(event.key===\'Enter\')scanEnter()" autocomplete="off"><button class="btn s ico" onclick="scanCam()" title="مسح بالكاميرا">📷</button></div>'+
  '<div class="chips">'+chip('الكل',!S.cat,'S.cat=\'\';render()')+cats.map((c,x)=>chip(c,S.cat===c,'S.cat=CATS['+x+'];render()')).join('')+'</div>'+
  '<div id="grid" class="tiles"></div></section><aside class="cartp" id="cartp"></aside></div>';
}
function filtered(){
  const q=S.q.trim().toLowerCase();
  return db.items.filter(i=>(!S.cat||i.cat===S.cat)&&(!q||(iname(i)+' '+(i.cat||'')+' '+(i.barcode||'')).toLowerCase().includes(q)));
}
function grid(){
  const sell=K()==='s',l=filtered(),g=$('grid');if(!g)return;
  g.innerHTML=l.map(i=>'<button class="tile '+(sell&&i.qty<=0?'out':'')+'" onclick="addLine(\''+i.id+'\')"><span class="st badge '+(i.qty<=0?'r':i.qty<=n(i.min)?'o':'g')+'">'+i.qty+'</span><b>'+h(i.name)+'</b><span>'+h([i.color,i.size].filter(Boolean).join(' • '))+'</span><em>'+f(sell?i.price:i.cost)+'</em></button>').join('')||
    '<div style="grid-column:1/-1">'+(db.items.length?emptyBox('🔎','لا توجد نتائج'):emptyBox('📦','لا توجد أصناف بعد<br><button class="btn" style="margin-top:10px" onclick="go(\'items\')">إضافة أصناف</button>'))+'</div>';
}
function scanEnter(){
  const q=S.q.trim();if(!q)return;
  const ex=db.items.find(i=>i.barcode&&i.barcode===q),l=filtered();
  const it=ex||(l.length===1?l[0]:null);
  if(it){addLine(it.id);S.q='';$('q').value='';grid();$('q').focus()}else toast('لم يتم العثور على صنف مطابق','warn');
}
async function scanCam(){
  if(!('BarcodeDetector' in window))return toast('المسح بالكاميرا غير مدعوم هنا. استخدمي قارئ باركود أو اكتبي الرقم','warn');
  let stream,stop=false;
  const close=sheet('مسح باركود','<video id="vid" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000"></video><p style="text-align:center;color:var(--m)">وجّهي الكاميرا نحو الباركود</p>',[],{nofocus:1,onclose:()=>{stop=true;if(stream)stream.getTracks().forEach(t=>t.stop())}});
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=$('vid');v.srcObject=stream;const det=new BarcodeDetector();
    const loop=async()=>{if(stop)return;try{const r=await det.detect(v);if(r.length){const it=db.items.find(i=>i.barcode===r[0].rawValue);if(it){addLine(it.id);navigator.vibrate&&navigator.vibrate(60);toast('تمت الإضافة: '+iname(it),'ok');await new Promise(z=>setTimeout(z,1200))}else{toast('باركود غير مسجل: '+r[0].rawValue,'warn');await new Promise(z=>setTimeout(z,1500))}}}catch(e){}setTimeout(loop,250)};loop();
  }catch(e){close();toast('تعذر تشغيل الكاميرا','err')}
}
function addLine(id){
  const i=item(id),sell=K()==='s';let l=S.cart.find(x=>x.itemId===id);
  if(l)l.qty=n(l.qty)+1;else{l={itemId:id,qty:1,price:sell?i.price:i.cost};S.cart.push(l)}
  if(sell&&n(l.qty)>i.qty)toast('تنبيه: المتاح '+i.qty+' فقط من '+iname(i),'warn');
  cartp();
}
const chg=(x,d)=>{const l=S.cart[x];l.qty=Math.max(0,n(l.qty)+d);if(l.qty<=0)S.cart.splice(x,1);cartp()};
const setQ=(x,v)=>{S.cart[x].qty=n(v);if(n(v)<=0)S.cart.splice(x,1);cartp()};
const setP=(x,v)=>{S.cart[x].price=n(v);cartp()};
const rmL=x=>{S.cart.splice(x,1);cartp()};
const cartTotal=()=>Math.max(0,sum(S.cart,l=>n(l.qty)*n(l.price))-(K()==='s'?n(S.disc):0));
function cartp(){
  const el=$('cartp');if(!el)return;
  const sell=K()==='s',tot=cartTotal(),parts=db.parties.filter(p=>p.type===(sell?'c':'s'));
  const credit=S.method==='آجل';
  const paid=S.paid===''?(credit?0:tot):n(S.paid);
  el.innerHTML='<b style="font-size:18px">🧾 الفاتورة</b>'+
  (S.cart.length?S.cart.map((l,x)=>{const i=item(l.itemId);return '<div class="cl"><div class="nm">'+h(i.name)+'<small>'+h([i.color,i.size].filter(Boolean).join(' • '))+'</small></div><div class="qty"><button onclick="chg('+x+',1)">+</button><input type="number" inputmode="decimal" value="'+l.qty+'" onchange="setQ('+x+',this.value)"><button onclick="chg('+x+',-1)">−</button></div><input class="pr" type="number" inputmode="decimal" value="'+l.price+'" onchange="setP('+x+',this.value)"><button class="x" onclick="rmL('+x+')">✕</button></div>'}).join(''):emptyBox('🛒','اضغطي على صنف لإضافته'))+
  '<label>'+(sell?'العميلة':'المورد')+(credit?' (مطلوب للآجل)':' (اختياري)')+'</label><div style="display:flex;gap:6px"><select onchange="S.party=this.value;cartp()"><option value="">— '+(sell?'عميلة نقدية':'بدون مورد')+' —</option>'+parts.map(p=>'<option value="'+p.id+'"'+(p.id===S.party?' selected':'')+'>'+h(p.name)+'</option>').join('')+'</select><button class="btn s ico" onclick="partyForm(\''+(sell?'c':'s')+'\',id=>{S.party=id;cartp()})">＋</button></div>'+
  '<label>طريقة الدفع</label><div class="mc">'+METHODS.map(m=>chip(m,S.method===m,'S.method=\''+m+'\';S.paid=\'\';cartp()')).join('')+'</div>'+
  (sell?'<label>خصم (جنيه)</label><input type="number" inputmode="decimal" value="'+h(S.disc)+'" onchange="S.disc=this.value;cartp()">':'')+
  '<label>المدفوع <small>(اتركيه فارغاً = '+(credit?'لم يُدفع شيء':'كامل المبلغ')+')</small></label><input type="number" inputmode="decimal" placeholder="'+f(credit?0:tot)+'" value="'+h(S.paid)+'" onchange="S.paid=this.value;cartp()">'+
  '<div style="margin-top:10px"><div class="tot"><span>عدد القطع</span><b>'+f(sum(S.cart,l=>n(l.qty)))+'</b></div>'+(sell&&n(S.disc)?'<div class="tot"><span>خصم</span><b>-'+f(S.disc)+'</b></div>':'')+(paid<tot?'<div class="tot"><span>المتبقي (دين)</span><b class="neg">'+f(tot-paid)+'</b></div>':paid>tot?'<div class="tot"><span>الباقي للعميلة</span><b>'+f(paid-tot)+'</b></div>':'')+
  '<div class="tot big"><span>الإجمالي</span><span>'+f(tot)+' ج</span></div></div>'+
  '<div class="row" style="margin-top:12px"><button class="btn g blk" style="flex:2" onclick="saveInv()">✔ حفظ الفاتورة</button>'+(S.cart.length?'<button class="btn s" onclick="S.cart=[];S.paid=\'\';S.disc=\'\';cartp()">تفريغ</button>':'')+'</div>';
}
function saveInv(){
  const k=K(),sell=k==='s';
  let inv;
  try{inv=Core.createInvoice(db,k,{cart:S.cart,partyId:S.party,disc:S.disc,paid:S.paid,method:S.method,id:uid(),date:today(),ts:Date.now()})}
  catch(e){return toast(e.message,'err')}
  save();
  S.cart=[];S.paid='';S.disc='';S.party='';S.method='كاش';render();toast('تم حفظ الفاتورة رقم '+inv.no,'ok');viewInv(k,inv.id);
}

// ================= الإيصال والفواتير =================
function receiptText(k,x){
  const p=party(x.partyId);
  return db.shop+(db.phone?' - '+db.phone:'')+'\n'+(k==='s'?'فاتورة بيع':'فاتورة شراء')+' رقم '+x.no+' - '+x.date+(p?'\n'+p.name:'')+'\n----------\n'+
  x.lines.map(l=>l.name+' × '+l.qty+' = '+f(l.qty*l.price)).join('\n')+'\n----------\n'+(x.disc?'خصم: '+f(x.disc)+'\n':'')+'الإجمالي: '+f(x.total)+'\nالمدفوع: '+f(x.paid)+(x.total>x.paid?'\nالمتبقي: '+f(x.total-x.paid):'')+'\n'+db.foot;
}
function viewInv(k,id){
  const x=(k==='s'?db.sales:db.purchases).find(y=>y.id===id);if(!x)return;
  const p=party(x.partyId),rets=db.returns.filter(r=>r.invoiceId===id);
  const body='<div class="rc"><h4>'+h(db.shop)+'</h4><div class="c">'+h(db.phone)+'</div><div class="c">'+(k==='s'?'فاتورة بيع':'فاتورة شراء')+' رقم '+x.no+' | '+x.date+'</div>'+(p?'<div class="c">'+h(p.name)+'</div>':'')+
  '<table style="margin-top:8px"><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr>'+x.lines.map(l=>'<tr><td class="w">'+h(l.name)+'</td><td>'+l.qty+'</td><td>'+f(l.price)+'</td><td>'+f(l.qty*l.price)+'</td></tr>').join('')+'</table><hr>'+
  (x.disc?'<div class="tot"><span>خصم</span><b>'+f(x.disc)+'</b></div>':'')+'<div class="tot"><b>الإجمالي</b><b>'+f(x.total)+'</b></div><div class="tot"><span>المدفوع ('+h(x.method||'')+')</span><span>'+f(x.paid)+'</span></div>'+(x.total>x.paid?'<div class="tot neg"><span>المتبقي</span><b>'+f(x.total-x.paid)+'</b></div>':'')+
  (rets.length?'<div class="tot neg"><span>مرتجعات</span><b>'+f(sum(rets,r=>r.amount))+'</b></div>':'')+'<div class="c" style="margin-top:8px">'+h(db.foot)+'</div></div>';
  sheet('الفاتورة رقم '+x.no,body,[
    {t:'🖨 طباعة',c:'s',pr:1,fn:()=>{window.print();return false}},
    {t:'واتساب',c:'w',fn:()=>{window.open(waLink(p&&p.phone,receiptText(k,x)),'_blank');return false}},
    {t:'↩ مرتجع',c:'s',fn:()=>{setTimeout(()=>returnForm(k,id),0)}},
    {t:'🗑 حذف',c:'d',fn:()=>{setTimeout(()=>delInv(k,id),0)}}
  ],{nofocus:1});
}
const returnedQty=(invId,itemId)=>Core.returnedQty(db,invId,itemId);
function returnForm(k,id){
  const x=(k==='s'?db.sales:db.purchases).find(y=>y.id===id),sell=k==='s';
  const rows=x.lines.map(l=>({l,max:l.qty-returnedQty(id,l.itemId)}));
  if(!rows.some(r=>r.max>0))return toast('تم إرجاع كل أصناف هذه الفاتورة','warn');
  sheet('مرتجع - فاتورة '+x.no,'<p style="color:var(--m)">اكتبي الكمية المرتجعة لكل صنف:</p>'+rows.map((r,i)=>r.max>0?'<div class="li"><span>'+h(r.l.name)+'<br><small style="color:var(--m)">المتاح للإرجاع: '+r.max+'</small></span><input style="width:90px" id="rq'+i+'" type="number" inputmode="decimal" min="0" max="'+r.max+'" value="0"></div>':'').join('')+
  '<label>طريقة الاسترداد</label><select id="rm"><option value="cash">'+(sell?'رد المبلغ نقداً':'استلام المبلغ نقداً')+'</option>'+(x.partyId?'<option value="credit">'+(sell?'خصم من حساب العميلة (رصيد لها)':'خصم من حساب المورد')+'</option>':'')+'</select>',
  [{t:'تأكيد المرتجع',c:'g',fn:()=>{
    const qtys={};rows.forEach((r,i)=>{qtys[r.l.itemId]=n(($('rq'+i)||{}).value)});
    try{const amount=Core.createReturn(db,k,id,qtys,$('rm').value,{id:uid(),payId:uid(),date:today()});save();render();toast('تم تسجيل المرتجع: '+f(amount)+' ج','ok')}
    catch(e){toast(e.message,'warn');return false}
  }},{t:'إلغاء',c:'s'}]);
}
async function delInv(k,id){
  if(!await ask('حذف الفاتورة سيرجع المخزون كما كان قبلها وسيحذف مرتجعاتها. متابعة؟','حذف'))return;
  Core.deleteInvoice(db,k,id);
  save();render();toast('تم حذف الفاتورة','ok');
}

// ================= المخزون =================
function itemsV(){
  const cats=[...new Set(db.items.map(i=>i.cat).filter(Boolean))];window.CATS=cats;
  return '<div class="ph"><h2>👗 المخزون والأصناف</h2><button class="btn" onclick="itemForm()">＋ صنف جديد</button></div>'+
  '<div class="grid">'+stat('عدد الأصناف',db.items.length)+stat('إجمالي القطع',f(sum(db.items,i=>i.qty)),'')+stat('قيمة التكلفة',f(sum(db.items,i=>i.qty*i.cost))+' ج','o')+stat('قيمة البيع المتوقعة',f(sum(db.items,i=>i.qty*i.price))+' ج','g')+'</div>'+
  '<input id="iq" placeholder="🔍 بحث بالاسم أو الباركود..." value="'+h(S.iq)+'" oninput="S.iq=this.value;itemsRows()" style="margin-bottom:8px">'+
  '<div class="chips">'+chip('الكل',!S.cat&&!S.low,'S.cat=\'\';S.low=false;render()')+chip('⚠️ المنخفض',S.low,'S.low=!S.low;render()')+cats.map((c,x)=>chip(c,S.cat===c,'S.cat=CATS['+x+'];render()')).join('')+'</div>'+
  '<div class="tw" id="irows"></div>';
}
function itemsRows(){
  const q=S.iq.trim().toLowerCase(),el=$('irows');if(!el)return;
  const l=db.items.filter(i=>(!S.cat||i.cat===S.cat)&&(!S.low||i.qty<=n(i.min))&&(!q||(iname(i)+(i.cat||'')+(i.barcode||'')).toLowerCase().includes(q)));
  el.innerHTML=l.length?'<table><tr><th>الصنف</th><th>القسم</th><th>التكلفة</th><th>البيع</th><th>الربح</th><th>الكمية</th><th></th></tr>'+l.map(i=>'<tr><td class="w"><b>'+h(i.name)+'</b><br><small style="color:var(--m)">'+h([i.color,i.size,i.barcode].filter(Boolean).join(' • '))+'</small></td><td>'+h(i.cat)+'</td><td>'+f(i.cost)+'</td><td>'+f(i.price)+'</td><td class="pos-n">'+f(i.price-i.cost)+'</td><td><span class="badge '+(i.qty<=0?'r':i.qty<=n(i.min)?'o':'g')+'">'+i.qty+'</span></td><td><button class="btn s sm" onclick="itemForm(\''+i.id+'\')">تعديل</button></td></tr>').join('')+'</table>':
    emptyBox('📦',db.items.length?'لا توجد نتائج':'لم تضيفي أصناف بعد. اضغطي «صنف جديد»');
}
function itemForm(id,copyOf){
  const src=id?item(id):copyOf?item(copyOf):null;
  const i=src?Object.assign({},src):{name:'',cat:'',color:'',size:'',barcode:'',cost:'',price:'',qty:'',min:2};
  const isNew=!id;if(copyOf){i.barcode='';i.qty=''}
  const cats=[...new Set(db.items.map(x=>x.cat).filter(Boolean))];
  sheet(id?'تعديل صنف':copyOf?'نسخ صنف (لون/مقاس جديد)':'صنف جديد',
    fld('f1','اسم الصنف (مثال: شال قطن)',i.name)+'<label>القسم</label><input id="f2" list="cl" value="'+h(i.cat)+'" placeholder="شالات / طرح / إيشاربات..."><datalist id="cl">'+cats.map(c=>'<option value="'+h(c)+'">').join('')+'</datalist>'+
    fld('f3',isNew?'اللون (أو عدة ألوان مفصولة بفاصلة لإنشاء صنف لكل لون)':'اللون',i.color)+fld('f4','المقاس',i.size)+fld('f9','الباركود (اختياري)',i.barcode||'')+
    '<div class="row">'+fld('f5','سعر التكلفة',i.cost,'number')+fld('f6','سعر البيع',i.price,'number')+'</div><div class="row">'+fld('f7',isNew?'الكمية (لكل لون)':'الكمية في المخزون',i.qty,'number')+fld('f8','تنبيه عند وصولها إلى',i.min,'number')+'</div>',
    [{t:'حفظ',c:'g',fn:()=>{
      const v=k=>$(k).value.trim();
      if(!v('f1')){toast('اكتبي اسم الصنف','err');return false}
      const bc=v('f9');if(bc&&db.items.some(x=>x.barcode===bc&&x.id!==id)){toast('هذا الباركود مسجل لصنف آخر','err');return false}
      const o={name:v('f1'),cat:v('f2'),size:v('f4'),barcode:bc,cost:n(v('f5')),price:n(v('f6')),qty:n(v('f7')),min:n(v('f8'))};
      if(id){Object.assign(item(id),o,{color:v('f3')})}
      else{const cols=v('f3').split(/[,،]/).map(s=>s.trim()).filter(Boolean);(cols.length?cols:['']).forEach((c,x)=>db.items.push(Object.assign({id:uid()},o,{color:c,barcode:x?'':bc})))}
      save();render();toast(o.price<o.cost?'تم الحفظ — تنبيه: سعر البيع أقل من التكلفة':'تم الحفظ',o.price<o.cost?'warn':'ok');
    }},id?{t:'نسخ',c:'s',fn:()=>{setTimeout(()=>itemForm(null,id),0)}}:null,id?{t:'حذف',c:'d',fn:()=>{setTimeout(()=>delItem(id),0)}}:null].filter(Boolean));
}
async function delItem(id){
  const used=[...db.sales,...db.purchases].some(x=>x.lines.some(l=>l.itemId===id));
  if(!await ask(used?'هذا الصنف موجود في فواتير سابقة (ستبقى كما هي). حذفه؟':'حذف الصنف؟','حذف'))return;
  db.items=db.items.filter(i=>i.id!==id);save();render();toast('تم الحذف','ok');
}

// ================= العملاء والموردين =================
function partiesV(){
  const c=S.ptab==='c',tot=sum(db.parties.filter(p=>p.type===S.ptab),p=>Math.max(0,balance(p.id)));
  return '<div class="ph"><h2>👥 الحسابات</h2><button class="btn" onclick="partyForm(S.ptab)">＋ '+(c?'عميلة جديدة':'مورد جديد')+'</button></div>'+
  '<div class="chips">'+chip('العملاء',c,'S.ptab=\'c\';render()')+chip('الموردين',!c,'S.ptab=\'s\';render()')+'</div>'+
  '<div class="grid">'+stat(c?'إجمالي المستحق لنا':'إجمالي المستحق علينا',f(tot)+' ج',c?'g':'r')+stat('العدد',db.parties.filter(p=>p.type===S.ptab).length)+'</div>'+
  '<input placeholder="🔍 بحث بالاسم أو الهاتف" value="'+h(S.pq)+'" oninput="S.pq=this.value;partiesList()" style="margin-bottom:10px"><div id="plist"></div>';
}
function partiesList(){
  const q=S.pq.trim().toLowerCase(),c=S.ptab==='c',el=$('plist');if(!el)return;
  const l=db.parties.filter(p=>p.type===S.ptab&&(!q||(p.name+p.phone).toLowerCase().includes(q))).sort((a,b)=>balance(b.id)-balance(a.id));
  el.innerHTML=l.length?l.map(p=>'<div class="card"><div class="pc"><div class="av">'+h(p.name.charAt(0))+'</div><div class="in"><b>'+h(p.name)+'</b><br><small style="color:var(--m)">'+h(p.phone||'بدون هاتف')+'</small></div>'+balLabel(p)+
    '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" onclick="statement(\''+p.id+'\')">كشف حساب</button><button class="btn g sm" onclick="payForm(\''+p.id+'\')">'+(c?'استلام دفعة':'سداد دفعة')+'</button>'+(c&&p.phone&&balance(p.id)>0.005?'<button class="btn w sm" onclick="remind(\''+p.id+'\')">تذكير</button>':'')+'<button class="btn s sm" onclick="partyForm(\''+p.type+'\',null,\''+p.id+'\')">تعديل</button></div></div></div>').join(''):emptyBox('👥','لا توجد حسابات');
}
function partyForm(type,cb,id){
  const p=id?party(id):{name:'',phone:''};
  sheet(id?'تعديل':type==='c'?'عميلة جديدة':'مورد جديد',fld('f1','الاسم',p.name)+fld('f2','رقم الهاتف (للواتساب)',p.phone,'tel'),[
    {t:'حفظ',c:'g',fn:()=>{
      const nm=$('f1').value.trim();if(!nm){toast('اكتبي الاسم','err');return false}
      if(id){p.name=nm;p.phone=$('f2').value.trim()}else{const np={id:uid(),type,name:nm,phone:$('f2').value.trim()};db.parties.push(np);if(cb)cb(np.id)}
      save();render();toast('تم الحفظ','ok');
    }},
    id?{t:'حذف',c:'d',fn:()=>{
      if(db.sales.concat(db.purchases).some(x=>x.partyId===id)||db.payments.some(x=>x.partyId===id)){toast('لا يمكن الحذف: لديه حركات مسجلة','err');return false}
      db.parties=db.parties.filter(x=>x.id!==id);save();render();toast('تم الحذف','ok')}}:null].filter(Boolean));
}
function statement(pid){
  const p=party(pid),c=p.type==='c';
  const rows=[...(c?db.sales:db.purchases).filter(x=>x.partyId===pid).map(x=>({d:x.date,ts:x.ts||0,t:(c?'فاتورة بيع ':'فاتورة شراء ')+x.no,a:x.total-x.paid,det:'إجمالي '+f(x.total)+' / مدفوع '+f(x.paid)})),
    ...db.payments.filter(x=>x.partyId===pid).map(x=>({d:x.date,ts:0,t:x.note||(c?'دفعة مستلمة':'دفعة مسددة'),a:-x.amount,det:''}))].sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:a.ts-b.ts);
  let run=0;
  sheet('كشف حساب: '+p.name,'<div class="tw" style="box-shadow:none"><table><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>الرصيد</th></tr>'+
    rows.map(r=>{run+=r.a;return '<tr><td>'+r.d+'</td><td class="w">'+h(r.t)+'<br><small style="color:var(--m)">'+r.det+'</small></td><td class="'+(r.a<0?'pos-n':'')+'">'+f(r.a)+'</td><td>'+f(run)+'</td></tr>'}).join('')+'</table></div><h3>الرصيد الحالي: '+balLabel(p)+'</h3>',
    [{t:c?'استلام دفعة':'سداد دفعة',c:'g',fn:()=>{setTimeout(()=>payForm(pid),0)}},{t:'🖨 طباعة',c:'s',pr:1,fn:()=>{window.print();return false}}],{wide:1,nofocus:1});
}
function payForm(pid){
  const p=party(pid),c=p.type==='c',b=balance(pid);
  sheet((c?'استلام دفعة من ':'سداد دفعة إلى ')+p.name,'<p>الرصيد الحالي: '+balLabel(p)+'</p>'+fld('f1','المبلغ',b>0?b:'','number'),[{t:'تسجيل',c:'g',fn:()=>{
    const a=n($('f1').value);if(a<=0){toast('المبلغ غير صحيح','err');return false}
    db.payments.push({id:uid(),date:today(),partyId:pid,amount:a});save();render();toast('تم تسجيل الدفعة','ok');
  }},{t:'إلغاء',c:'s'}]);
}

// ================= المصروفات =================
const ECATS=['إيجار','كهرباء ومياه','مرتبات','مواصلات','تغليف','إعلانات','أخرى'];
function expV(){
  const m=today().slice(0,7),l=[...db.expenses].sort((a,b)=>a.date<b.date?1:-1);
  const bycat={};db.expenses.filter(e=>e.date.startsWith(m)).forEach(e=>bycat[e.title]=(bycat[e.title]||0)+e.amount);
  return '<div class="ph"><h2>💸 المصروفات</h2><button class="btn" onclick="expForm()">＋ مصروف جديد</button></div>'+
  '<div class="grid">'+stat('مصروفات هذا الشهر',f(sum(db.expenses.filter(e=>e.date.startsWith(m)),e=>e.amount))+' ج','r')+stat('مصروفات اليوم',f(sum(db.expenses.filter(e=>e.date===today()),e=>e.amount))+' ج')+'</div>'+
  (Object.keys(bycat).length?'<div class="card"><b>توزيع مصروفات الشهر</b>'+Object.entries(bycat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="li"><span>'+h(k)+'</span><b>'+f(v)+'</b></div>').join('')+'</div>':'')+
  (l.length?'<div class="tw"><table><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th></th></tr>'+l.map(e=>'<tr><td>'+e.date+'</td><td class="w">'+h(e.title)+(e.note?'<br><small style="color:var(--m)">'+h(e.note)+'</small>':'')+'</td><td>'+f(e.amount)+'</td><td><button class="btn d sm" onclick="delExp(\''+e.id+'\')">حذف</button></td></tr>').join('')+'</table></div>':emptyBox('💸','لا توجد مصروفات مسجلة'));
}
function expForm(){
  sheet('مصروف جديد','<label>النوع / البيان</label><input id="f1" list="el" placeholder="إيجار، كهرباء..."><datalist id="el">'+ECATS.map(c=>'<option value="'+c+'">').join('')+'</datalist>'+fld('f2','المبلغ','','number')+fld('f3','التاريخ',today(),'date')+fld('f4','ملاحظة (اختياري)',''),[{t:'حفظ',c:'g',fn:()=>{
    const a=n($('f2').value);if(!$('f1').value.trim()||a<=0){toast('أكملي البيان والمبلغ','err');return false}
    db.expenses.push({id:uid(),date:$('f3').value||today(),title:$('f1').value.trim(),amount:a,note:$('f4').value.trim()});save();render();toast('تم تسجيل المصروف','ok');
  }},{t:'إلغاء',c:'s'}]);
}
async function delExp(id){if(await ask('حذف هذا المصروف؟','حذف')){db.expenses=db.expenses.filter(x=>x.id!==id);save();render();toast('تم الحذف','ok')}}

// ================= التقارير =================
function rng(){
  const t=today();
  if(S.range==='today')return[t,t];if(S.range==='week')return[addDays(t,-6),t];
  if(S.range==='month')return[t.slice(0,7)+'-01',t];if(S.range==='year')return[t.slice(0,4)+'-01-01',t];
  return[S.from||t.slice(0,7)+'-01',S.to||t];
}
function repV(){
  const[a,b]=rng(),r=profit(a,b);
  const top={};r.list.forEach(x=>x.lines.forEach(l=>{const t=top[l.name]=top[l.name]||{q:0,p:0};t.q+=l.qty;t.p+=l.qty*(l.price-l.cost)}));
  const tl=Object.entries(top).sort((x,y)=>y[1].q-x[1].q).slice(0,10);
  const meth={};r.list.forEach(x=>meth[x.method||'كاش']=(meth[x.method||'كاش']||0)+x.paid);
  const inv=[...db.sales.map(x=>({...x,k:'s'})),...db.purchases.map(x=>({...x,k:'b'}))].filter(x=>x.date>=a&&x.date<=b).sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0));
  const days=dailySales(a,b);
  const R=[['today','اليوم'],['week','7 أيام'],['month','هذا الشهر'],['year','هذه السنة'],['custom','فترة محددة']];
  return '<div class="ph noprint"><h2>📊 التقارير</h2>'+(NATIVE?'':'<button class="btn s" onclick="window.print()">🖨 طباعة</button>')+'</div>'+
  '<div class="chips noprint">'+R.map(x=>chip(x[1],S.range===x[0],'S.range=\''+x[0]+'\';render()')).join('')+'</div>'+
  (S.range==='custom'?'<div class="row noprint" style="margin-bottom:12px"><div>'+fld('d1','من',a,'date','onchange="S.from=this.value;render()"')+'</div><div>'+fld('d2','إلى',b,'date','onchange="S.to=this.value;render()"')+'</div></div>':'')+
  '<h3>الأرباح من '+a+' إلى '+b+'</h3><div class="grid">'+stat('إجمالي المبيعات',f(r.sales)+' ج')+stat('تكلفة البضاعة المباعة',f(r.cogs)+' ج','o')+stat('مجمل الربح',f(r.gross)+' ج','g')+stat('المصروفات',f(r.exp)+' ج','r')+stat('صافي الربح',f(r.net)+' ج',r.net<0?'r':'g')+stat('عدد الفواتير',r.count)+'</div>'+
  (days.length>1&&days.length<=31?'<div class="card"><b>المبيعات اليومية</b>'+bars(days,d=>days.length>10?'':dm(d))+'</div>':'')+
  '<div class="two"><div class="card"><b>الأكثر مبيعاً</b>'+(tl.map(([k,v])=>'<div class="li"><span>'+h(k)+'</span><span>'+v.q+' قطعة • ربح <b class="pos-n">'+f(v.p)+'</b></span></div>').join('')||emptyBox('📈','لا مبيعات في هذه الفترة'))+'</div>'+
  '<div class="card"><b>المحصّل حسب طريقة الدفع</b>'+(Object.entries(meth).map(([k,v])=>'<div class="li"><span>'+h(k)+'</span><b>'+f(v)+'</b></div>').join('')||emptyBox('💳','—'))+'</div></div>'+
  '<h3>تقرير المخزون</h3><p>قيمة المخزون بالتكلفة: <b>'+f(sum(db.items,i=>i.qty*i.cost))+'</b> • بسعر البيع: <b>'+f(sum(db.items,i=>i.qty*i.price))+'</b></p>'+
  '<div class="tw"><table><tr><th>الصنف</th><th>الكمية</th><th>قيمة التكلفة</th></tr>'+[...db.items].sort((x,y)=>x.qty-y.qty).map(i=>'<tr><td class="w">'+h(iname(i))+'</td><td class="'+(i.qty<=n(i.min)?'low':'')+'">'+i.qty+'</td><td>'+f(i.qty*i.cost)+'</td></tr>').join('')+'</table></div>'+
  '<h3>سجل الفواتير</h3><div class="tw">'+(inv.length?'<table><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>الطرف</th><th>الإجمالي</th><th>المدفوع</th><th class="noprint"></th></tr>'+inv.map(x=>'<tr><td>'+x.no+'</td><td>'+x.date+'</td><td>'+(x.k==='s'?'بيع':'شراء')+'</td><td>'+h(party(x.partyId)?party(x.partyId).name:'نقدي')+'</td><td>'+f(x.total)+'</td><td>'+f(x.paid)+'</td><td class="noprint"><button class="btn s sm" onclick="viewInv(\''+x.k+'\',\''+x.id+'\')">عرض</button></td></tr>').join('')+'</table>':emptyBox('🧾','لا توجد فواتير'))+'</div>'+
  '<div class="row noprint" style="margin-top:14px"><button class="btn s" onclick="csvInv()">⬇ تصدير الفواتير Excel</button><button class="btn s" onclick="csvItems()">⬇ تصدير المخزون Excel</button></div>';
}
function csv(rows){return '﻿'+rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\r\n')}
function csvInv(){
  const[a,b]=rng(),rows=[['النوع','رقم','التاريخ','الطرف','الصنف','الكمية','السعر','إجمالي الفاتورة','المدفوع']];
  [['بيع',db.sales],['شراء',db.purchases]].forEach(([t,arr])=>arr.filter(x=>x.date>=a&&x.date<=b).forEach(x=>x.lines.forEach(l=>rows.push([t,x.no,x.date,(party(x.partyId)||{}).name||'نقدي',l.name,l.qty,l.price,x.total,x.paid]))));
  dl('invoices-'+a+'_'+b+'.csv',csv(rows),'text/csv');
}
function csvItems(){dl('stock-'+today()+'.csv',csv([['الصنف','القسم','اللون','المقاس','الباركود','التكلفة','سعر البيع','الكمية']].concat(db.items.map(i=>[i.name,i.cat,i.color,i.size,i.barcode,i.cost,i.price,i.qty]))),'text/csv')}

// ================= الإعدادات =================
function setV(){
  return '<div class="ph"><h2>⚙️ الإعدادات والنسخ الاحتياطي</h2></div>'+
  '<div class="card"><b>بيانات المحل (تظهر في الفاتورة)</b>'+fld('s1','اسم المحل',db.shop,'text','onchange="db.shop=this.value;save();render()"')+fld('s2','هاتف المحل',db.phone,'tel','onchange="db.phone=this.value;save()"')+fld('s3','ملاحظة أسفل الفاتورة',db.foot,'text','onchange="db.foot=this.value;save()"')+'</div>'+
  '<div class="card"><b>🔒 قفل البرنامج</b><p style="color:var(--m);margin:6px 0">'+(db.pin?'القفل مفعّل.':'اختياري: رقم سري يُطلب عند فتح البرنامج.')+'</p><div class="row"><button class="btn" onclick="pinForm()">'+(db.pin?'تغيير الرقم':'تفعيل الرقم السري')+'</button>'+(db.pin?'<button class="btn s" onclick="db.pin=\'\';save();render();toast(\'تم إلغاء القفل\',\'ok\')">إلغاء القفل</button>':'')+'</div></div>'+
  cloudCard()+
  '<div class="card"><b>💾 نسخة احتياطية كملف</b><p style="color:var(--m);margin:6px 0">البيانات محفوظة على هذا التابلت فقط. آخر نسخة: <b>'+(db.lastBackup?new Date(db.lastBackup).toLocaleDateString('ar-EG'):'لم تؤخذ بعد')+'</b>. خذي نسخة كل أسبوع وأرسليها لنفسك على واتساب أو جوجل درايف.</p>'+
  '<div class="row"><button class="btn g" onclick="exportDb()">⬇ حفظ نسخة احتياطية</button></div><label>استرجاع من نسخة احتياطية</label><input type="file" accept=".json" onchange="importDb(this)"></div>'+
  '<div class="card"><b>🕘 لقطات تلقائية</b><p style="color:var(--m);margin:6px 0">يحفظ البرنامج تلقائياً لقطة يومياً (آخر 14 يوماً) داخل الجهاز. تفيدك لو حذفتِ شيئاً بالغلط.</p><button class="btn s" onclick="snapForm()">استرجاع من لقطة</button></div>'+
  '<div class="card"><b>أدوات</b><div class="row" style="margin-top:8px"><button class="btn s" onclick="demo()">تحميل بيانات تجريبية</button><button class="btn d" onclick="resetDb()">مسح كل البيانات</button></div></div>';
}
async function snapForm(){
  const days=await Store.listSnaps();
  if(!days.length)return toast('لا توجد لقطات بعد (تُحفظ أول لقطة بعد أول تعديل)','warn');
  sheet('اختاري اليوم للاسترجاع','<p style="color:var(--m)">سيتم استبدال البيانات الحالية ببيانات ذلك اليوم.</p>'+days.map(d=>'<div class="li"><b>'+d+'</b><button class="btn s sm" data-d="'+d+'" onclick="restoreSnap(this.dataset.d)">استرجاع</button></div>').join(''),[{t:'إغلاق',c:'s'}],{nofocus:1});
}
async function restoreSnap(day){
  if(!await ask('استرجاع بيانات يوم '+day+'؟ سيتم استبدال البيانات الحالية.','استرجاع'))return;
  const d=await Store.getSnap(day);if(!d)return toast('اللقطة غير موجودة','err');
  db=Core.migrate(d);save();document.querySelectorAll('.ov').forEach(o=>o.remove());document.body.classList.remove('hasov');render();toast('تم الاسترجاع','ok');
}
function pinForm(){
  sheet('الرقم السري',fld('p1','اكتبي رقماً من 4 إلى 8 أرقام','','password','inputmode="numeric" maxlength="8"'),[{t:'حفظ',c:'g',fn:()=>{
    const v=$('p1').value.trim();if(!/^\d{4,8}$/.test(v)){toast('أدخلي 4 إلى 8 أرقام','err');return false}
    db.pin=v;save();render();toast('تم تفعيل القفل. لا تنسي الرقم!','ok')}},{t:'إلغاء',c:'s'}]);
}
async function exportDb(){
  const name='backup-'+today()+'.json',json=JSON.stringify(db);
  try{
    if(NATIVE){
      const P=Capacitor.Plugins,r=await P.Filesystem.writeFile({path:name,data:json,directory:'CACHE',encoding:'utf8'});
      await P.Share.share({title:name,url:r.uri,dialogTitle:'احفظي النسخة الاحتياطية (واتساب / درايف)'});
    }else{
      const file=new File([json],name,{type:'application/json'});
      if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:name});
      else dl(name,json,'application/json');
    }
    db.lastBackup=Date.now();save();toast('تم حفظ النسخة الاحتياطية','ok');if(S.view==='home'||S.view==='set')render();
  }catch(e){if(e&&(e.name==='AbortError'||/cancel/i.test(e.message||'')))return;toast('تعذر حفظ النسخة الاحتياطية','err')}
}
function importDb(el){
  const r=new FileReader();r.onload=async()=>{try{const d=JSON.parse(r.result);if(!d.items)throw 0;if(await ask('سيتم استبدال كل البيانات الحالية بالنسخة. متابعة؟','استرجاع')){db=Core.migrate(d);save();render();toast('تم الاسترجاع','ok')}}catch(e){toast('ملف غير صالح','err')}};
  if(el.files[0])r.readAsText(el.files[0]);
}
async function resetDb(){if(await ask('هل أنتِ متأكدة؟ سيتم مسح كل البيانات نهائياً ولا يمكن التراجع!','مسح الكل')&&await ask('تأكيد أخير: مسح كل شيء؟','نعم، امسح')){db=Core.empty();save();render();toast('تم المسح','ok')}}
async function demo(){
  if((db.items.length||db.sales.length)&&!await ask('سيتم استبدال البيانات الحالية ببيانات تجريبية. متابعة؟','استبدال'))return;
  db=Core.empty();const mk=(name,cat,color,size,cost,price,qty)=>{const o={id:uid(),name,cat,color,size,barcode:'',cost,price,qty,min:3};db.items.push(o);return o};
  const a=mk('شال قطن','شالات','أسود','',90,150,12),b=mk('شال قطن','شالات','بيج','',90,150,8),c=mk('شال حرير','شالات','وردي','',160,260,2),d=mk('طرحة شيفون','طرح','أبيض','',45,80,25),e=mk('طرحة شيفون','طرح','كحلي','',45,80,2),f2=mk('إيشارب جيرسيه','إيشارب','رمادي','',35,65,15);
  a.barcode='1001';
  const cu=[{id:uid(),type:'c',name:'منى أحمد',phone:'01000000001'},{id:uid(),type:'c',name:'سارة محمد',phone:'01000000002'},{id:uid(),type:'s',name:'مصنع النور',phone:'01000000003'}];db.parties=cu;
  const t=today();
  [[6,[[a,2],[d,3]],cu[0],true],[5,[[b,1],[f2,2]],null],[3,[[c,1],[d,2]],cu[1],true],[2,[[a,1],[e,1]],null],[1,[[d,4],[f2,1]],null],[0,[[a,2],[c,1]],cu[0],true]].forEach(([ago,ls,p,cr])=>{
    const lines=ls.map(([i,q])=>({itemId:i.id,name:iname(i),qty:q,price:i.price,cost:i.cost})),tot=sum(lines,l=>l.qty*l.price);
    db.sales.push({id:uid(),no:++db.seq.s,date:addDays(t,-ago),ts:Date.now()-ago*864e5,partyId:p?p.id:'',total:tot,paid:cr?Math.round(tot/2):tot,disc:0,method:cr?'آجل':'كاش',lines});
  });
  db.expenses.push({id:uid(),date:addDays(t,-4),title:'إيجار',amount:2500,note:''},{id:uid(),date:addDays(t,-1),title:'كهرباء ومياه',amount:300,note:''});
  save();render();toast('تم تحميل البيانات التجريبية','ok');
}

// ================= القفل =================
function lockScreen(){
  if(!db.pin)return;
  const l=document.createElement('div');l.id='lock';
  l.innerHTML='<div style="font-size:54px">🔒</div><h2 style="color:#fff">'+h(db.shop)+'</h2><input id="lk" type="password" inputmode="numeric" maxlength="8" placeholder="••••"><div id="lke" style="height:22px;color:#ffb4a8"></div>';
  document.body.appendChild(l);setTimeout(()=>$('lk').focus(),50);
  $('lk').oninput=e=>{if(e.target.value===db.pin)l.remove();else if(e.target.value.length>=db.pin.length){$('lke').textContent='الرقم غير صحيح';e.target.value=''}};
}

// ================= السحابة =================
const cloudAgo=ts=>{if(!ts)return 'لم تتم بعد';const m=Math.round((Date.now()-ts)/60000);return m<1?'الآن':m<60?'منذ '+m+' دقيقة':new Date(ts).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})};
function cloudStatusHTML(){
  const s=Cloud.status();
  if(s.busy)return '<span class="badge o">⏳ جارٍ الرفع...</span>';
  if(s.lastErr)return '<span class="badge r">⚠️ '+h(s.lastErr)+'</span> <small style="color:var(--m)">سنعيد المحاولة تلقائياً</small>';
  if(s.dirty)return '<span class="badge o">بانتظار الرفع</span>';
  return '<span class="badge g">☁️ محفوظ في السحابة</span> <small style="color:var(--m)">آخر نسخة: '+cloudAgo(s.lastOk)+'</small>';
}
function cloudBanner(){
  const s=Cloud.status();if(!s.enabled)return '';
  if(s.signedIn)return '<div style="margin-bottom:12px">'+cloudStatusHTML()+'</div>';
  if(db.items.length||db.sales.length)return '<div class="banner"><span>☁️ فعّلي النسخ السحابي التلقائي: لو ضاع التابلت ترجع كل بياناتك.</span><button class="btn sm" onclick="cloudLogin()">تفعيل</button></div>';
  return '';
}
function cloudCard(){
  const s=Cloud.status();
  if(!s.enabled)return '';
  if(!s.signedIn)return '<div class="card"><b>☁️ النسخ الاحتياطي السحابي التلقائي</b><p style="color:var(--m);margin:6px 0">يحفظ بياناتك تلقائياً على الإنترنت بعد كل تعديل، فلو ضاع التابلت أو تعطل ترجع كل بياناتك على أي جهاز جديد. يعمل البرنامج بدون إنترنت، وعند عودة الإنترنت يرفع التعديلات.</p><button class="btn g" onclick="cloudLogin()">تفعيل النسخ السحابي</button></div>';
  return '<div class="card"><b>☁️ النسخ الاحتياطي السحابي</b><p style="margin:6px 0">الحساب: <b dir="ltr">'+h(s.email)+'</b></p><div id="cloudst" style="margin-bottom:10px">'+cloudStatusHTML()+'</div><div class="row"><button class="btn" onclick="cloudNow()">رفع الآن</button><button class="btn s" onclick="cloudRestore()">استرجاع من السحابة</button><button class="btn s" onclick="cloudOut()">تسجيل خروج</button></div></div>';
}
function updateCloudUI(){const a=$('cloudst'),b=$('cloudbn');if(a)a.innerHTML=cloudStatusHTML();if(b)b.innerHTML=cloudBanner()}
function closeSheets(){document.querySelectorAll('.ov').forEach(o=>o.remove());document.body.classList.remove('hasov')}
function cloudLogin(){
  sheet('☁️ النسخ السحابي','<p style="color:var(--m)">سجلي الدخول بالبريد الإلكتروني وكلمة المرور اللذين أعطاهما لكِ البائع. بياناتك لا يراها غيرك.</p>'+
    fld('ce','البريد الإلكتروني','','email','autocomplete="email" dir="ltr"')+fld('cp','كلمة المرور','','password','autocomplete="current-password" dir="ltr"')+'<p id="cerr" style="color:var(--r);min-height:22px;margin:8px 0 0"></p>',
    [{t:'دخول',c:'g',fn:()=>{cloudAuth();return false}},{t:'إلغاء',c:'s'}]);
}
async function cloudAuth(){
  const email=$('ce').value.trim(),pw=$('cp').value,err=$('cerr');
  if(!email||!pw){err.textContent='اكتبي البريد وكلمة المرور';return}
  err.style.color='var(--m)';err.textContent='⏳ لحظات...';
  try{
    await Cloud.signIn(email,pw);
    closeSheets();await cloudAfterLogin();
  }catch(e){err.style.color='var(--r)';err.textContent=Cloud.arabicError(e)}
}
async function cloudAfterLogin(){
  render();
  try{
    const l=await Cloud.latest(),hasLocal=!Cloud.isEmpty(db);
    if(!l){if(hasLocal){await Cloud.run(()=>db,true);toast('تم تفعيل النسخ السحابي ورفع بياناتك','ok')}else toast('تم تسجيل الدخول','ok');return}
    const info=l.items+' صنف و'+l.sales+' فاتورة بيع بتاريخ '+l.day;
    if(!hasLocal){if(await ask('وجدنا نسخة سحابية ('+info+'). استرجاعها على هذا الجهاز؟','استرجاع','g'))await cloudRestore(true);return}
    sheet('أيهما نعتمد؟','<p>على هذا الجهاز بيانات، وفي السحابة نسخة ('+info+').</p>',[
      {t:'رفع بيانات هذا الجهاز',c:'g',fn:async()=>{await Cloud.run(()=>db,true);toast('تم الرفع','ok')}},
      {t:'استرجاع نسخة السحابة',c:'s',fn:()=>{cloudRestore(true)}},{t:'لاحقاً',c:'s'}],{nofocus:1});
  }catch(e){toast(Cloud.arabicError(e),'err')}
}
async function cloudRestore(skip){
  if(!skip&&!await ask('سيتم استبدال بيانات هذا الجهاز ببيانات آخر نسخة سحابية. متابعة؟','استرجاع','d'))return;
  try{
    const d=await Cloud.download();if(!d)return toast('لا توجد نسخة سحابية','warn');
    await Store.snapshotNow(JSON.stringify(db),'قبل الاسترجاع');
    const pin=db.pin,bk=db.lastBackup;
    db=Core.migrate(d);db.pin=pin;db.lastBackup=bk;save();render();toast('تم الاسترجاع من السحابة','ok');
  }catch(e){toast(Cloud.arabicError(e),'err')}
}
async function cloudNow(){
  toast('جارٍ الرفع...');
  const ok=await Cloud.run(()=>db,true);
  toast(ok?'تم الرفع إلى السحابة':(Cloud.status().lastErr||'لا توجد بيانات لرفعها'),ok?'ok':'err');
}
async function cloudOut(){if(await ask('تسجيل الخروج يوقف النسخ السحابي على هذا الجهاز (بياناتك تبقى في السحابة). متابعة؟','خروج')){await Cloud.signOut();render();toast('تم تسجيل الخروج','ok')}}

if('serviceWorker' in navigator&&!NATIVE)navigator.serviceWorker.register('sw.js').catch(()=>{});
addEventListener('unhandledrejection',()=>toast('حدث خطأ غير متوقع','err'));
async function init(){
  try{const d=await Store.load(KEY);if(d)db=Core.migrate(d)}
  catch(e){
    // لا نكمل حتى لا نحفظ بيانات فارغة فوق البيانات الأصلية
    document.getElementById('main').innerHTML='<div class="card" style="margin:30px"><h2>تعذر قراءة البيانات</h2><p>لم يتم حذف أي شيء. أغلقي التطبيق وافتحيه من جديد.</p><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div>';
    return;
  }
  Store.persist();
  await Cloud.init();Cloud.onChange(updateCloudUI);
  addEventListener('online',()=>Cloud.run(()=>db));
  render();lockScreen();Cloud.resume(()=>db);
}
init();

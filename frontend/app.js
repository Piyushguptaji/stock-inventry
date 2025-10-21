// --- Config ---
const API_BASE = 'http://localhost:5000/api'; // change to your deployed API base
const STORAGE_KEY = 'fanbelts_entries_v1'; // local mirror for offline

const BRANDS = ["polygrip","fenner","local"];
const GROUPS = ["A","A teeth","B","B teeth","C","D"];
const NORMAL_MIN=25,NORMAL_MAX=160; const TEETH_MIN=25,TEETH_MAX=50;

let direction='IN';
let entries=[]; // entries from server

// --- DOM helpers ---
const $ = s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
function showToast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1500); }
function createEl(tag,props={},children=[]){ const el=document.createElement(tag); Object.assign(el,props); children.forEach(c=>el.appendChild(typeof c==='string'?document.createTextNode(c):c)); return el; }

// --- API ---
async function apiGet(path){ const r=await fetch(`${API_BASE}${path}`,{cache:'no-cache'}); if(!r.ok) throw new Error(`${r.status}`); return r.json(); }
async function apiPut(path, body){ const r=await fetch(`${API_BASE}${path}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error(`${r.status}`); return r.json(); }
async function apiPost(path, body){ const r=await fetch(`${API_BASE}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error(`${r.status}`); return r.json(); }
async function apiDelete(path){ const r=await fetch(`${API_BASE}${path}`,{method:'DELETE'}); if(!r.ok) throw new Error(`${r.status}`); return r.json(); }

// --- Local mirror ---
function loadLocal(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }
function saveLocal(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

// --- Select options ---
function rangeOptions(group){
  const isTeeth=/teeth/i.test(group);
  const min=isTeeth?TEETH_MIN:NORMAL_MIN;
  const max=isTeeth?TEETH_MAX:NORMAL_MAX;
  const frag=document.createDocumentFragment();
  for(let i=min;i<=max;i++){ const o=createEl('option',{value:String(i)}); o.textContent=i; frag.appendChild(o); }
  return frag;
}

// --- Form line ---
function addLine(prefill={brand:'polygrip',group:'A',number:25,qty:1}){
  const wrap=createEl('div',{className:'line'});
  const row=createEl('div',{className:'row'});
  const brandSel=createEl('select',{name:'brand'}); BRANDS.forEach(b=>{const o=createEl('option',{value:b}); o.textContent=b; brandSel.appendChild(o)}); brandSel.value=prefill.brand;
  const groupSel=createEl('select',{name:'group'}); GROUPS.forEach(g=>{const o=createEl('option',{value:g}); o.textContent=g; groupSel.appendChild(o)}); groupSel.value=prefill.group;
  const numSel=createEl('select',{name:'number'}); numSel.appendChild(rangeOptions(prefill.group)); numSel.value=String(prefill.number);
  const qtyInp=createEl('input',{type:'number',name:'qty',min:1,step:1,value:prefill.qty});
  const removeBtn=createEl('button',{className:'btn',type:'button'}); removeBtn.textContent='Remove'; removeBtn.addEventListener('click',()=>wrap.remove());
  groupSel.addEventListener('change',()=>{ numSel.innerHTML=''; numSel.appendChild(rangeOptions(groupSel.value)); });
  const col=(el,lbl)=>{ const c=createEl('div'); c.style.gridColumn='span 3'; const lab=createEl('label'); lab.textContent=lbl; c.appendChild(lab); c.appendChild(el); return c; };
  row.appendChild(col(brandSel,'Brand')); row.appendChild(col(groupSel,'Group')); row.appendChild(col(numSel,'Number')); row.appendChild(col(qtyInp,'Quantity'));
  const c5=createEl('div'); c5.style.gridColumn='span 12'; c5.style.marginTop='8px'; c5.appendChild(removeBtn);
  wrap.appendChild(row); wrap.appendChild(c5); $('#lines').appendChild(wrap);
}

// --- Stock math ---
function keyOf(e){ return `${e.brand}__${e.grp}__${e.num}`; }
function computeStock(list){ const m=new Map(); for(const e of list){ const k=keyOf(e); const d=e.dir==='IN'?e.qty:-e.qty; m.set(k,(m.get(k)||0)+d);} return m; }
function currentQty(list,brand,group,number){ const k=`${brand}__${group}__${number}`; const m=computeStock(list); return m.get(k)||0; }

// --- Validate ---
function validateLines(dir, base){
  const blocks=$$('#lines .line'); const errs=[];
  blocks.forEach((blk,i)=>{
    const brand=blk.querySelector('[name=brand]').value;
    const group=blk.querySelector('[name=group]').value;
    const number=Number(blk.querySelector('[name=number]').value);
    const qty=Number(blk.querySelector('[name=qty]').value);
    if(!brand||!group||!number||!qty||qty<1){
      errs.push(`Line ${i+1}: missing/invalid fields.`); return;
    }
    if(dir==='OUT'){
      const available=currentQty(base,brand,group,number);
      if(qty>available){
        errs.push(`Line ${i+1}: trying to sell ${qty} but only ${available} in stock for ${brand} / ${group} ${number}.`);
      }
    }
  });
  return errs;
}

// --- Rendering ---
function populateFilters(){ const brandSel=$('#fltBrand'); BRANDS.forEach(b=>{ const o=createEl('option',{value:b}); o.textContent=b; brandSel.appendChild(o); }); }
function renderSummary(list){
  const stock=computeStock(list); let totalItems=0,totalQty=0; const byBrand={};
  for(const [k,v] of stock){ if(v<=0) continue; totalItems++; totalQty+=v; const brand=k.split('__')[0]; byBrand[brand]=(byBrand[brand]||0)+v; }
  const cards=$('#summaryCards'); cards.innerHTML='';
  const mk=(t,v,s='')=>{ const c=createEl('div',{className:'card'}); const h=createEl('h4'); h.textContent=t; c.appendChild(h); const p=createEl('div',{style:'font-size:22px;font-weight:800'}); p.textContent=v; c.appendChild(p); if(s) c.appendChild(createEl('div',{className:'hint'},[s])); return c; };
  cards.appendChild(mk('Total SKUs',totalItems,'Unique (brand+group+number)'));
  cards.appendChild(mk('Total Qty',totalQty));
  const top=Object.entries(byBrand).sort((a,b)=>b[1]-a[1])[0];
  cards.appendChild(mk('Top Brand',top?`${top[0]} (${top[1]})`:'—'));
  cards.appendChild(mk('Last Updated', new Date().toLocaleString()));
}
function renderStockTable(list){
  const tbody=$('#stockTable tbody');
  const brandF=$('#fltBrand').value; const groupF=$('#fltGroup').value; const numberF=Number($('#fltNumber').value||0);
  const stock=computeStock(list); const rows=[];
  for(const [k,qty] of stock){
    if(qty<=0) continue;
    const [brand,group,number]=k.split('__');
    if(brandF && brand!==brandF) continue;
    if(groupF && group!==groupF) continue;
    if(numberF && Number(number)!==numberF) continue;
    rows.push({brand,group,number:Number(number),qty});
  }
  rows.sort((a,b)=> a.brand.localeCompare(b.brand)||a.group.localeCompare(b.group)||a.number-b.number);
  tbody.innerHTML=rows.map(r=>`<tr><td>${r.brand}</td><td>${r.group}</td><td>${r.number}</td><td>${r.qty}</td></tr>`).join('');
}
function renderActivity(list){
  const tbody=$('#activityTable tbody');
  const last=list.slice().sort((a,b)=>b.ts-a.ts).slice(0,100);
  tbody.innerHTML=last.map(e=>{
    const when=new Date(e.ts).toLocaleString();
    const pill=`<span class="pill ${e.dir==='IN'?'in':'out'}">${e.dir}</span>`;
    return `<tr><td>${when}</td><td>${pill}</td><td>${e.brand}</td><td>${e.grp}</td><td>${e.num}</td><td>${e.qty}</td></tr>`;
  }).join('');
}
function fullRefresh(list){ renderSummary(list); renderStockTable(list); renderActivity(list); }

// --- Events ---
function switchTab(name){
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  $('#panel-update').style.display=name==='update'?'block':'none';
  $('#panel-details').style.display=name==='details'?'block':'none';
  if(name==='details') fullRefresh(entries);
}
$$('.tab').forEach(t=> t.addEventListener('click',()=>switchTab(t.dataset.tab)));
$$('#directionSeg button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    direction=btn.dataset.dir;
    $$('#directionSeg button').forEach(b=>b.classList.toggle('active', b===btn));
  });
});
$('#btnAddLine').addEventListener('click',()=> addLine());

$('#btnSave').addEventListener('click', async ()=>{
  const errs=validateLines(direction, entries);
  if(errs.length){ alert(errs.join('\n')); return; } // <-- newline fixed

  const blocks=$$('#lines .line');
  const newOnes=blocks.map(blk=>({
    id:crypto.randomUUID(),
    dir:direction,
    brand:blk.querySelector('[name=brand]').value,
    grp:blk.querySelector('[name=group]').value,
    num:Number(blk.querySelector('[name=number]').value),
    qty:Number(blk.querySelector('[name=qty]').value),
    ts:Date.now(),
    iso:new Date().toISOString()
  }));

  // Append on server, then reload entries
  try{
    await apiPost('/entries/append', newOnes); // POST array
    const data = await apiGet('/entries');
    entries = data.entries; saveLocal(entries);
    showToast('Saved to server!');
  }catch(err){
    // fallback local only
    entries = entries.concat(newOnes); saveLocal(entries);
    alert('Server save failed. Saved locally only. Check API_BASE and CORS.');
  }

  $('#lines').innerHTML=''; addLine();
});

$('#btnResetForm').addEventListener('click',()=>{ $('#lines').innerHTML=''; addLine(); });
['change','input'].forEach(ev=>{
  $('#fltBrand').addEventListener(ev,()=>renderStockTable(entries));
  $('#fltGroup').addEventListener(ev,()=>renderStockTable(entries));
  $('#fltNumber').addEventListener(ev,()=>renderStockTable(entries));
});

$('#btnExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({version:1, entries}, null, 2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`fenbelts_entries_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

$('#importFile').addEventListener('change', async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  try{
    const text=await file.text();
    const data=JSON.parse(text);
    if(!data.entries||!Array.isArray(data.entries)) throw new Error('Invalid file');
    // Replace all on server
    try{
      await apiPut('/entries', data);
      const fresh=await apiGet('/entries');
      entries=fresh.entries; saveLocal(entries); fullRefresh(entries);
      showToast('Imported to server!');
    }catch{
      entries=data.entries; saveLocal(entries); fullRefresh(entries);
      alert('Server import failed. Loaded locally only.');
    }
  }catch(err){
    alert('Import failed: '+err.message);
  }
  e.target.value='';
});

$('#btnClearAll').addEventListener('click', async ()=>{
  if(!confirm('This will delete ALL data. Are you sure?')) return;
  try{
    await apiDelete('/entries');
    entries=[]; saveLocal(entries); fullRefresh(entries); showToast('Cleared on server');
  }catch{
    entries=[]; saveLocal(entries); fullRefresh(entries);
    alert('Server clear failed. Cleared local only.');
  }
});

// --- Init ---
async function boot(){
  populateFilters(); addLine();
  try{
    const data = await apiGet('/entries');
    entries=data.entries; saveLocal(entries);
  }catch{
    entries = loadLocal();
  }
  fullRefresh(entries);
}
boot();

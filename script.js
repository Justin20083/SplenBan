/* SplenBan — script.js */
'use strict';

// ── State ──────────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('splban_tx') || '[]');
let budgets      = JSON.parse(localStorage.getItem('splban_budgets') || '[]');
let userName     = localStorage.getItem('splban_name') || 'Usuario';
let currentPeriod = 'mes';
let currentType   = 'ingreso';
let currentTab    = 'home';
let currentATab   = 'categorias';
let currentGI     = 'gastos';
let chart         = null;
let balPrev       = 0;

const ICONS = {
  salario:'💼',freelance:'💻','inversión':'📈',regalo:'🎁',
  comida:'🍔',transporte:'🚗',salud:'🏥',entretenimiento:'🎬',
  ropa:'👕',hogar:'🏠','educación':'📚',otro:'📌','':'💳'
};

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setDefaultDate();
  renderAll();
  initSplash();
  initSwipe();
});

function initSplash() {
  const s = document.getElementById('splash');
  if (s) s.addEventListener('animationend', () => s.style.display = 'none');
}

function renderAll() {
  renderBalance();
  renderChart();
  renderTransactions();
  renderAnalysis();
  renderBudgets();
  renderWallet();
}

// ── Persist ────────────────────────────────────────────────
function save() {
  localStorage.setItem('splban_tx', JSON.stringify(transactions));
  localStorage.setItem('splban_budgets', JSON.stringify(budgets));
  localStorage.setItem('splban_name', userName);
}

// ── Theme ──────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('splban_theme');
  const dark  = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches;
  applyTheme(dark, false);
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
    if (!localStorage.getItem('splban_theme')) applyTheme(e.matches, true);
  });
}
function applyTheme(dark, animate) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const lbl = document.getElementById('themeRowLabel');
  if (lbl) lbl.textContent = dark ? 'Modo claro' : 'Modo oscuro';
  if (chart && animate) setTimeout(renderChart, 280);
}
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  localStorage.setItem('splban_theme', dark ? 'dark' : 'light');
  applyTheme(dark, true);
  showToast(dark ? '🌙 Modo oscuro' : '☀️ Modo claro');
}

// ── Tab navigation ─────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-view').forEach(v => v.classList.toggle('active', v.id === 'tab-' + tab));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'home') setTimeout(renderChart, 60);
  if (tab === 'stats') renderAnalysis();
  if (tab === 'budgets') renderBudgets();
}

// ── Settings panel ─────────────────────────────────────────
function openSettings() {
  document.getElementById('settingsPanel').classList.add('active');
  document.getElementById('overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('active');
  document.getElementById('overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ── Balance ────────────────────────────────────────────────
function fmtB(n) {
  return Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}
function fmtS(n) {
  return Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' $';
}
function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function animNum(el, from, to, ms) {
  if (!el) return;
  const t0 = performance.now();
  const step = ts => {
    const p = Math.min((ts - t0) / ms, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtB(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmtB(to);
  };
  requestAnimationFrame(step);
}

function renderBalance() {
  const inc = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const exp = transactions.filter(t => t.type === 'gasto').reduce((s, t)   => s + t.amount, 0);
  const bal = inc - exp;

  animNum(document.getElementById('balanceDisplay'), balPrev, bal, 600);
  balPrev = bal;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmtS(val); };
  set('totalIncome', inc);
  set('totalExpenses', exp);
  set('totalNet', bal);
  set('walletBalance', bal);
  set('walletCash', bal);
  set('walletCashRow', bal);

  // Balance amount color
  const balEl = document.getElementById('balanceDisplay');
  if (balEl) balEl.style.color = bal < 0 ? 'var(--red)' : 'var(--fg)';
}

// ── Chart ──────────────────────────────────────────────────
function changePeriod(p) {
  currentPeriod = p;
  document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.period === p));
  renderChart();
}
function renderChart() {
  const canvas = document.getElementById('financeChart');
  if (!canvas) return;
  const { labels, data } = getChartData(currentPeriod);
  const ctx = canvas.getContext('2d');
  if (chart) chart.destroy();
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const line  = dark ? '#ffffff' : '#000000';
  const tick  = dark ? '#3a3a3c' : '#c7c7cc';
  const gt    = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)';
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, gt); g.addColorStop(1, 'rgba(0,0,0,0)');
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      data, borderColor: line, borderWidth: 2.5,
      pointRadius: 0, pointHoverRadius: 5,
      pointHoverBackgroundColor: line,
      pointHoverBorderColor: dark ? '#000' : '#fff',
      pointHoverBorderWidth: 2,
      fill: true, backgroundColor: g, tension: 0.44
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: false, external: extTip } },
      scales: {
        x: { grid: { display: false }, border: { display: false },
             ticks: { color: tick, font: { size: 11 }, maxRotation: 0 } },
        y: { display: false }
      }
    }
  });
  // Show chart block only when there are transactions
  const cb = document.getElementById('chartBlock');
  if (cb) cb.style.display = transactions.length ? 'block' : 'none';
}
function extTip(ctx) {
  const tip = document.getElementById('chartTooltip');
  if (!tip) return;
  if (ctx.tooltip.opacity === 0) { tip.style.opacity = '0'; return; }
  const label = ctx.tooltip.dataPoints?.[0]?.label || '';
  const val   = ctx.tooltip.dataPoints?.[0]?.raw ?? 0;
  tip.textContent = `${label}: ${fmt(val)}`;
  tip.style.left    = ctx.tooltip.x + 'px';
  tip.style.top     = (ctx.tooltip.y - 34) + 'px';
  tip.style.opacity = '1';
}
function getChartData(period) {
  const now = new Date();
  if (period === 'dia') {
    const l=[], d=[];
    for (let i=6;i>=0;i--) {
      const day=new Date(now); day.setDate(day.getDate()-i);
      l.push(['Do','Lu','Ma','Mi','Ju','Vi','Sá'][day.getDay()]);
      d.push(netDay(day.toISOString().slice(0,10)));
    }
    return { labels:l, data:running(d) };
  }
  if (period === 'semana') {
    const l=[], d=[];
    for (let i=7;i>=0;i--) {
      const day=new Date(now); day.setDate(day.getDate()-i*7);
      const ws=wkStart(day), we=new Date(ws); we.setDate(we.getDate()+6);
      l.push('S'+wkNum(day)); d.push(netRange(ws,we));
    }
    return { labels:l, data:running(d) };
  }
  if (period === 'mes') {
    const l=[], d=[];
    const M=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    for (let i=4;i>=-1;i--) {
      const day=new Date(now.getFullYear(),now.getMonth()-i,1);
      l.push(M[day.getMonth()]);
      d.push(netRange(new Date(day.getFullYear(),day.getMonth(),1),new Date(day.getFullYear(),day.getMonth()+1,0)));
    }
    return { labels:l, data:running(d) };
  }
  if (period === 'año') {
    const l=[], d=[];
    for (let i=4;i>=0;i--) {
      const yr=now.getFullYear()-i; l.push(String(yr));
      d.push(netRange(new Date(yr,0,1),new Date(yr,11,31)));
    }
    return { labels:l, data:running(d) };
  }
  return { labels:[], data:[] };
}
function netDay(ds) {
  return transactions.filter(t=>t.date===ds).reduce((s,t)=>s+(t.type==='ingreso'?t.amount:-t.amount),0);
}
function netRange(s,e) {
  return transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return d>=s&&d<=e;})
    .reduce((s,t)=>s+(t.type==='ingreso'?t.amount:-t.amount),0);
}
function running(a) { let acc=0; return a.map(d=>{acc+=d;return acc;}); }
function wkStart(d) { const day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1); const s=new Date(d); s.setDate(diff); return s; }
function wkNum(d)   { const oj=new Date(d.getFullYear(),0,1); return Math.ceil((((d-oj)/86400000)+oj.getDay()+1)/7); }

// ── Transactions ───────────────────────────────────────────
function renderTransactions() {
  const list = document.getElementById('transactionsList');
  if (!list) return;
  const empty = document.getElementById('emptyState');

  if (!transactions.length) {
    if (empty) empty.style.display = 'flex';
    list.innerHTML = '';
    list.appendChild(empty || document.createElement('div'));
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...transactions].sort((a,b)=> b.date!==a.date ? b.date.localeCompare(a.date) : b.id-a.id);
  const groups = {};
  sorted.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));

  let html = '';
  Object.entries(groups).forEach(([date, txs], gi) => {
    html += `<div class="tx-group-lbl">${labelDate(date)}</div>`;
    txs.forEach((t, i) => {
      const isI   = t.type === 'ingreso';
      const ico   = ICONS[t.category] || '💳';
      const cat   = t.category ? cap(t.category) : (isI ? 'Ingreso' : 'Gasto');
      const note  = t.note ? ` · ${esc(t.note)}` : '';
      const delay = Math.min((gi*4+i)*28, 300);
      html += `
        <div class="tx-item" style="animation-delay:${delay}ms" data-id="${t.id}">
          <div class="tx-ico ${isI?'inc':'exp'}">${ico}</div>
          <div class="tx-info">
            <div class="tx-desc">${esc(t.description)}</div>
            <div class="tx-meta">${cat}${note}</div>
          </div>
          <div class="tx-right">
            <div class="tx-amt ${isI?'pos':'neg'}">${isI?'+':'-'}${fmt(t.amount)}</div>
            <div class="tx-date">${shortDate(t.date)}</div>
          </div>
          <button class="tx-del" onclick="deleteTx(${t.id})">✕</button>
        </div>`;
    });
  });

  // Rebuild: put empty back but hidden, then add tx html
  list.innerHTML = `<div id="emptyState" class="empty-state" style="display:none">
    <p class="empty-title">Aún no tienes transacciones</p>
    <p class="empty-sub">Agrega tu primera transacción</p>
    <button class="empty-plus" onclick="openModal()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" width="26" height="26"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  </div>${html}`;
}

function deleteTx(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.transition = 'all .24s ease';
    el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
    el.style.maxHeight = el.offsetHeight + 'px';
    requestAnimationFrame(() => { el.style.maxHeight = '0'; el.style.padding = '0'; });
    setTimeout(() => { transactions = transactions.filter(t => t.id !== id); save(); renderAll(); showToast('Eliminado'); }, 240);
  } else {
    transactions = transactions.filter(t => t.id !== id); save(); renderAll();
  }
}

function cap(s)  { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function esc(s)  { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function shortDate(ds) {
  if (!ds) return '';
  const d = new Date(ds+'T00:00:00');
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${M[d.getMonth()]}`;
}
function labelDate(ds) {
  const now = new Date(), y = new Date(now); y.setDate(now.getDate()-1);
  if (ds === now.toISOString().slice(0,10)) return 'Hoy';
  if (ds === y.toISOString().slice(0,10))  return 'Ayer';
  const d = new Date(ds+'T00:00:00');
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Swipe to delete ────────────────────────────────────────
function initSwipe() {
  let sx=0, el=null;
  document.addEventListener('touchstart', e => {
    const item = e.target.closest('.tx-item');
    if (!item) return; el=item; sx=e.touches[0].clientX;
  }, { passive:true });
  document.addEventListener('touchmove', e => {
    if (!el) return;
    const dx = e.touches[0].clientX - sx;
    if (dx < 0) el.style.transform = `translateX(${Math.max(dx,-80)}px)`;
  }, { passive:true });
  document.addEventListener('touchend', e => {
    if (!el) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (dx < -60) deleteTx(parseInt(el.dataset.id));
    else { el.style.transition='transform .2s'; el.style.transform=''; setTimeout(()=>{ if(el) el.style.transition=''; el=null; },200); }
    el=null;
  }, { passive:true });
}

// ── Analysis ───────────────────────────────────────────────
function setATab(tab) {
  currentATab = tab;
  document.querySelectorAll('.atab').forEach(b => b.classList.toggle('active', b.dataset.at === tab));
  renderAnalysis();
}
function setGI(gi) {
  currentGI = gi;
  document.querySelectorAll('.filter-pill[data-gi]').forEach(b => b.classList.toggle('active', b.dataset.gi === gi));
  renderAnalysis();
}
function openPeriodDropdown() { /* simple cycle for now */
  const labels = ['Este mes','Últimos 3 meses','Este año'];
  const el = document.getElementById('periodLabel');
  if (!el) return;
  const idx = labels.indexOf(el.textContent);
  el.textContent = labels[(idx+1) % labels.length];
  renderAnalysis();
}
function renderAnalysis() {
  const body = document.getElementById('analysisBody');
  if (!body) return;
  const type = currentGI === 'gastos' ? 'gasto' : 'ingreso';
  const txs  = transactions.filter(t => t.type === type);
  const total = txs.reduce((s,t) => s + t.amount, 0);

  if (!txs.length) {
    body.innerHTML = `<div class="analysis-empty"><p class="empty-title">Análisis</p><p class="empty-sub">No tienes transacciones para este período</p></div>`;
    return;
  }

  const catMap = {};
  txs.forEach(t => { catMap[t.category||'otro'] = (catMap[t.category||'otro']||0) + t.amount; });
  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const max = sorted[0][1];

  body.innerHTML = sorted.map(([cat,val],i) => {
    const pct = Math.round((val/total)*100);
    const w   = Math.round((val/max)*100);
    const ico = ICONS[cat] || '📌';
    return `
      <div class="cat-item" style="animation-delay:${i*35}ms">
        <div class="cat-header">
          <span class="cat-name">${ico} ${cap(cat)}</span>
          <span class="cat-amt">${fmt(val)} <span style="color:var(--fg3);font-size:.75rem;font-weight:500">${pct}%</span></span>
        </div>
        <div class="cat-track">
          <div class="cat-fill ${type==='gasto'?'exp':'inc'}" style="width:${w}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Budgets ────────────────────────────────────────────────
function renderBudgets() {
  const card = document.getElementById('budgetsCard');
  if (!card) return;
  if (!budgets.length) {
    card.innerHTML = `<p style="color:var(--fg3);font-size:.9rem;padding:20px 0;text-align:center">Sin presupuestos aún</p>`;
    return;
  }
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth()+1, 0);

  let html = '<div class="budgets-card-section"><h3>Presupuestos</h3>';
  budgets.forEach(b => {
    const spent = transactions.filter(t => t.type==='gasto' && (!b.cat||t.category===b.cat))
      .filter(t => { const d=new Date(t.date+'T00:00:00'); return d>=start&&d<=end; })
      .reduce((s,t)=>s+t.amount,0);
    const pct = Math.min((spent/b.limit)*100, 100);
    const cls = pct>=100?'over':pct>=80?'warn':'';
    html += `
      <div class="budget-row">
        <div class="budget-row-header">
          <span class="budget-row-name">${ICONS[b.cat]||'📌'} ${esc(b.name)}</span>
          <span class="budget-row-vals">${fmt(spent)} / ${fmt(b.limit)}</span>
        </div>
        <div class="budget-track"><div class="budget-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
  });
  html += '</div>';
  card.innerHTML = html;
}

function openBudgetModal()  { toggleLayer('budgetOverlay','budgetModal',true); setTimeout(()=>document.getElementById('budgetNameInput')?.focus(),350); }
function closeBudgetModal() { toggleLayer('budgetOverlay','budgetModal',false); }
function saveBudget() {
  const name  = document.getElementById('budgetNameInput').value.trim();
  const limit = parseFloat(document.getElementById('budgetLimitInput').value);
  const cat   = document.getElementById('budgetCatSelect').value;
  if (!name)           { shake('budgetNameInput');  return; }
  if (!limit||limit<=0){ shake('budgetLimitInput'); return; }
  budgets.push({ id:Date.now(), name, limit, cat });
  save(); closeBudgetModal(); renderBudgets();
  showToast('Presupuesto creado','success');
}

// ── Wallet ─────────────────────────────────────────────────
function renderWallet() { /* amounts set by renderBalance */ }

// ── Modal: Nueva transacción ───────────────────────────────
function openModal() {
  setDefaultDate();
  const sug = document.getElementById('aiSuggestion'); if (sug) sug.style.display='none';
  ['descInput','amountInput','noteInput'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  document.getElementById('categorySelect').value = '';
  setType('ingreso');
  toggleLayer('modalOverlay','transactionModal',true);
  setTimeout(()=>document.getElementById('descInput')?.focus(),350);
}
function closeModal() { toggleLayer('modalOverlay','transactionModal',false); }
function setDefaultDate() { const e=document.getElementById('dateInput'); if(e) e.value=new Date().toISOString().slice(0,10); }
function setType(t) {
  currentType=t;
  document.getElementById('btnIngreso')?.classList.toggle('active',t==='ingreso');
  document.getElementById('btnGasto')?.classList.toggle('active',t==='gasto');
}
function saveTransaction() {
  const desc   = document.getElementById('descInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const cat    = document.getElementById('categorySelect').value;
  const date   = document.getElementById('dateInput').value;
  const note   = document.getElementById('noteInput').value.trim();
  if (!desc)           { shake('descInput');   return; }
  if (!amount||amount<=0){ shake('amountInput'); return; }
  if (!date)           { shake('dateInput');   return; }
  transactions.unshift({ id:Date.now(), type:currentType, description:desc, amount, category:cat, date, note });
  save(); closeModal();
  setTimeout(()=>{ renderAll(); showToast(currentType==='ingreso'?'Ingreso guardado':'Gasto guardado','success'); },180);
}
function shake(id) {
  const el=document.getElementById(id); if(!el) return;
  el.style.borderColor='var(--red)'; el.style.animation='none';
  requestAnimationFrame(()=> el.style.animation='shake .3s ease');
  setTimeout(()=>{ el.style.borderColor=''; el.style.animation=''; },600);
}

// ── Settings helpers ───────────────────────────────────────
function openEditName() {
  document.getElementById('nameInput').value = userName;
  closeSettings();
  toggleLayer('nameOverlay','nameModal',true);
  setTimeout(()=>document.getElementById('nameInput')?.focus(),350);
}
function closeEditName() { toggleLayer('nameOverlay','nameModal',false); }
function saveName() {
  const val = document.getElementById('nameInput').value.trim();
  if (!val) return;
  userName=val; save(); closeEditName(); showToast('Nombre actualizado','success');
}
function exportData() {
  if (!transactions.length) { showToast('Sin datos','error'); return; }
  const csv=['Fecha,Tipo,Descripcion,Categoria,Monto,Nota',
    ...transactions.map(t=>`${t.date},${t.type},"${t.description}","${t.category||''}",${t.amount},"${t.note||''}"`)
  ].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`splban_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); closeSettings(); showToast('CSV exportado','success');
}
function clearAllData() {
  if (!confirm('¿Borrar todas las transacciones? No se puede deshacer.')) return;
  transactions=[]; balPrev=0; save(); renderAll(); closeSettings(); showToast('Datos eliminados');
}

// ── Generic layer toggle ───────────────────────────────────
function toggleLayer(ovId, panelId, open) {
  document.getElementById(ovId)?.classList.toggle('active',open);
  document.getElementById(panelId)?.classList.toggle('active',open);
  document.body.style.overflow = open ? 'hidden' : '';
}

// ── Search (simple) ────────────────────────────────────────
function openSearchPanel() { showToast('Búsqueda próximamente'); }

// ── AI Panel ───────────────────────────────────────────────
function openAIPanel()  { toggleLayer('aiOverlay','aiPanel',true);  }
function closeAIPanel() { toggleLayer('aiOverlay','aiPanel',false); }
function aiQ(type) {
  const msgs={resumen:'Dame un resumen',consejo:'Dame un consejo',mayor_gasto:'Mayor categoría de gasto',ahorro:'Cuánto podría ahorrar'};
  document.getElementById('aiUserInput').value=msgs[type]||''; sendAI();
}
function sendAI() {
  const input=document.getElementById('aiUserInput');
  const text=input.value.trim(); if(!text) return;
  addMsg(text,'user'); input.value='';
  const tid='t'+Date.now(); addMsg('Escribiendo...','bot typing',tid);
  setTimeout(()=>{
    const el=document.getElementById(tid);
    if(el){el.classList.remove('typing');el.querySelector('p').textContent=aiResp(text);}
    const c=document.getElementById('aiChat'); if(c) c.scrollTop=c.scrollHeight;
  },700+Math.random()*400);
}
function addMsg(text,role,id) {
  const chat=document.getElementById('aiChat');
  const div=document.createElement('div'); div.className=`ai-msg ${role}`; if(id) div.id=id;
  const p=document.createElement('p'); p.textContent=text; div.appendChild(p); chat.appendChild(div);
  chat.scrollTop=chat.scrollHeight;
}
function aiResp(msg) {
  msg=msg.toLowerCase();
  const inc=transactions.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0);
  const exp=transactions.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);
  const bal=inc-exp;
  const cm={};transactions.filter(t=>t.type==='gasto').forEach(t=>{cm[t.category||'otro']=(cm[t.category||'otro']||0)+t.amount;});
  const top=Object.entries(cm).sort((a,b)=>b[1]-a[1])[0];
  if(msg.includes('resumen')||msg.includes('balance')) {
    if(!transactions.length) return '📊 Sin transacciones aún. Agrega con el botón +.';
    return `📊 Balance: ${fmt(bal)}\nIngresos: ${fmt(inc)}\nGastos: ${fmt(exp)}\n\n${bal>=0?'✅ Finanzas positivas':'⚠️ Gastos > Ingresos'}`;
  }
  if(msg.includes('categ')||msg.includes('gasto')) {
    if(!top) return '🔍 Sin gastos registrados.';
    return `🔍 Mayor: ${cap(top[0])} con ${fmt(top[1])} (${Math.round(top[1]/exp*100)}%)`;
  }
  if(msg.includes('consejo')||msg.includes('recomend')) {
    if(!transactions.length) return '💡 Registra transacciones primero.';
    const r=inc>0?((inc-exp)/inc)*100:0;
    if(r<0)  return '💡 Gastos > ingresos. Reduce los no esenciales.';
    if(r<20) return `💡 Ahorro: ${Math.round(r)}%. Meta: 20%.`;
    return `💡 ¡Excelente! ${Math.round(r)}% de ahorro. Considera invertir.`;
  }
  if(msg.includes('ahorr')) {
    if(!inc) return '💰 Agrega ingresos primero.';
    const p=inc-exp; return p<=0?`💰 Reduce gastos en ${fmt(Math.abs(p)+1)}.`:`💰 Podrías ahorrar ${fmt(p)}.`;
  }
  return `Balance: ${fmt(bal)} | Ingresos: ${fmt(inc)} | Gastos: ${fmt(exp)}\n\n¿Resumen, consejo o análisis?`;
}
function aiSuggestCategory() {
  const desc=document.getElementById('descInput').value.trim().toLowerCase();
  if(!desc){showAISug('✨ Escribe descripción primero.');return;}
  const rules=[
    {k:['salario','sueldo','nómina','quincena'],c:'salario'},
    {k:['freelance','proyecto','honorario'],c:'freelance'},
    {k:['inversión','acción','crypto','bitcoin'],c:'inversión'},
    {k:['regalo','present','cumpleaños'],c:'regalo'},
    {k:['comida','super','restaurante','almuerzo','cena','desayuno','pizza','burger','café','mercado'],c:'comida'},
    {k:['uber','taxi','gasolina','bus','metro','avión'],c:'transporte'},
    {k:['doctor','farmacia','hospital','medicamento','dental'],c:'salud'},
    {k:['netflix','spotify','cine','streaming','disney'],c:'entretenimiento'},
    {k:['ropa','zapatos','zara','tenis'],c:'ropa'},
    {k:['renta','alquiler','luz','agua','internet','gas'],c:'hogar'},
    {k:['curso','libro','universidad','escuela'],c:'educación'},
  ];
  const m=rules.find(r=>r.k.some(k=>desc.includes(k)));
  if(m){document.getElementById('categorySelect').value=m.c;showAISug(`✨ ${ICONS[m.c]||'📌'} ${cap(m.c)}`);}
  else showAISug('✨ No encontré categoría exacta.');
}
function showAISug(text) {
  const el=document.getElementById('aiSuggestion'); if(!el) return;
  document.getElementById('aiSuggestionText').textContent=text;
  el.style.display='block';
}

// ── Toast ──────────────────────────────────────────────────
let _tt=null;
function showToast(msg,type='') {
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.className=`toast ${type}`;
  clearTimeout(_tt);
  requestAnimationFrame(()=>{ t.classList.add('show'); _tt=setTimeout(()=>t.classList.remove('show'),2500); });
}

/* ═══════════════════════════════════════════════════════
   SPEED-DIAL
═══════════════════════════════════════════════════════ */
let sdOpen = false;

function toggleSpeedDial() {
  sdOpen ? closeSpeedDial() : openSpeedDial();
}

function openSpeedDial() {
  sdOpen = true;
  const dial    = document.getElementById('speedDial');
  const trigger = document.getElementById('speedDialTrigger');
  const backdrop = document.getElementById('sdBackdrop');
  const plus    = trigger.querySelector('.sd-icon-plus');
  const x       = trigger.querySelector('.sd-icon-x');

  dial.classList.add('open');
  trigger.classList.add('open');
  backdrop.classList.add('active');
  if (plus) { plus.style.display = 'none'; }
  if (x)    { x.style.display = 'block'; }

  // Haptic feedback if available
  if (navigator.vibrate) navigator.vibrate(8);
}

function closeSpeedDial() {
  sdOpen = false;
  const dial    = document.getElementById('speedDial');
  const trigger = document.getElementById('speedDialTrigger');
  const backdrop = document.getElementById('sdBackdrop');
  const plus    = trigger.querySelector('.sd-icon-plus');
  const x       = trigger.querySelector('.sd-icon-x');

  dial.classList.remove('open');
  trigger.classList.remove('open');
  backdrop.classList.remove('active');
  if (plus) { plus.style.display = 'block'; }
  if (x)    { x.style.display = 'none'; }
}

/* ═══════════════════════════════════════════════════════
   VOICE AI
═══════════════════════════════════════════════════════ */
let recognition = null;
let voiceActive = false;
let voiceListening = false;

function openVoiceAI() {
  closeSpeedDial();
  const panel = document.getElementById('voicePanel');
  panel.classList.add('active');
  document.body.style.overflow = 'hidden';
  resetVoiceUI();

  // Init speech recognition if available
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    document.getElementById('voiceStatus').textContent = 'Voz no disponible en este navegador';
    document.getElementById('voiceHint').textContent = 'Usa el chat IA en su lugar.';
    document.getElementById('voiceMicBtn').disabled = true;
    return;
  }

  recognition = new SR();
  recognition.lang = 'es-MX';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript).join('');
    showVoiceTranscript(transcript);
    if (e.results[0].isFinal) {
      handleVoiceInput(transcript);
    }
  };

  recognition.onend = () => {
    setVoiceListening(false);
  };

  recognition.onerror = (e) => {
    setVoiceListening(false);
    if (e.error === 'not-allowed') {
      document.getElementById('voiceStatus').textContent = 'Permiso de micrófono denegado';
    } else {
      document.getElementById('voiceStatus').textContent = 'Error: ' + e.error;
    }
  };
}

function closeVoiceAI() {
  const panel = document.getElementById('voicePanel');
  panel.classList.remove('active', 'listening');
  document.body.style.overflow = '';
  if (recognition) {
    try { recognition.stop(); } catch(e){}
    recognition = null;
  }
  voiceListening = false;
}

function resetVoiceUI() {
  const panel = document.getElementById('voicePanel');
  panel.classList.remove('listening');
  document.getElementById('voiceStatus').textContent = 'Toca el micrófono para hablar';
  document.getElementById('voiceHint').style.display = 'block';
  document.getElementById('voiceTranscript').style.display = 'none';
  document.getElementById('voiceResponse').style.display = 'none';
  document.getElementById('voiceTapHint').textContent = 'Toca para hablar';
}

function toggleVoice() {
  if (voiceListening) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  if (!recognition) return;
  voiceListening = true;
  setVoiceListening(true);
  try { recognition.start(); } catch(e) { setVoiceListening(false); }
}

function stopVoice() {
  voiceListening = false;
  setVoiceListening(false);
  if (recognition) try { recognition.stop(); } catch(e) {}
}

function setVoiceListening(active) {
  voiceListening = active;
  const panel  = document.getElementById('voicePanel');
  const status = document.getElementById('voiceStatus');
  const hint   = document.getElementById('voiceHint');
  const tapHint = document.getElementById('voiceTapHint');

  if (active) {
    panel.classList.add('listening');
    status.textContent = 'Escuchando...';
    hint.style.display = 'none';
    tapHint.textContent = 'Toca para detener';
    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
  } else {
    panel.classList.remove('listening');
    status.textContent = 'Procesando...';
    tapHint.textContent = 'Toca para hablar';
  }
}

function showVoiceTranscript(text) {
  const el = document.getElementById('voiceTranscript');
  const p  = document.getElementById('voiceTranscriptText');
  el.style.display = 'block';
  p.textContent = '"' + text + '"';
  // Hide hint
  document.getElementById('voiceHint').style.display = 'none';
}

function handleVoiceInput(text) {
  setVoiceListening(false);
  document.getElementById('voiceStatus').textContent = 'Analizando...';
  showVoiceTranscript(text);

  setTimeout(() => {
    const result = processVoiceCommand(text);
    showVoiceResponse(result);
    document.getElementById('voiceStatus').textContent = 'Listo';
    document.getElementById('voiceTapHint').textContent = 'Toca para hablar de nuevo';

    // Restart for next input
    if (recognition) {
      try { recognition.start(); } catch(e) {}
    }
  }, 700);
}

function processVoiceCommand(text) {
  const lower = text.toLowerCase();

  // Pattern: "gasté X en Y" / "gasto de X" / "pagué X"
  const expPatterns = [
    /gast[eé]\s+\$?([\d,\.]+)\s+en\s+(.+)/i,
    /gasto\s+de\s+\$?([\d,\.]+)(?:\s+en\s+(.+))?/i,
    /pagu[eé]\s+\$?([\d,\.]+)(?:\s+(?:en|por|de)\s+(.+))?/i,
    /compr[eé]\s+(?:.+\s+)?(?:por|de)?\s*\$?([\d,\.]+)/i,
  ];

  // Pattern: "ingresé X" / "recibí X" / "gané X"
  const incPatterns = [
    /ingres[eé]\s+\$?([\d,\.]+)(?:\s+(?:de|por)\s+(.+))?/i,
    /recib[ií]\s+\$?([\d,\.]+)(?:\s+(?:de|por)\s+(.+))?/i,
    /gan[eé]\s+\$?([\d,\.]+)(?:\s+(?:de|por|en)\s+(.+))?/i,
    /ingreso\s+de\s+\$?([\d,\.]+)(?:\s+(?:de|por)\s+(.+))?/i,
    /salario\s+de\s+\$?([\d,\.]+)/i,
  ];

  let match, type, amount, desc;

  for (const pat of expPatterns) {
    match = lower.match(pat);
    if (match) { type = 'gasto'; amount = parseFloat(match[1].replace(',','.')); desc = match[2] || 'Gasto'; break; }
  }
  if (!match) {
    for (const pat of incPatterns) {
      match = lower.match(pat);
      if (match) { type = 'ingreso'; amount = parseFloat(match[1].replace(',','.')); desc = match[2] || 'Ingreso'; break; }
    }
  }

  if (match && amount > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const cat = guessCategory(desc || lower);
    const tx = { id: Date.now(), type, description: cap(desc.trim()), amount, category: cat, date: today, note: 'Registrado por voz' };
    transactions.unshift(tx);
    save();
    renderAll();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    return `✅ Registrado: ${type === 'gasto' ? 'Gasto' : 'Ingreso'} de ${fmt(amount)} en "${cap(desc.trim())}"\n\nBalance actualizado: ${fmt(transactions.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0) - transactions.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0))}`;
  }

  // Analysis questions
  const response = aiResp(text);
  return response;
}

function guessCategory(text) {
  const rules = [
    {k:['comida','restaurante','super','almuerzo','cena','desayuno','pizza','burger','café','mercado'],c:'comida'},
    {k:['uber','taxi','gasolina','bus','metro','transporte'],c:'transporte'},
    {k:['doctor','farmacia','hospital','medicamento'],c:'salud'},
    {k:['netflix','spotify','cine','streaming'],c:'entretenimiento'},
    {k:['ropa','zapatos','tenis'],c:'ropa'},
    {k:['renta','alquiler','luz','agua','internet','gas'],c:'hogar'},
    {k:['curso','libro','escuela','universidad'],c:'educación'},
    {k:['salario','sueldo','nómina','quincena'],c:'salario'},
    {k:['freelance','proyecto','honorario'],c:'freelance'},
  ];
  for (const r of rules) {
    if (r.k.some(k => text.includes(k))) return r.c;
  }
  return 'otro';
}

/* ═══════════════════════════════════════════════════════
   ENHANCED AI PANEL
═══════════════════════════════════════════════════════ */

// Particle system for AI panel background
let aiParticleAnim = null;
const aiParticles = [];

function initAIParticles() {
  const canvas = document.getElementById('aiParticles');
  if (!canvas) return;
  const panel = document.getElementById('aiPanel');
  canvas.width  = panel.offsetWidth  || 480;
  canvas.height = panel.offsetHeight || 500;

  // Create particles
  aiParticles.length = 0;
  const count = 28;
  for (let i = 0; i < count; i++) {
    aiParticles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + .5,
      vx: (Math.random() - .5) * .35,
      vy: (Math.random() - .5) * .35,
      o: Math.random() * .5 + .1,
    });
  }
  animateAIParticles(canvas);
}

function animateAIParticles(canvas) {
  if (aiParticleAnim) cancelAnimationFrame(aiParticleAnim);
  const ctx = canvas.getContext('2d');

  function draw() {
    if (!document.getElementById('aiPanel').classList.contains('active')) {
      cancelAnimationFrame(aiParticleAnim);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    for (const p of aiParticles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = dark
        ? `rgba(168,85,247,${p.o})`
        : `rgba(124,58,237,${p.o * .5})`;
      ctx.fill();
    }

    aiParticleAnim = requestAnimationFrame(draw);
  }
  draw();
}

// Override openAIPanel to init particles
const _origOpenAI = openAIPanel;
openAIPanel = function() {
  toggleLayer('aiOverlay', 'aiPanel', true);
  setTimeout(initAIParticles, 50);
};

// Override sendAI to add pulse animation
const _origSendAI = sendAI;
sendAI = function() {
  const input = document.getElementById('aiUserInput');
  const text = input.value.trim();
  if (!text) return;

  // Animate send button
  const btn = document.getElementById('aiSendBtn');
  if (btn) {
    btn.style.transform = 'scale(.88) rotate(-10deg)';
    btn.style.transition = 'transform .15s ease';
    setTimeout(() => { btn.style.transform = ''; }, 200);
  }

  addMsg(text, 'user');
  input.value = '';
  btn?.classList.remove('has-text');

  // Typing indicator with animated dots
  const tid = 'typing_' + Date.now();
  const chat = document.getElementById('aiChat');
  const div = document.createElement('div');
  div.className = 'ai-msg bot typing';
  div.id = tid;
  div.innerHTML = `<p><span class="typing-dots"><span></span><span></span><span></span></span></p>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  const delay = 750 + Math.random() * 450;
  setTimeout(() => {
    const el = document.getElementById(tid);
    if (el) {
      el.classList.remove('typing');
      el.innerHTML = `<p>${aiResp(text).replace(/\n/g,'<br>')}</p>`;
      // Re-animate the response
      el.style.animation = 'none';
      requestAnimationFrame(() => el.style.animation = '');
    }
    chat.scrollTop = chat.scrollHeight;
  }, delay);
};

// Input pulse — add class when typing
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('aiUserInput');
  const btn = document.getElementById('aiSendBtn');
  if (inp && btn) {
    inp.addEventListener('input', () => {
      btn.classList.toggle('has-text', inp.value.trim().length > 0);
    });
  }
});

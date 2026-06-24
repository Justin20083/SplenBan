/* ═══════════════════════════════════════════════════════════
   SplenBan — Financial Manager  ·  script.js
═══════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────
let transactions  = JSON.parse(localStorage.getItem('splban_transactions') || '[]');
let userName      = localStorage.getItem('splban_name') || 'Justin';
let currentPeriod = 'mes';
let currentType   = 'ingreso';
let chart         = null;
let balancePrev   = 0;

// ── Theme ──────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('splban_theme');
  // Use saved pref, or fall back to OS preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  applyTheme(isDark, false);

  // Listen for OS-level changes (only when no manual preference saved)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('splban_theme')) applyTheme(e.matches, true);
  });
}

function applyTheme(dark, animate) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const label = document.getElementById('menuThemeLabel');
  const dsLabel = document.querySelector('.ds-theme-label');
  if (label)   label.textContent    = dark ? '☀️ Modo claro'  : '🌙 Modo oscuro';
  if (dsLabel) dsLabel.textContent  = dark ? '☀️ Modo claro'  : '🌙 Modo oscuro';

  // Rebuild chart so colors recompute for new theme
  if (chart && animate) {
    setTimeout(renderChart, 320);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark  = current !== 'dark';
  localStorage.setItem('splban_theme', isDark ? 'dark' : 'light');
  applyTheme(isDark, true);
  showToast(isDark ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado');
}


// ── Category icons ─────────────────────────────────────────
const CAT_ICONS = {
  salario:'💼', freelance:'💻', 'inversión':'📈', regalo:'🎁',
  comida:'🍔', transporte:'🚗', salud:'🏥', entretenimiento:'🎬',
  ropa:'👕', hogar:'🏠', 'educación':'📚', otro:'📌', '':'💳'
};

// ── Shake keyframes (injected once) ───────────────────────
const _s = document.createElement('style');
_s.textContent = `
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@keyframes popIn{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes countUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
`;
document.head.appendChild(_s);

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('userNameDisplay').textContent = userName;
  document.querySelector('.user-name').textContent = userName;
  setDefaultDate();
  renderAll();
  initSplash();
  initSwipeToDelete();
});

function initSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.addEventListener('animationend', () => {
      splash.style.display = 'none';
    });
  }
}

function renderAll() {
  renderBalance();
  renderChart();
  renderTransactions();
}

// ── Persist ────────────────────────────────────────────────
function save() {
  localStorage.setItem('splban_transactions', JSON.stringify(transactions));
  localStorage.setItem('splban_name', userName);
}

// ── Animated number counter ────────────────────────────────
function animateValue(el, from, to, duration = 500) {
  if (!el) return;
  const start = performance.now();
  const update = (ts) => {
    const p = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // ease-out-cubic
    const val = from + (to - from) * ease;
    el.textContent = fmtNum(val);
    if (p < 1) requestAnimationFrame(update);
    else el.textContent = fmtNum(to);
  };
  requestAnimationFrame(update);
}

function fmtNum(n) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt(n) { return fmtNum(n); }

// ── Balance ────────────────────────────────────────────────
function renderBalance() {
  const income   = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'gasto').reduce((s, t)  => s + t.amount, 0);
  const balance  = income - expenses;

  const balEl  = document.getElementById('balanceDisplay');
  const incEl  = document.getElementById('totalIncome');
  const expEl  = document.getElementById('totalExpenses');
  const card   = document.getElementById('balanceCard');

  animateValue(balEl,  balancePrev, balance, 600);
  animateValue(incEl,  0, income,   500);
  animateValue(expEl,  0, expenses, 500);
  balancePrev = balance;

  // Card color hint
  if (card) {
    card.style.background = balance < 0
      ? 'linear-gradient(135deg, #7f1d1d 0%, #0a0a0a 100%)'
      : 'var(--black)';
  }
}

// ── Chart ──────────────────────────────────────────────────
function changePeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  const active = document.querySelector(`[data-period="${period}"]`);
  if (active) { active.classList.add('active'); active.setAttribute('aria-selected', 'true'); }
  renderChart();
}

function renderChart() {
  const { labels, data } = getChartData(currentPeriod);
  const ctx = document.getElementById('financeChart').getContext('2d');
  if (chart) chart.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lineColor  = isDark ? '#e0e0e0' : '#0a0a0a';
  const tickColor  = isDark ? '#555555' : '#aaaaaa';
  const hoverColor = isDark ? '#ffffff' : '#0a0a0a';
  const gradTop    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, gradTop);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: lineColor,
        borderWidth: 3.5,
        pointRadius: 0,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: hoverColor,
        pointHoverBorderColor: isDark ? '#141414' : '#fff',
        pointHoverBorderWidth: 2.5,
        fill: true,
        backgroundColor: gradient,
        tension: 0.42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: externalTooltip }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 11, family: 'Inter, sans-serif', weight: '500' },
            maxRotation: 0
          }
        },
        y: { display: false, grid: { display: false } }
      }
    }
  });
}

function externalTooltip(context) {
  const tip = document.getElementById('chartTooltip');
  if (!tip) return;
  if (context.tooltip.opacity === 0) { tip.style.opacity = '0'; return; }
  const { x, y } = context.tooltip;
  const label = context.tooltip.dataPoints?.[0]?.label || '';
  const value = context.tooltip.dataPoints?.[0]?.raw ?? 0;
  tip.textContent = `${label}: ${fmt(value)}`;
  tip.style.left    = x + 'px';
  tip.style.top     = (y - 40) + 'px';
  tip.style.opacity = '1';
}

function getChartData(period) {
  const now = new Date();
  if (period === 'dia') {
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()]);
      data.push(netOnDate(d.toISOString().slice(0, 10)));
    }
    return { labels, data: runningBalance(data) };
  }
  if (period === 'semana') {
    const labels = [], data = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i * 7);
      const ws = getWeekStart(d), we = new Date(ws); we.setDate(we.getDate() + 6);
      labels.push('S' + getWeekNumber(d));
      data.push(netInRange(ws, we));
    }
    return { labels, data: runningBalance(data) };
  }
  if (period === 'mes') {
    const labels = [], data = [];
    const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    for (let i = 4; i >= -1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      labels.push(M[d.getMonth()]); data.push(netInRange(s, e));
    }
    return { labels, data: runningBalance(data) };
  }
  if (period === 'año') {
    const labels = [], data = [];
    for (let i = 4; i >= 0; i--) {
      const yr = now.getFullYear() - i;
      labels.push(String(yr));
      data.push(netInRange(new Date(yr, 0, 1), new Date(yr, 11, 31)));
    }
    return { labels, data: runningBalance(data) };
  }
  return { labels: [], data: [] };
}

function netOnDate(dateStr) {
  return transactions.filter(t => t.date === dateStr)
    .reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0);
}
function netInRange(s, e) {
  return transactions.filter(t => { const d = new Date(t.date + 'T00:00:00'); return d >= s && d <= e; })
    .reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0);
}
function runningBalance(deltas) {
  let acc = 0; return deltas.map(d => { acc += d; return acc; });
}
function getWeekStart(d) {
  const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const s = new Date(d); s.setDate(diff); return s;
}
function getWeekNumber(d) {
  const oj = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - oj) / 86400000) + oj.getDay() + 1) / 7);
}

// ── Render transactions ────────────────────────────────────
function renderTransactions() {
  const list = document.getElementById('transactionsList');
  if (!list) return;

  if (transactions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💳</div>
        <p>No hay transacciones todavía</p>
        <button class="btn-empty-add" onclick="openModal()">Agregar primera transacción</button>
      </div>`;
    return;
  }

  const sorted = [...transactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.id - a.id;
  });

  const items = sorted.map((t, i) => {
    const icon    = CAT_ICONS[t.category] || '💳';
    const isInc   = t.type === 'ingreso';
    const sign    = isInc ? '+' : '-';
    const cls     = isInc ? 'positive' : 'negative';
    const iconCls = isInc ? 'income-icon' : 'expense-icon';
    const cat     = t.category ? cap(t.category) : (isInc ? 'Ingreso' : 'Gasto');
    const note    = t.note ? ` · ${esc(t.note)}` : '';
    const delay   = Math.min(i * 35, 300);

    return `
      <div class="transaction-item" role="listitem" style="animation-delay:${delay}ms" data-id="${t.id}">
        <div class="tx-icon ${iconCls}">${icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${esc(t.description)}</div>
          <div class="tx-meta">${cat}${note}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${cls}">${sign}${fmt(t.amount)}</div>
          <div class="tx-date">${fmtDate(t.date)}</div>
        </div>
        <button class="tx-delete" onclick="deleteTransaction(${t.id})" aria-label="Eliminar">✕</button>
      </div>`;
  }).join('');

  list.innerHTML = `<div class="tx-list-wrapper">${items}</div>`;
}

function deleteTransaction(id) {
  // Animate out
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.transition = 'all 0.28s ease';
    el.style.opacity    = '0';
    el.style.transform  = 'translateX(20px)';
    el.style.maxHeight  = el.offsetHeight + 'px';
    requestAnimationFrame(() => {
      el.style.maxHeight  = '0';
      el.style.padding    = '0';
      el.style.borderWidth = '0';
    });
    setTimeout(() => {
      transactions = transactions.filter(t => t.id !== id);
      save(); renderAll();
      showToast('Transacción eliminada');
    }, 280);
  } else {
    transactions = transactions.filter(t => t.id !== id);
    save(); renderAll();
  }
}

function cap(s)  { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(s)  {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(ds) {
  if (!ds) return '';
  const d = new Date(ds + 'T00:00:00');
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Swipe to delete (touch) ────────────────────────────────
function initSwipeToDelete() {
  let startX = 0, el = null;
  document.addEventListener('touchstart', e => {
    const item = e.target.closest('.transaction-item');
    if (!item) return;
    el = item; startX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!el) return;
    const dx = e.touches[0].clientX - startX;
    if (dx < 0) el.style.transform = `translateX(${Math.max(dx, -80)}px)`;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!el) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -60) {
      const id = parseInt(el.dataset.id);
      deleteTransaction(id);
    } else {
      el.style.transition = 'transform 0.2s';
      el.style.transform  = '';
      setTimeout(() => { if (el) el.style.transition = ''; el = null; }, 200);
    }
    el = null;
  }, { passive: true });
}

// ── Modal: Nueva transacción ───────────────────────────────
function openModal() {
  setDefaultDate();
  const sug = document.getElementById('aiSuggestion');
  if (sug) sug.style.display = 'none';
  document.getElementById('descInput').value     = '';
  document.getElementById('amountInput').value   = '';
  document.getElementById('noteInput').value     = '';
  document.getElementById('categorySelect').value = '';
  setType('ingreso');

  toggleLayer('modalOverlay', 'transactionModal', true);
  setTimeout(() => document.getElementById('descInput')?.focus(), 380);
}

function closeModal() {
  toggleLayer('modalOverlay', 'transactionModal', false);
}

function setDefaultDate() {
  const el = document.getElementById('dateInput');
  if (el) el.value = new Date().toISOString().slice(0, 10);
}

function setType(type) {
  currentType = type;
  document.getElementById('btnIngreso')?.classList.toggle('active', type === 'ingreso');
  document.getElementById('btnGasto')?.classList.toggle('active',   type === 'gasto');
}

function saveTransaction() {
  const desc   = document.getElementById('descInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const cat    = document.getElementById('categorySelect').value;
  const date   = document.getElementById('dateInput').value;
  const note   = document.getElementById('noteInput').value.trim();

  if (!desc)              { shake('descInput');   return; }
  if (!amount || amount <= 0) { shake('amountInput'); return; }
  if (!date)              { shake('dateInput');   return; }

  const tx = { id: Date.now(), type: currentType, description: desc, amount, category: cat, date, note };
  transactions.unshift(tx);
  save();
  closeModal();

  // Small delay so modal closes before re-render
  setTimeout(() => {
    renderAll();
    showToast(currentType === 'ingreso' ? 'Ingreso guardado ✓' : 'Gasto guardado ✓', 'success');
  }, 200);
}

function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#dc2626';
  el.style.animation   = 'none';
  requestAnimationFrame(() => { el.style.animation = 'shake 0.3s ease'; });
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 600);
}

// ── Side Menu ──────────────────────────────────────────────
function toggleMenu() {
  const menu  = document.getElementById('sideMenu');
  const over  = document.getElementById('overlay');
  const btn   = document.querySelector('.menu-btn');
  const isOpen = menu.classList.toggle('active');
  over.classList.toggle('active', isOpen);
  btn?.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

// ── Name edit ──────────────────────────────────────────────
function openEditName() {
  document.getElementById('nameInput').value = userName;
  toggleLayer('nameOverlay', 'nameModal', true);
  setTimeout(() => document.getElementById('nameInput')?.focus(), 380);
}
function closeEditName() {
  toggleLayer('nameOverlay', 'nameModal', false);
}
function saveName() {
  const val = document.getElementById('nameInput').value.trim();
  if (!val) return;
  userName = val;
  save();
  document.getElementById('userNameDisplay').textContent = userName;
  document.querySelector('.user-name').textContent = userName;
  closeEditName();
  showToast('Nombre actualizado', 'success');
}

// ── Export ─────────────────────────────────────────────────
function exportData() {
  if (transactions.length === 0) { showToast('No hay datos para exportar', 'error'); return; }
  const csv = [
    'Fecha,Tipo,Descripcion,Categoria,Monto,Nota',
    ...transactions.map(t =>
      `${t.date},${t.type},"${t.description}","${t.category || ''}",${t.amount},"${t.note || ''}"`)
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `splban_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV exportado', 'success');
}

function clearAllData() {
  if (!confirm('¿Seguro que quieres borrar todas las transacciones? Esta acción no se puede deshacer.')) return;
  transactions = [];
  balancePrev  = 0;
  save(); renderAll();
  toggleMenu();
  showToast('Todos los datos eliminados');
}

// ── Generic overlay toggle ─────────────────────────────────
function toggleLayer(overlayId, panelId, open) {
  document.getElementById(overlayId)?.classList.toggle('active', open);
  document.getElementById(panelId)?.classList.toggle('active', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

// ── AI Panel ───────────────────────────────────────────────
function openAIPanel()  { toggleLayer('aiOverlay', 'aiPanel', true);  }
function closeAIPanel() { toggleLayer('aiOverlay', 'aiPanel', false); }

function aiQuickAnalysis(type) {
  const msgs = {
    resumen:     'Dame un resumen de mis finanzas',
    consejo:     'Dame un consejo financiero basado en mis datos',
    mayor_gasto: '¿Cuál es mi categoría con más gastos?',
    ahorro:      '¿Cuánto podría ahorrar al mes?'
  };
  document.getElementById('aiUserInput').value = msgs[type] || '';
  sendAIMessage();
}

function sendAIMessage() {
  const input = document.getElementById('aiUserInput');
  const text  = input.value.trim();
  if (!text) return;
  appendAIMsg(text, 'user');
  input.value = '';

  const typingId = 'typing_' + Date.now();
  appendAIMsg('Escribiendo...', 'bot typing', typingId);

  const delay = 700 + Math.random() * 500;
  setTimeout(() => {
    const response = aiResponse(text);
    const el = document.getElementById(typingId);
    if (el) {
      el.classList.remove('typing');
      el.querySelector('p').textContent = response;
    }
    scrollChat();
  }, delay);
}

function appendAIMsg(text, role, id) {
  const chat = document.getElementById('aiChat');
  const div  = document.createElement('div');
  div.className = `ai-message ${role}`;
  if (id) div.id = id;
  const p = document.createElement('p');
  p.textContent = text;
  div.appendChild(p);
  chat.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const c = document.getElementById('aiChat');
  if (c) c.scrollTop = c.scrollHeight;
}

// ── AI response engine ─────────────────────────────────────
function aiResponse(userMsg) {
  const msg = userMsg.toLowerCase();

  const income   = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
  const balance  = income - expenses;
  const count    = transactions.length;

  const catMap = {};
  transactions.filter(t => t.type === 'gasto').forEach(t => {
    catMap[t.category || 'otro'] = (catMap[t.category || 'otro'] || 0) + t.amount;
  });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  if (msg.includes('resumen') || msg.includes('balance') || msg.includes('situación') || msg.includes('situacion')) {
    if (count === 0) return '📊 Aún no tienes transacciones. Agrega ingresos y gastos con el botón + para ver tu análisis.';
    return `📊 Resumen financiero:\n\n• Balance: ${fmt(balance)}\n• Ingresos: ${fmt(income)}\n• Gastos: ${fmt(expenses)}\n• Transacciones: ${count}\n\n${balance >= 0 ? '✅ Tus finanzas están en positivo.' : '⚠️ Tus gastos superan tus ingresos.'}`;
  }

  if (msg.includes('mayor gasto') || msg.includes('categoría') || msg.includes('categoria') || msg.includes('más gastaste')) {
    if (!topCat) return '🔍 No hay gastos registrados todavía.';
    return `🔍 Mayor categoría: ${cap(topCat[0])} con ${fmt(topCat[1])} (${Math.round(topCat[1] / expenses * 100)}% de tus gastos).`;
  }

  if (msg.includes('consejo') || msg.includes('recomend') || msg.includes('tip')) {
    if (count === 0) return '💡 Registra tus primeras transacciones para recibir consejos personalizados.';
    const rate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    if (rate < 0)  return '💡 Tus gastos superan los ingresos. Revisa tus egresos y recorta los no esenciales.';
    if (rate < 20) return `💡 Tu tasa de ahorro es ${Math.round(rate)}%. Lo ideal es superar el 20%. Reduce en ${topCat ? cap(topCat[0]) : 'entretenimiento'}.`;
    return `💡 ¡Excelente! Tu tasa de ahorro es ${Math.round(rate)}%. Considera invertir el excedente para hacer crecer tu dinero.`;
  }

  if (msg.includes('ahorr')) {
    if (income === 0) return '💰 Agrega tus ingresos para calcular tu potencial de ahorro.';
    const possible = income - expenses;
    if (possible <= 0) return `💰 Necesitas reducir gastos en ${fmt(Math.abs(possible) + 1)} para empezar a ahorrar.`;
    return `💰 Podrías ahorrar ${fmt(possible)} en total.\nDestinando el 20% de ingresos: ${fmt(income * 0.2)} por periodo.`;
  }

  if (msg.includes('hola') || msg.includes('hi') || msg.includes('buenas') || msg.includes('hey')) {
    return `¡Hola${userName !== 'Justin' ? ' ' + userName : ''}! Estoy aquí para analizar tus finanzas. Pregúntame sobre tu balance, gastos, o consejos de ahorro.`;
  }

  if (msg.includes('gracias')) {
    return '¡Con gusto! Registra tus transacciones regularmente para análisis más precisos. 😊';
  }

  if (msg.includes('cuánto') || msg.includes('cuanto')) {
    if (msg.includes('ingreso') || msg.includes('gané') || msg.includes('gane')) {
      return `💼 Ingresos totales: ${fmt(income)} en ${transactions.filter(t => t.type==='ingreso').length} transacciones.`;
    }
    if (msg.includes('gasto') || msg.includes('gasté') || msg.includes('gaste')) {
      return expenses === 0 ? '💸 Sin gastos registrados.' : `💸 Gastos totales: ${fmt(expenses)}.`;
    }
  }

  // Fallback contextual
  if (count === 0) return 'Empieza agregando transacciones para que pueda darte análisis personalizados. Usa el botón + en la parte superior.';
  return `Con tus datos actuales:\n• Balance: ${fmt(balance)}\n• Ingresos: ${fmt(income)}\n• Gastos: ${fmt(expenses)}\n\n¿Quieres un consejo, resumen, o análisis de categorías?`;
}

// ── AI category suggest ────────────────────────────────────
function aiSuggestCategory() {
  const desc = document.getElementById('descInput').value.trim().toLowerCase();
  if (!desc) { showAISuggestion('✨ Escribe una descripción primero.'); return; }

  const rules = [
    { keys: ['salario','sueldo','nómina','nomina','pago mensual','quincena'], cat: 'salario',        icon: '💼' },
    { keys: ['freelance','proyecto','cliente','trabajo extra','honorario'],   cat: 'freelance',      icon: '💻' },
    { keys: ['inversión','acción','bono','dividendo','crypto','bitcoin'],     cat: 'inversión',      icon: '📈' },
    { keys: ['regalo','present','cumpleaños','navidad'],                      cat: 'regalo',         icon: '🎁' },
    { keys: ['comida','restaurante','super','supermercado','almuerzo','cena','desayuno','pizza','burger','cafe','café','mercado'], cat: 'comida', icon: '🍔' },
    { keys: ['uber','taxi','gasolina','combustible','bus','metro','transporte','tren','vuelo','avión'], cat: 'transporte', icon: '🚗' },
    { keys: ['doctor','médico','farmacia','medicamento','hospital','clinica','salud','dental'], cat: 'salud', icon: '🏥' },
    { keys: ['netflix','spotify','cine','juego','concierto','entretenimiento','streaming','disney','hbo'], cat: 'entretenimiento', icon: '🎬' },
    { keys: ['ropa','zapatos','camisa','pantalón','tienda','zara','tenis','zapatillas'], cat: 'ropa', icon: '👕' },
    { keys: ['renta','alquiler','luz','agua','internet','hogar','casa','servicios','gas','electricidad'], cat: 'hogar', icon: '🏠' },
    { keys: ['curso','libro','universidad','colegio','escuela','educación','tutoría','clase'], cat: 'educación', icon: '📚' },
  ];

  let matched = null;
  for (const r of rules) {
    if (r.keys.some(k => desc.includes(k))) { matched = r; break; }
  }

  if (matched) {
    document.getElementById('categorySelect').value = matched.cat;
    showAISuggestion(`✨ Categoría sugerida: ${matched.icon} ${cap(matched.cat)}`);
  } else {
    showAISuggestion('✨ No encontré una categoría exacta. Selecciona la más cercana.');
  }
}

function showAISuggestion(text) {
  const el = document.getElementById('aiSuggestion');
  if (!el) return;
  document.getElementById('aiSuggestionText').textContent = text;
  el.style.display = 'block';
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = 'fadeUp2 0.2s ease'; });
}

// ── Toast ──────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast ${type}`;
  clearTimeout(_toastTimer);
  requestAnimationFrame(() => {
    t.classList.add('show');
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  });
}

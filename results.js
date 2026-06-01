let chart = null;
let timerEndCache = null;
let timerInterval = null;
let qrCodeInstance = null;
let currentSessionId = null;
let selectedClass = null;
let currentListener = null;

const rootRef = firebase.database().ref('poll');

function getOptionsArray(data) {
  if (!data || !data.options) return [];
  if (Array.isArray(data.options)) return data.options.slice().sort((a, b) => a.id - b.id);
  return Object.values(data.options).sort((a, b) => a.id - b.id);
}

const COLORS = ['#1976D2', '#FF6F00', '#388E3C', '#D32F2F'];
function getColor(i) { return COLORS[i % COLORS.length]; }

function initChart(data) {
  const ctx = document.getElementById('resultsChart').getContext('2d');
  const options = getOptionsArray(data);
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: options.map(o => o.text),
      datasets: [{
        data: options.map(o => o.votes),
        backgroundColor: options.map((_, i) => getColor(i)),
        borderColor: '#1a1a2e',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#ccc', padding: 16, font: { size: 14, weight: '500' } }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} голосов (${pct}%)`;
            }
          }
        }
      },
      animation: { animateRotate: true, duration: 600 }
    }
  });
}

function updateChartData(data) {
  if (!chart) return;
  const options = getOptionsArray(data);
  chart.data.datasets[0].data = options.map(o => o.votes);
  chart.update('none');

  const total = data.totalVotes || 0;
  document.getElementById('totalVotes').textContent = total;

  const list = document.getElementById('resultsList');
  const letters = ['А', 'Б', 'В', 'Г'];
  list.innerHTML = '';
  options.forEach((opt, i) => {
    const pct = total > 0 ? ((opt.votes / total) * 100).toFixed(1) : 0;
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-bar" style="width:${pct}%;background:${getColor(i)}33"></div>
      <div class="result-text">
        <span class="result-label">${letters[i]}. ${opt.text}</span>
        <span class="result-stats">
          <span>${opt.votes} гол.</span>
          <span>${pct}%</span>
        </span>
      </div>`;
    list.appendChild(item);
  });
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('ru-RU');
}

function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (!el) return;
  if (!timerEndCache) { el.innerHTML = ''; el.className = 'timer-display'; return; }
  const diff = timerEndCache - Date.now();
  if (diff <= 0) {
    el.innerHTML = '⏰ Голосование завершено';
    el.className = 'timer-display timer-expired';
  } else {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `⏱ Осталось: ${h}ч ${m}м ${s}с`;
    el.className = 'timer-display timer-active';
  }
}

function generateQR(classId, sessionId) {
  const container = document.getElementById('qrContainer');
  if (!container) return;
  const baseUrl = window.location.origin.replace('/results.html', '') + '/index.html';
  const params = [];
  if (classId) params.push(`class=${encodeURIComponent(classId)}`);
  if (sessionId) params.push(`s=${sessionId}`);
  const url = params.length ? `${baseUrl}?${params.join('&')}` : baseUrl;

  if (qrCodeInstance) {
    qrCodeInstance.clear();
    container.innerHTML = '';
  }
  qrCodeInstance = new QRCode(container, {
    text: url,
    width: 120,
    height: 120,
    colorDark: '#ffffff',
    colorLight: '#1a1a2e',
    correctLevel: QRCode.CorrectLevel.H
  });
}

function renderVoterList(data) {
  const container = document.getElementById('voterList');
  if (!container) return;
  const voters = data.voters || {};
  const options = getOptionsArray(data);
  const optText = {};
  const letters = ['А', 'Б', 'В', 'Г'];
  options.forEach((o, i) => { optText[o.id] = `${letters[i]}. ${o.text}`; });

  const entries = Object.entries(voters);
  if (entries.length === 0) {
    container.innerHTML = '<div class="voter-empty">Пока никто не проголосовал</div>';
    return;
  }

  container.innerHTML = '';
  entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
  entries.forEach(([fp, v]) => {
    const item = document.createElement('div');
    item.className = 'voter-item';
    const name = v.name && v.name.trim() ? v.name : 'Аноним';
    const optionLabel = optText[v.optionId] || '—';
    item.innerHTML = `<span class="voter-name">${escapeHtml(name)}</span><span class="voter-option">${escapeHtml(optionLabel)}</span>`;
    container.appendChild(item);
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function exportCSV(data) {
  const options = getOptionsArray(data);
  const total = data.totalVotes || 0;
  let csv = '\uFEFFВариант,Голоса,Процент\n';
  options.forEach(o => {
    const pct = total > 0 ? ((o.votes / total) * 100).toFixed(1) : 0;
    csv += `${o.text},${o.votes},${pct}%\n`;
  });
  csv += `\nВсего,${total},100%\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `results_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function exportPNG() {
  const el = document.querySelector('.projector-content');
  const canvas = await html2canvas(el, { backgroundColor: '#1a1a2e', scale: 2, useCORS: true });
  const link = document.createElement('a');
  link.download = `results_${new Date().toISOString().slice(0,10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function subscribeClass(classId) {
  if (currentListener) {
    currentListener.off('value');
    currentListener = null;
  }

  let firstLoad = true;
  const ref = firebase.database().ref(`poll/${classId}`);

  currentListener = ref;
  ref.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    document.getElementById('connectionStatus').textContent = '🟢 Connected';
    document.getElementById('connectionStatus').className = 'conn-status connected';
    const errEl = document.getElementById('errorMessage');
    if (errEl) errEl.style.display = 'none';

    if (data.question) {
      const qt = document.getElementById('questionTitle');
      if (qt) qt.textContent = `📊 ${data.question}`;
      const qq = document.getElementById('questionText');
      if (qq) qq.textContent = data.question;
    }

    timerEndCache = data.timerEnd ? new Date(data.timerEnd).getTime() : null;
    updateTimerDisplay();

    const pinEl = document.getElementById('pinDisplay');
    const pinCodeEl = document.getElementById('pinCode');
    if (data.pin) {
      if (pinCodeEl) pinCodeEl.textContent = data.pin;
      if (pinEl) pinEl.style.display = 'flex';
    } else {
      if (pinEl) pinEl.style.display = 'none';
    }

    const sessionId = data.sessionId || null;
    if (sessionId !== currentSessionId) {
      currentSessionId = sessionId;
      generateQR(classId, sessionId);
    }

    if (firstLoad) { firstLoad = false; initChart(data); }
    updateChartData(data);
    renderVoterList(data);
  }, err => {
    console.error('FB error:', err);
    document.getElementById('connectionStatus').textContent = '🔴 Ошибка';
    document.getElementById('connectionStatus').className = 'conn-status';
    const errEl = document.getElementById('errorMessage');
    if (errEl) { errEl.textContent = 'Ошибка Firebase: ' + err.message; errEl.style.display = 'block'; }
  });
}

function loadClassList() {
  rootRef.once('value', snap => {
    const data = snap.val();
    const select = document.getElementById('classSelect');
    if (!select) return;
    const keys = data ? Object.keys(data) : [];
    select.innerHTML = '<option value="">— Выберите класс —</option>' + keys.map(k => `<option value="${k}">${k}</option>`).join('');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadClassList();

  document.getElementById('classSelect')?.addEventListener('change', e => {
    const val = e.target.value;
    if (!val) return;
    if (chart) { chart.destroy(); chart = null; }
    currentSessionId = null;
    selectedClass = val;
    document.getElementById('questionTitle').textContent = '📊 Загрузка...';
    document.getElementById('questionText').textContent = '';
    document.getElementById('resultsList').innerHTML = '';
    document.getElementById('totalVotes').textContent = '0';
    subscribeClass(val);
  });

  timerInterval = setInterval(updateTimerDisplay, 1000);

  document.getElementById('exportCSV')?.addEventListener('click', () => {
    if (!selectedClass) return;
    firebase.database().ref(`poll/${selectedClass}`).once('value', s => exportCSV(s.val()));
  });
  document.getElementById('exportPNG')?.addEventListener('click', exportPNG);

  const qrContainer = document.getElementById('qrContainer');
  const qrModal = document.getElementById('qrModal');
  const qrModalImage = document.getElementById('qrModalImage');
  if (qrContainer && qrModal && qrModalImage) {
    qrContainer.addEventListener('click', () => {
      const img = qrContainer.querySelector('img');
      if (img && img.src) {
        qrModalImage.innerHTML = `<img src="${img.src}" style="width:280px;height:280px;border-radius:8px;">`;
        qrModal.classList.add('open');
      }
    });
    qrModal.addEventListener('click', () => {
      qrModal.classList.remove('open');
    });
  }

  const burgerBtn = document.getElementById('burgerBtn');
  const bottomSheet = document.getElementById('bottomSheet');
  const backdrop = document.getElementById('bottomSheetBackdrop');
  const closeBtn = document.getElementById('bottomSheetClose');

  function closeBottomSheet() {
    bottomSheet.classList.remove('open');
    backdrop.classList.remove('open');
  }

  burgerBtn?.addEventListener('click', () => {
    bottomSheet.classList.add('open');
    backdrop.classList.add('open');
  });
  closeBtn?.addEventListener('click', closeBottomSheet);
  backdrop?.addEventListener('click', closeBottomSheet);
});

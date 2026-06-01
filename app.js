const SESSION_KEY = 'session_id';
const NAME_KEY = 'voter_name';
const PIN_VERIFIED_PREFIX = 'pin_ok_';

const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('class');
const urlSession = urlParams.get('s');
if (urlSession) {
  localStorage.setItem(SESSION_KEY, urlSession);
}

if (!classId) {
  document.addEventListener('DOMContentLoaded', showClassPicker);
}

const RESERVED_KEYS = ['question', 'options', 'totalVotes', 'voters', 'sessionId', 'timerEnd', 'pin'];

async function showClassPicker() {
  document.getElementById('loadingState')?.classList.add('hidden');
  const container = document.getElementById('classPickerList');
  const overlay = document.getElementById('classPickerOverlay');
  try {
    const snap = await firebase.database().ref('poll').once('value');
    const data = snap.val();
    const keys = data ? Object.keys(data).filter(k => !RESERVED_KEYS.includes(k)) : [];
    if (keys.length === 0) {
      container.innerHTML = '<div style="color:#999;padding:20px;">Нет доступных классов. Обратитесь к учителю.</div>';
      overlay?.classList.add('show');
      return;
    }
    container.innerHTML = keys.map(k =>
      `<button class="class-picker-btn" data-class="${k}">${k}</button>`
    ).join('');
    overlay?.classList.add('show');
    container.querySelectorAll('.class-picker-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.class;
        const params = new URLSearchParams(window.location.search);
        params.set('class', c);
        window.location.search = params.toString();
      });
    });
  } catch (e) {
    container.innerHTML = '<div style="color:#c62828;padding:20px;">Ошибка загрузки классов.</div>';
    overlay?.classList.add('show');
  }
}

let hasVotedLocally = localStorage.getItem('voted') === 'true';
let voterName = localStorage.getItem(NAME_KEY) || '';
let userVoteOptionId = null;
let currentData = null;
let timerEndCache = null;
let currentPin = null;
let pollRef = null;

function getFingerprint() {
  const raw = [
    screen.colorDepth,
    navigator.hardwareConcurrency || ''
  ].join('|||');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return 'v_' + Math.abs(hash).toString(36);
}

const fingerprint = getFingerprint();

function getOptionsArray(data) {
  if (!data || !data.options) return [];
  if (Array.isArray(data.options)) return data.options.slice().sort((a, b) => a.id - b.id);
  return Object.values(data.options).sort((a, b) => a.id - b.id);
}

async function checkRemoteVote() {
  try {
    const snap = await firebase.database().ref(`poll/${classId}/voters/${fingerprint}`).once('value');
    if (snap.exists()) {
      hasVotedLocally = true;
      localStorage.setItem('voted', 'true');
      userVoteOptionId = snap.val().optionId;
      return true;
    }
    return false;
  } catch (e) { console.error('Check error:', e); return false; }
}

async function castVote(optionId) {
  hideError();
  if (hasVotedLocally) { showAlreadyVoted(); return false; }
  if (timerEndCache && Date.now() >= timerEndCache) { showVotingClosed(); return false; }
  const alreadyVoted = await checkRemoteVote();
  if (alreadyVoted) { showAlreadyVoted(); return false; }

  hasVotedLocally = true;
  localStorage.setItem('voted', 'true');
  userVoteOptionId = optionId;

  const btn = document.querySelector(`[data-option-id="${optionId}"]`);
  if (btn) btn.disabled = true;

  try {
    const updates = {};
    updates[`poll/${classId}/options/${optionId}/votes`] = firebase.database.ServerValue.increment(1);
    updates[`poll/${classId}/voters/${fingerprint}`] = { name: voterName, optionId, timestamp: firebase.database.ServerValue.TIMESTAMP };
    updates[`poll/${classId}/totalVotes`] = firebase.database.ServerValue.increment(1);
    await firebase.database().ref().update(updates);

    if (typeof confetti === 'function') {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#1976D2', '#FF6F00', '#388E3C', '#D32F2F'] });
    }

    showThankYou(currentData);
    return true;
  } catch (err) {
    console.error('Vote error:', err);
    showError('Ошибка при голосовании. Попробуйте ещё раз.');
    if (btn) btn.disabled = false;
    hasVotedLocally = false;
    localStorage.removeItem('voted');
    userVoteOptionId = null;
    return false;
  }
}

function renderOptions(data) {
  const grid = document.getElementById('optionsGrid');
  if (!grid) return;
  const letters = ['А', 'Б', 'В', 'Г'];
  const isExpired = timerEndCache && Date.now() >= timerEndCache;
  grid.innerHTML = '';
  getOptionsArray(data).forEach((opt, i) => {
    const total = data.totalVotes || 0;
    const pct = total > 0 ? ((opt.votes / total) * 100).toFixed(1) : 0;
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.optionId = opt.id;
    btn.disabled = hasVotedLocally || isExpired;
    btn.innerHTML = `<span class="vote-bar" style="width:${pct}%"></span><span class="option-content"><span class="option-label">${letters[i]}</span>${opt.text}<span class="vote-count">${opt.votes}</span></span>`;
    btn.addEventListener('click', () => castVote(opt.id));
    grid.appendChild(btn);
  });
}

function updateLiveResults(data) {
  currentData = data;
  const grid = document.getElementById('optionsGrid');
  if (!grid) return;
  const letters = ['А', 'Б', 'В', 'Г'];
  const buttons = grid.querySelectorAll('.option-btn');
  getOptionsArray(data).forEach((opt, i) => {
    const btn = buttons[i];
    if (!btn) return;
    const total = data.totalVotes || 0;
    const pct = total > 0 ? ((opt.votes / total) * 100).toFixed(1) : 0;
    const bar = btn.querySelector('.vote-bar');
    const count = btn.querySelector('.vote-count');
    if (bar) bar.style.width = `${pct}%`;
    if (count) count.textContent = opt.votes;
  });
  const totalEl = document.getElementById('totalCount');
  if (totalEl) totalEl.textContent = data.totalVotes || 0;
}

function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (!el) return;
  if (!timerEndCache) { el.innerHTML = ''; el.className = 'timer-display'; return; }
  const diff = timerEndCache - Date.now();
  if (diff <= 0) {
    el.innerHTML = '⏰ Голосование завершено';
    el.className = 'timer-display timer-expired';
    const grid = document.getElementById('optionsGrid');
    if (grid) grid.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  } else {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `⏱ Осталось: ${h}ч ${m}м ${s}с`;
    el.className = 'timer-display timer-active';
  }
}

function showThankYou(data) {
  currentData = data || currentData;
  const msgBox = document.getElementById('messageBox');
  const grid = document.getElementById('optionsGrid');
  const statusBar = document.getElementById('statusBar');
  if (currentData) {
    const te = document.getElementById('totalCount');
    if (te) te.textContent = currentData.totalVotes || 0;
  }
  if (msgBox) {
    msgBox.classList.add('show');
    msgBox.innerHTML = `<div class="thank-you">🎉</div><h2>Спасибо, ваш голос принят!</h2><p>Вы проголосовали за вариант <strong>${currentData ? findOptionText(userVoteOptionId, currentData) : ''}</strong></p><p style="margin-top:12px;font-size:14px;color:#888;">Всего проголосовало: <strong>${currentData ? (currentData.totalVotes || 0) : 0}</strong></p>`;
  }
  if (grid) grid.style.display = 'none';
  if (statusBar) statusBar.style.display = 'block';
}

function showAlreadyVoted() {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('content')?.classList.remove('hidden');
  const msgBox = document.getElementById('messageBox');
  const grid = document.getElementById('optionsGrid');
  if (msgBox) {
    msgBox.classList.add('show');
    msgBox.innerHTML = '<div class="thank-you">📋</div><h2>Вы уже голосовали</h2><p>Каждый ученик может проголосовать только один раз.</p>';
  }
  if (grid) grid.style.display = 'none';
}

function showVotingClosed() {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('content')?.classList.remove('hidden');
  const msgBox = document.getElementById('messageBox');
  const grid = document.getElementById('optionsGrid');
  if (msgBox) {
    msgBox.classList.add('show');
    msgBox.innerHTML = '<div class="thank-you">⏰</div><h2>Голосование завершено</h2><p>Время голосования истекло. Спасибо за участие!</p>';
  }
  if (grid) grid.style.display = 'none';
}

function showVotingNotStarted() {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('content')?.classList.remove('hidden');
  const msgBox = document.getElementById('messageBox');
  if (msgBox) {
    msgBox.classList.add('show');
    msgBox.innerHTML = '<div class="thank-you">🔒</div><h2>Голосование ещё не началось</h2><p>Учитель ещё не запустил голосование. Попробуйте позже.</p>';
  }
}

function showNameInput() {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('nameOverlay')?.classList.add('show');
}

function hideNameInput() {
  document.getElementById('nameOverlay')?.classList.remove('show');
}

function showPinInput() {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('pinOverlay')?.classList.add('show');
  document.getElementById('pinInput')?.focus();
}

function hidePinInput() {
  document.getElementById('pinOverlay')?.classList.remove('show');
}

function showPinError(msg) {
  const el = document.getElementById('pinError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hidePinError() {
  const el = document.getElementById('pinError');
  if (el) { el.style.display = 'none'; }
}

function showNameError(msg) {
  const el = document.getElementById('nameError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideNameError() {
  const el = document.getElementById('nameError');
  if (el) { el.style.display = 'none'; }
}

function showVotingAfterName() {
  hideNameInput();
  document.getElementById('content')?.classList.remove('hidden');
  document.getElementById('loadingState')?.classList.add('hidden');
  const msgBox = document.getElementById('messageBox');
  if (msgBox) { msgBox.classList.remove('show'); msgBox.innerHTML = ''; }
  const grid = document.getElementById('optionsGrid');
  if (grid) grid.style.display = '';
  renderOptions(currentData);
}

function showError(msg) {
  const el = document.getElementById('errorMessage');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideError() {
  const el = document.getElementById('errorMessage');
  if (el) el.style.display = 'none';
}

function findOptionText(optionId, data) {
  if (!data || !data.options) return '';
  const opt = getOptionsArray(data).find(o => o.id == optionId);
  return opt ? opt.text : '';
}

function isPinVerified() {
  const fbSessionId = currentData ? currentData.sessionId : null;
  if (!fbSessionId) return true;
  return localStorage.getItem(PIN_VERIFIED_PREFIX + fbSessionId) === 'true';
}

function initVoting(data) {
  currentData = data;
  document.getElementById('loadingState')?.classList.add('hidden');

  const qEl = document.getElementById('questionText');
  if (qEl) qEl.textContent = data.question;

  if (timerEndCache && Date.now() >= timerEndCache) {
    document.getElementById('content')?.classList.remove('hidden');
    showVotingClosed();
    return;
  }

  if (hasVotedLocally) {
    document.getElementById('content')?.classList.remove('hidden');
    showThankYou(data);
    return;
  }

  if (!voterName) {
    showNameInput();
    return;
  }

  if (currentPin && !isPinVerified()) {
    showPinInput();
    return;
  }

  showVotingAfterName();
}

document.addEventListener('DOMContentLoaded', async () => {
  const loadingState = document.getElementById('loadingState');

  try {
    if (!classId) return;
    pollRef = firebase.database().ref(`poll/${classId}`);
    let initialized = false;
    let timerInterval = setInterval(updateTimerDisplay, 1000);

    pollRef.on('value', async snapshot => {
      const data = snapshot.val();
      if (!data) return;

      timerEndCache = data.timerEnd ? new Date(data.timerEnd).getTime() : null;
      currentPin = data.pin || null;
      const fbSessionId = data.sessionId || null;

      if (!initialized) {
        initialized = true;

        if (!fbSessionId) {
          showVotingNotStarted();
          return;
        }

        const localSessionId = localStorage.getItem(SESSION_KEY);
        if (localSessionId !== fbSessionId) {
          localStorage.setItem(SESSION_KEY, fbSessionId);
          hasVotedLocally = false;
          localStorage.removeItem('voted');
          userVoteOptionId = null;
        }

        const votedRemote = await checkRemoteVote();
        if (hasVotedLocally && !votedRemote) {
          hasVotedLocally = false;
          localStorage.removeItem('voted');
          userVoteOptionId = null;
        }
        initVoting(data);
        return;
      }

      const localSessionId = localStorage.getItem(SESSION_KEY);

      if (!fbSessionId) {
        showVotingNotStarted();
        return;
      }

      if (localSessionId !== fbSessionId) {
        localStorage.setItem(SESSION_KEY, fbSessionId);
        hasVotedLocally = false;
        localStorage.removeItem('voted');
        userVoteOptionId = null;
        initVoting(data);
        return;
      }

      if (timerEndCache && Date.now() >= timerEndCache) {
        showVotingClosed();
        return;
      }

      updateLiveResults(data);
    }, err => {
      console.error('FB error:', err);
      showError('Ошибка соединения. Проверьте Firebase.');
    });
  } catch (err) {
    console.error('Init error:', err);
    if (loadingState) loadingState.textContent = 'Ошибка загрузки. Проверьте Firebase.';
    showError('Не удалось загрузить данные.');
  }
});

document.getElementById('nameSubmitBtn')?.addEventListener('click', () => {
  const input = document.getElementById('nameInput');
  const name = input.value.trim();
  if (!name) { showNameError('Введите имя'); return; }
  hideNameError();
  voterName = name;
  localStorage.setItem(NAME_KEY, name);
  input.value = '';
  showVotingAfterName();
});

document.getElementById('nameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('nameSubmitBtn')?.click();
  }
});

document.getElementById('pinSubmitBtn')?.addEventListener('click', () => {
  const input = document.getElementById('pinInput');
  const pin = input.value.trim();
  if (!pin) { showPinError('Введите PIN'); return; }
  if (pin !== currentPin) { showPinError('Неверный PIN'); return; }
  hidePinError();
  const fbSessionId = currentData ? currentData.sessionId : null;
  if (fbSessionId) localStorage.setItem(PIN_VERIFIED_PREFIX + fbSessionId, 'true');
  input.value = '';
  hidePinInput();
  showVotingAfterName();
});

document.getElementById('pinInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('pinSubmitBtn')?.click();
  }
});

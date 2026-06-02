const FIREBASE_API_KEY = "AIzaSyBzsOtjtfCGST9ECTvK58ISkNKXWJRz5F8";
const FIREBASE_AUTH_DOMAIN = "school-vote-ecbcd.firebaseapp.com";
const FIREBASE_DATABASE_URL = "https://school-vote-ecbcd-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_PROJECT_ID = "school-vote-ecbcd";
const FIREBASE_STORAGE_BUCKET = "school-vote-ecbcd.firebasestorage.app";
const FIREBASE_MESSAGING_SENDER_ID = "630501523978";
const FIREBASE_APP_ID = "1:630501523978:web:2ab7ff37983f29e86f55f3";

firebase.initializeApp({
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  databaseURL: FIREBASE_DATABASE_URL,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID
});

const RESERVED_KEYS = ['question', 'options', 'totalVotes', 'voters', 'sessionId', 'timerEnd', 'pin'];

function getLetter(i) {
  return ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'][i] || '?';
}

function getOptionsArray(data) {
  if (!data || !data.options) return [];
  if (Array.isArray(data.options)) return data.options.slice().sort((a, b) => a.id - b.id);
  return Object.values(data.options).sort((a, b) => a.id - b.id);
}

function setupGlobalErrorHandler() {
  window.onerror = (msg, url, line, col, err) => {
    console.error('Global error:', msg, err);
    const el = document.getElementById('errorMessage');
    if (el) { el.textContent = '⚠️ Произошла ошибка. Обновите страницу.'; el.style.display = 'block'; }
  };
  window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled rejection:', e.reason);
    const el = document.getElementById('errorMessage');
    if (el) { el.textContent = '⚠️ Ошибка соединения. Проверьте подключение.'; el.style.display = 'block'; }
  });
}

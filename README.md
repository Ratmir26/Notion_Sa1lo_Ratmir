# Система голосования для школьных мероприятий

Проект для уроков 2–3. Голосование с телефона, результаты на проекторе в реальном времени. 3 HTML-страницы, Firebase Realtime Database, Vercel. Без сборки, без зависимостей, без CI.

## Ссылки

| Назначение | URL |
|-----------|-----|
| Голосование (телефон) | https://school-vote-teal.vercel.app/ |
| Результаты (проектор) | https://school-vote-teal.vercel.app/results.html |
| Управление (учитель) | https://school-vote-teal.vercel.app/seed.html |
| Firebase Console | https://console.firebase.google.com/project/school-vote-ecbcd/database |
| GitHub | https://github.com/Ratmir26/Notion_Sa1lo_Ratmir |

## Команды

- `vercel --prod` — задеплоить на продакшен (из корня проекта)
- `npm i -g vercel` — если Vercel CLI не установлен
- `git add -A; if ($?) { git commit -m "..." }; if ($?) { git push }` — залить изменения на GitHub

## Быстрый старт

### 1. Создайте проект Firebase

1. Зайдите на https://console.firebase.google.com
2. Нажмите **"Создать проект"**
3. Назовите проект (например, `school-vote`)
4. Отключите Google Analytics (не нужен)
5. В панели проекта нажмите **"Realtime Database"** → **"Создать базу данных"**
6. Выберите регион (лучше ближайший к вам)
7. Начните в **тестовом режиме** (открытый доступ)
8. Скопируйте URL базы данных (вида `https://your-project-default-rtdb.firebaseio.com`)

### 2. Настройте проект

Откройте файл **`firebase-config.js`** и замените значения на свои:

- `FIREBASE_API_KEY` — из настроек проекта Firebase (Project settings → Web API Key)
- `FIREBASE_AUTH_DOMAIN` — `<project>.firebaseapp.com`
- `FIREBASE_DATABASE_URL` — URL из шага 1
- `FIREBASE_PROJECT_ID` — ID вашего проекта
- `FIREBASE_STORAGE_BUCKET` — `<project>.appspot.com`
- `FIREBASE_MESSAGING_SENDER_ID` — из настроек проекта
- `FIREBASE_APP_ID` — из настроек проекта

### 3. Инициализируйте данные

Откройте **`seed.html`** в браузере и нажмите кнопку **"Создать данные"**.

### 4. Задеплойте на Vercel

1. Установите Vercel CLI: `npm i -g vercel`
2. В папке проекта выполните: `vercel`
3. Или подключите репозиторий на https://vercel.com/new

### 5. Откройте

- https://school-vote-teal.vercel.app/ — страница голосования (для телефонов)
- https://school-vote-teal.vercel.app/results.html — страница результатов (для проектора)

## Архитектура

### Страницы

| Файл | Назначение |
|------|-----------|
| `index.html` | Голосование (телефон/ученик). Подключает `app.js` |
| `results.html` | Результаты (проектор). Подключает `results.js` |
| `seed.html` | Управление (учитель). Встроенный JS |
| `firebase-config.js` | Firebase config + `POLL_ID = 'poll'` |

### Firebase (Realtime Database, compat SDK 9.22.0 через CDN)

- Путь: `poll/question`, `poll/options` (массив `{id,text,votes}`), `poll/totalVotes`, `poll/voters/{fingerprint}`, `poll/sessionId`, `poll/timerEnd`
- `poll/options` — 0-индексированный массив, а не объект (Firebase не конвертит числовые ключи в разреженный массив)
- `getOptionsArray()` — читает `data.options` как массив или объект, нормализует

### Анти-двойной-голос

3 уровня: localStorage → fingerprint → Firebase voters.

- Fingerprint: `screen.colorDepth` + `navigator.hardwareConcurrency`. Убран `userAgent`, `platform`, `language`, `deviceMemory`, `screen.width/height` — они различаются между браузерами.
- Fingerprint **не кэшируется** в localStorage (чтобы не было расхождения между браузерами в одной сессии)
- Сессии: `poll/sessionId` меняется при каждом нажатии "Начать голосование". Если localStorage sessionId не совпадает с Firebase → сброс voted.

### Голосование

- `castVote()`: `hasVotedLocally = true` **до** `await` (защита от double-click race condition)
- Запись: атомарный `update()` с `ServerValue.increment(1)`, а не три раздельных `await` (чтобы totalVotes не расходился с options[].votes)
- Таймер: `poll/timerEnd` в ISO 8601. Блокирует кнопки на index.html и results.html.
- Имя ученика запрашивается перед голосованием, сохраняется в localStorage (`voter_name`) и пишется в `poll/voters/{fingerprint}.name`

### Real-time обновления

- Все страницы используют Firebase SDK `on('value')` — WebSocket в реальном времени, без polling
- Firebase listener обрабатывает все переходы: появление/исчезновение сессии, окончание таймера, смена sessionId

### Стили

- `style.css` — общий. Mobile-first для index.html, тёмный проектор для `body.projector` (results.html).

## Файлы проекта

| Файл | Назначение |
|------|-----------|
| `index.html` | Страница голосования (телефоны) |
| `results.html` | Страница результатов (проектор) |
| `seed.html` | Управление (учитель) |
| `style.css` | Стили (мобильные + проектор) |
| `app.js` | Логика голосования, fingerprint, сессии |
| `results.js` | Диаграмма Chart.js, QR-код, список проголосовавших, CSV/PNG экспорт |
| `firebase-config.js` | Конфигурация Firebase (заполнить перед деплоем) |
| `manifest.json` | PWA-манифест |
| `icon.svg` | Иконка PWA |

## Важные детали

- Cache busting: `?v=5` на всех локальных ассетах. При изменениях увеличивать номер.
- `vercel.json` удалён (вызывал build-config warning). Деплой как статика.
- QR-код генерируется через qrcodejs CDN. Содержит `?s=sessionId`.
- Конфетти: canvas-confetti CDN.
- Экспорт CSV/PNG на results.html (html2canvas + ручной CSV).
- Все надписи на русском.
- Нет тестов, линтера, typecheck.

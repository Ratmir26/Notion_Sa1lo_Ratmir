# AGENTS.md

## Проект
Школьное голосование. 3 HTML-страницы, Firebase Realtime Database, Vercel. Без сборки, без зависимостей, без CI.

## Ссылки
| Назначение | URL |
|-----------|-----|
| Голосование (телефон) | https://school-vote-teal.vercel.app/ |
| Результаты (проектор) | https://school-vote-teal.vercel.app/results.html |
| Управление (учитель) | https://school-vote-teal.vercel.app/seed.html |
| Firebase Console | https://console.firebase.google.com/project/school-vote-ecbcd/database |
| GitHub | <!-- вставь ссылку на репозиторий после загрузки --> |

## Команды
- `vercel --prod` — задеплоить на продакшен (из корня проекта)
- `npm i -g vercel` — если Vercel CLI не установлен
- `git add -A; if ($?) { git commit -m "..." }` — после загрузки на GitHub

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

### Стили
- `style.css` — общий. Mobile-first для index.html, тёмный проектор для `body.projector` (results.html).

## Важные детали
- Cache busting: `?v=4` на всех локальных ассетах. При изменениях увеличивать номер.
- `vercel.json` удалён (вызывал build-config warning). Деплой как статика.
- Нет git-репозитория. Нет тестов, линтера, typecheck.
- QR-код генерируется через qrcodejs CDN. Содержит `?s=sessionId`.
- Конфетти: canvas-confetti CDN.
- Экспорт CSV/PNG на results.html (html2canvas + ручной CSV).
- Все надписи на русском.

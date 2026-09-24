# 21 — трекер привычек

Небольшое React + Vite PWA-приложение для отслеживания привычек.

## Запуск локально

```bash
npm ci
npm run dev
```

Для production-сборки:

```bash
npm run build
npm run preview
```

## Деплой на GitHub Pages

В репозитории откройте **Settings → Pages** и выберите **GitHub Actions** в разделе Build and deployment.

После push в ветку `main` workflow `.github/workflows/deploy.yml` автоматически соберёт приложение и опубликует `dist/` на GitHub Pages.

Данные приложения хранятся в `localStorage` браузера и не требуют базы данных или сервера.

## Структура

- `src/` — исходный код React
- `public/` — иконки и PWA manifest
- `.github/workflows/deploy.yml` — автоматический деплой
- `vite.config.js` — конфигурация Vite

# Разработка

## Требования

- Node.js 24 (≥ 24.20), pnpm 12.13 (`npm i -g pnpm@12.13.0`)
- Python 3.13 и uv ≥ 0.12
- Docker — для сканеров безопасности (по желанию локально, обязательно в CI)

```bash
pnpm install
uv sync --directory tools --locked
pnpm exec playwright install chromium firefox webkit
```

## Команды

| Команда                             | Что делает                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | собирает сайт и поднимает Worker со статикой на http://127.0.0.1:8787                           |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                        |
| `pnpm lint`                         | ESLint (TS + Astro), Stylelint, ruff, запрет комментариев в Python                              |
| `pnpm typecheck`                    | `tsc`, `astro check`, `wrangler types --check`, mypy `--strict`                                 |
| `pnpm test`                         | Vitest (Node + workerd), pytest; покрытие 100 % обязательно                                     |
| `pnpm test:mutation`                | Stryker; ниже 90 % — ошибка                                                                     |
| `pnpm test:e2e`                     | Playwright в Chromium, Firefox, WebKit и мобильном Chrome: страницы, заголовки, axe, Lighthouse |
| `pnpm check`                        | всё перечисленное подряд                                                                        |

Хуки lefthook проверяют форматирование и линтеры у изменённых файлов перед коммитом и формат сообщения коммита (Conventional Commits).

## Правила кода

- Комментариев нет ни в TS, ни в Astro, ни в CSS, ни в Python: это проверяют `local/no-comments` (ESLint и Stylelint) и `zsm3-no-comments`.
- Отключать правила линтеров в коде нельзя (`noInlineConfig`).
- Внешние данные разбираются схемой Zod на границе; `as`, `!`, `any` запрещены.
- SQL только через `.prepare(...).bind(...)`; шаблонные строки внутри `prepare` запрещены линтером.
- Новый HTTP-ответ API проходит через security-заголовки и `problemResponse`; тест на заголовки обязателен.

## Тесты Worker'а

Каждый тест в `apps/worker/test` выполняется дважды: в Node (на нём работает мутационное тестирование) и в настоящем рантайме workerd (совместимость). Тесты, которым нужен именно workerd, называются `*.workers.test.ts`.

## Локальные ограничения на этой машине (Windows 11 26200)

Сборки Firefox и полного Chromium от Playwright не запускаются (ошибка Windows side-by-side). Chromium headless shell и WebKit работают, поэтому локально:

```bash
pnpm build
```

```bash
pnpm --filter @zsm3/e2e exec playwright test --project chromium --project webkit --project mobile
```

В CI на Linux выполняются все четыре проекта.

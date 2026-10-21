# ZSM3

Website of Zespół Szkół Mechanicznych Nr 3 w Krakowie: a static Astro site and a Cloudflare Worker API served from one origin.

| Path                  | Contents                                        |
| --------------------- | ----------------------------------------------- |
| `apps/web`            | Astro site (static output)                      |
| `apps/worker`         | Cloudflare Worker: API and static asset serving |
| `packages/contracts`  | Zod schemas shared by the site and the API      |
| `packages/lint-rules` | ESLint and Stylelint rules of this repository   |
| `e2e`                 | Playwright, axe and Lighthouse checks           |
| `tools`               | Python maintenance tooling                      |

```bash
pnpm install
```

```bash
pnpm dev
```

Documentation: [architecture](docs/en/architecture.md), [development](docs/en/development.md), [supply chain](docs/en/supply-chain.md).

## Po polsku

Strona internetowa Zespołu Szkół Mechanicznych Nr 3 w Krakowie. Opis systemu, wymogów prawnych i planu prac: [docs/pl/architektura.md](docs/pl/architektura.md).

Security issues / zgłaszanie podatności: [SECURITY.md](SECURITY.md).

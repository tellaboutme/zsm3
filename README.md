# ZSM3

Website of Zespół Szkół Mechanicznych Nr 3 w Krakowie: an Astro site and its API in one Cloudflare Worker on one origin.

| Path                  | Contents                                      |
| --------------------- | --------------------------------------------- |
| `apps/web`            | Astro site and the Worker entry (deployed)    |
| `apps/worker`         | API, D1 storage, migrations and seed data     |
| `packages/contracts`  | Zod schemas shared by the site and the API    |
| `packages/lint-rules` | ESLint and Stylelint rules of this repository |
| `e2e`                 | Playwright, axe and Lighthouse checks         |
| `tools`               | Python maintenance tooling                    |

```bash
pnpm install
```

```bash
pnpm dev
```

Documentation: [architecture](docs/en/architecture.md), [site plan](docs/en/site-plan.md), [blueprint](docs/en/blueprint.md), [design system](docs/en/design-system.md), [development](docs/en/development.md), [supply chain](docs/en/supply-chain.md), [decisions](docs/en/adr/).

## Po polsku

Strona internetowa Zespołu Szkół Mechanicznych Nr 3 w Krakowie. Opis systemu, wymogów prawnych i planu prac: [docs/pl/architektura.md](docs/pl/architektura.md).

Security issues / zgłaszanie podatności: [SECURITY.md](SECURITY.md).

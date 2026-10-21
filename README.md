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
pnpm dev
```

Documentation (Russian): [architecture](docs/SYSTEM.md), [development](docs/DEVELOPMENT.md), [supply chain](docs/SUPPLY-CHAIN.md).

Security issues: see [SECURITY.md](SECURITY.md).

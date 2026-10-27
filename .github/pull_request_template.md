## What this changes

## Checklist

- [ ] No comments in TypeScript, Astro, CSS or Python
- [ ] No `any`, unchecked `as`, `!`, `@ts-ignore`, `# type: ignore` or `noqa`
- [ ] SQL only through `.prepare().bind()`; no `innerHTML`; CSP has no `unsafe-inline`
- [ ] External data parsed with Zod at the boundary; `Clock`/`Random` injected where used
- [ ] 100% line/branch coverage; mutation score holds; axe and Lighthouse budgets hold
- [ ] No Russian anywhere in the repository; UI copy is Polish, code and docs are English
- [ ] No mention of Claude, Anthropic, ChatGPT or other AI assistance in code, commits or this
      description; no `Co-Authored-By` or "Generated with" lines
- [ ] No personal data or scraped photos from the previous site
- [ ] Any new dependency or supply-chain exception is recorded in `docs/en/supply-chain.md`
- [ ] `robots.txt` still keeps the site out of search engines (stays closed until stage 7)

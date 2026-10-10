# Dependency Security Check

Checked on 2026-10-11 using the committed pnpm dependency graph and npm advisory database.

## Updates

- Next.js and eslint-config-next: 16.2.12 -> 16.3.8.
- sharp: 0.35.0 -> 0.35.5.
- PostCSS: 8.5.25 -> 8.5.29.
- Security overrides updated for brace-expansion, js-yaml 4.x, nanoid 3.x,
  source-map-js, and postcss-selector-parser.
- Major upgrades of Tailwind CSS, TypeScript, and ESLint were not included.

## Remaining Advisory

`pnpm audit` reports one high-severity development dependency advisory:

- `braces@3.0.3`: stack exhaustion from deeply nested brace patterns.
- Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Affected paths include Tailwind CSS and eslint-config-next via file-watching
  and glob-matching dependencies.
- No patched release is published at the time of this check. The registry's
  latest version is 3.0.3, even though the audit response suggests >=3.0.4.
- Keep glob patterns and build configuration trusted; do not accept patterns
  supplied by untrusted users. Recheck when upstream publishes a fix.

`pnpm audit --prod` reports no known vulnerabilities. This is a point-in-time
dependency check, not a guarantee that all application code is secure.

## Verification

- 23 unit tests passed (`node --test tests/*.test.mjs`).
- TypeScript passed (`pnpm exec tsc --noEmit`).
- Production build passed (Next.js 16.3.8).
- ESLint reports two errors in existing CasinoGame.tsx effects under
  `react-hooks/set-state-in-effect`, plus six warnings. Game code was not
  changed as part of this dependency update.
- ESLint 9 is marked unsupported by the registry. Migration to ESLint 10 is
  separate maintenance work requiring configuration and plugin checks.

## Recheck

```sh
pnpm install --frozen-lockfile
pnpm audit
pnpm audit --prod
node --test tests/*.test.mjs
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

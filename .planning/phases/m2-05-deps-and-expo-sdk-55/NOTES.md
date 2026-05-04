# Phase m2-05 — Dependency vulns + Expo SDK 55 upgrade

**Outcome:** SUCCESS

## Part A — Web vuln housekeeping

- next already on 16.2.4 (latest); npm audit's "fix" suggesting 9.3.3 was a confused downgrade
- Added `overrides` block in `campanha-ia/package.json`:
  - `uuid: ^14.0.0` (transitive via mercadopago + natural)
  - `postcss: ^8.5.10` (transitive via next, fixes XSS GHSA-qx2v-qp2m-jg93)
- Web vulns: **8 moderate -> 3 moderate** (high+: 0 -> 0)
- 3 remaining are dev-only via `promptfoo` -> `@anthropic-ai/claude-agent-sdk` -> `@anthropic-ai/sdk`. Promptfoo is at latest (0.121.9); fix requires upstream bump. Phase 2.5 (Promptfoo-based labeling) deferred indefinitely per project memory, so dev-only vulns in deferred tooling are acceptable.

## Part B — Expo SDK 55 upgrade

**Outcome:** SUCCESS (no rollback needed)

Bumps applied via `npx expo install expo@^55.0.0 --fix` then `npx expo install --fix`:
- expo: ~54.0.34 -> ^55.0.0
- react-native: 0.81.5 -> 0.83.6
- react / react-dom: 19.1.0 -> 19.2.0 (RN 0.83.6 peer requires ^19.2.0)
- All `expo-*` family bumped to ~55.0.x (single-version policy in SDK 55)
- react-native-reanimated 4.1.1 -> 4.2.1, worklets 0.5.1 -> 0.7.4
- screens 4.16 -> 4.23, gesture-handler 2.28 -> 2.30
- skia 2.2.12 -> 2.4.18, netinfo 11.4.1 -> 11.5.2
- jest-expo 54 -> 55, @types/react 19.1 -> 19.2

### Breaking changes hit + fixed

1. **app.config.ts ESM transpilation:** SDK 55 transpiles `app.config.ts` as ESM via the project's TypeScript install. Removed `require('node:fs')` / `require('node:path')` and replaced `__dirname` (CJS-only) with `process.cwd()`.
2. **`newArchEnabled` removed from schema:** New Architecture is now mandatory. Dropped from app.config.ts.
3. **`android.edgeToEdgeEnabled` removed from schema:** Edge-to-edge is mandatory on Android 16+. Dropped from app.config.ts.

### Verification

- `tsc --noEmit`: clean
- `npx expo-doctor`: 18/18 checks passed
- `npx expo prebuild --platform android --clean`: SUCCESS (warning about `expo-system-ui` plugin for `userInterfaceStyle` is non-blocking)
- Lockfile regenerated via `npm run lock:fix` with Windows workaround (`set npm_config_user_agent=`); `lockfileVersion: 3` confirmed.

### Mobile vuln impact

- Before: 24 (4 low + 20 moderate + 0 high+)
- After: **19 (4 low + 15 moderate + 0 high+)**
- Reduction modest because most vulns were in expo-* internals already at non-vulnerable versions; the upgrade cleared 5 transitive paths.

### Stale notes updated

- `_install_exclude_reason` rewritten — old version referenced RN 0.81.5 / react 19.1.0; updated for RN 0.83.6 / react 19.2.0.
- `@sentry/react-native` still pinned to 7.13.0 (51s boot regression fix story still valid; minimum compat for SDK 55 too).

## Part C — Final verification

| Check | Result |
|-------|--------|
| `cd campanha-ia && npm test` | 428/428 (one earlier run had 3 flaky webhook test failures unrelated to our changes; 2 subsequent runs stable) |
| `cd crialook-app && npm test` | 169/169 |
| Web `npm audit --audit-level=high` | 0 high+ |
| Mobile `npm audit --audit-level=high` | 0 high+ |
| Husky | active (will be validated by this commit) |

## Commits

- `ab88ebb` chore(m2-05-01): npm audit fix web (uuid + postcss overrides)
- `78b7d8e` chore(m2-05-02): bump expo SDK 54 -> 55 (peer deps coordinated)
- `c359fa0` fix(m2-05-03): drop SDK 55 deprecated config flags

Rollback HEAD if needed (state immediately before SDK 55 work): `ab88ebb`.
Initial HEAD before phase: `45b6406`.

## Surprises / blockers

- **None catastrophic.** SDK 55 upgrade went smoother than anticipated.
- The `npm 11 user-agent leak` into npx subprocesses required the documented Windows workaround (`set npm_config_user_agent=`) for both `expo install --fix` and `lock:fix`. This is the standing memory rule and did not surprise.
- Prebuild attempted to mutate `android` / `ios` scripts in `package.json` from `expo start --android/ios` to `expo run:android/ios`. Reverted — the project intent is managed-workflow with EAS prebuild on the build server, not committed native dirs.
- Generated `crialook-app/android/` directory is gitignored (correctly) so prebuild output is not committed.

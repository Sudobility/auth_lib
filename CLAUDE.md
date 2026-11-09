# auth_lib — AI Development Guide

> **Git policy — never auto-commit or auto-push.** Leave work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the
> user explicitly asks in that turn**. Approval for an earlier change does not carry
> forward, and finishing a task is not permission to commit it. Stay on the current
> branch; do not create feature branches.

## What it is

`@sudobility/auth_lib` — Firebase authentication library: configurable auth init,
resilient network clients with automatic token refresh + logout handling, admin
utilities, and React hooks for auth state. Dual-platform via conditional exports:
**web** (Firebase JS SDK) and **React Native** (`@react-native-firebase`).

- **Package manager**: Bun. **Language**: TypeScript (ESM, `"type": "module"`).
- **Registry**: **GitHub Packages** (`@sudobility` scope → `npm.pkg.github.com`, see
  `.npmrc`). CI publishes with `publish-target: github`, not public npm.
- **License**: BUSL-1.1. **Repo**: github.com/Sudobility/auth_lib

## Commands (verified against package.json)

```bash
bun run build       # tsc + node scripts/fix-esm-imports.mjs  -> dist/
bun run dev         # tsc --watch
bun run clean       # rm -rf dist
bun run test:unit   # vitest run   (NOTE: there is no `test` script; `bun test` is wrong)
bun run test:watch  # vitest
bun run typecheck   # bunx tsc --noEmit
bun run lint        # bunx eslint src        (lint:fix to auto-fix)
bun run format      # bunx prettier --write src
```

`build` runs `scripts/fix-esm-imports.mjs` after `tsc` to rewrite emitted ESM import
specifiers (add `.js`, resolve platform `.native`/`.rn` variants). Do not hand-edit
`dist/`.

## Source layout (`src/`)

```
index.ts / index.rn.ts     Web + RN root entry points (parallel export sets)
config/                    firebase-init.ts (web) / firebase-init.native.ts (RN),
                           types.ts, firebase-proxy-providers.ts (auth-only provider filter)
network/                   FirebaseAuthNetworkService.ts (web) / .rn.ts
hooks/                     useSiteAdmin.ts, useProxyFilteredAuthProviders.ts
utils/                     firebase-errors.ts (error mapping + sign-in-cancelled helpers)
admin/                     thin re-export of admin helpers from @sudobility/types
account/                   deleteAccount.ts (backend DELETE call)
auth/                      JS-SDK auth hook + context (useFirebaseAuthJs, useAuthUser, ...)
oauth/                     OAuth/PKCE/web-auth-flow + Google helpers
signin/                    Google/Apple sign-in for an RN app on the Firebase JS SDK
```

Tests are `*.test.ts` colocated with sources (Vitest). `entry-exports.test.ts` guards
the public export surface.

## Subpath exports (package.json `exports`)

`.` (root, has `react-native` condition), `./oauth`, `./signin`, `./account`,
`./auth-js` (JS-SDK auth, no RN condition → web/desktop), `./auth-native` (RN auth).

## Architecture & non-obvious rules

### Dual entry points
Platform-specific files come in pairs: `foo.ts` (web) + `foo.rn.ts`/`foo.native.ts`
(RN). The web entry imports the plain file; the RN entry imports the RN variant with an
explicit `.js` extension. Hooks, utils, admin, account are platform-agnostic and shared.

### Singleton Firebase init
`config/firebase-init.ts` keeps `firebaseApp`/`firebaseAuth` as module singletons and
expects the app to have initialized Firebase via `@sudobility/di` first. The RN variant
lazy-`require`s `@react-native-firebase` modules on demand. On auth-state change both set
the analytics user id through the `@sudobility/di` service locator.

### 401/403 session policy — `FirebaseAuthNetworkService`
The network client of record (implements `NetworkClient` from `@sudobility/types`).
- **401, refresh succeeds** → retry once with the fresh token.
- **401, unrecoverable** → sign the user out; the session is dead.
- **403** → return the response untouched. APIs here use 403 for role/permission denials,
  so signing out would log users out for lacking access. **A 403 must never end the
  session on web.** (The RN variant historically logged out on 403 — verify before relying
  on either behavior when editing.)
Web variant extends `WebNetworkClient` and adds a module-level token cache with proactive
refresh (default 30s, `tokenRefreshIntervalMs`); RN extends `RNNetworkService`.

### China reverse-proxy lives in `@sudobility/di`, not here
The proxy core (covers Analytics + Installations, not just Auth) moved to
`@sudobility/di`. This package only **re-exports** the API (`setFirebaseProxy`,
`getFirebaseProxyOrigin`, `isFirebaseProxyActive`, `firebaseProxyReady`,
`disableFirebaseProxy`, `rewriteFirebaseProxyUrl`) and keeps the auth-only
`filterAuthProvidersForProxy` / `useProxyFilteredAuthProviders`.
- **No default origin; reads no env var.** The app calls `setFirebaseProxy(origin)` at
  startup from its own env; if it never does, traffic goes direct. Importing `auth_lib`
  does **not** configure the proxy as a side effect (old `firebase-proxy-auto.ts` is gone).
- **Region detection belongs to `di`.** Never probe, check timezone, or read a cache here.
  Ask `getFirebaseProxyOrigin()`/`isFirebaseProxyActive()` and believe it: null = route
  direct, whatever the reason (do not try to distinguish "not configured" from "reachable").

### `signin/` — JS SDK on RN, and why the proxy then works on a phone
`signin` (+ `oauth`) does Google/Apple sign-in for an RN app running the Firebase **JS
SDK** on every platform instead of `@react-native-firebase`. Native modules are borrowed
only for an ID token, which goes to the JS SDK's `signInWithCredential` — one Firebase,
one session everywhere. This is what makes the China proxy work on a phone: the proxy is a
`fetch` wrapper and the JS SDK's RN build looks `fetch` up per request. Key constraints:
- `auth_lib` **reads no environment and names no native package**; values and native
  modules are injected as lazy `() => module` bridges so the app can `require` inside the
  function (a dynamic `import()` becomes a second Metro bundle fetch that fails at the tap).
- Desktop Google OAuth uses two different client types: **macOS** uses the iOS-type client
  (redirect via its reversed id as a URL scheme); **Windows** uses a Desktop-app client
  (loopback `http://127.0.0.1:<port>/callback` + client secret). The token exchange must
  use **exactly** the `redirect_uri` from the authorize request (`loopbackRedirectOf`).

### `account/` import gotcha
Import `deleteAccount` from `@sudobility/auth_lib/account`, **not** the root, in an app on
the JS SDK: under Metro the root resolves to `index.rn.ts`, which statically requires
`@react-native-firebase/auth` — a package such an app no longer installs, so the bundle
fails to resolve.

## Gotchas

- **`firebase` is a devDependency on purpose** even though it is an optional peer.
  `src/oauth`, `src/signin`, `src/config` import its types, so `tsc` needs it installed.
  Dropping the dev half of a peer the library compiles against breaks CI typecheck and
  silently blocks publish while local pushes report success.

## Conventions

- Prettier: single quotes, es5 trailing commas, 80 cols, 2-space, arrow-parens avoid.
- ESLint flat config (`eslint.config.js`): prefer-const, no-var, prefer-template, sorted
  imports; unused vars prefixed `_` allowed.
- TS: strict everything on (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, …). Emits declarations + source maps. `*.test.ts` excluded from build.
- Every subdir has a barrel `index.ts`; new public API must be exported from the barrel
  **and** from both `src/index.ts` and `src/index.rn.ts`.

## CI/CD

`.github/workflows/ci-cd.yml` calls the shared reusable workflow
`johnqh/workflows/.github/workflows/unified-cicd.yml@main` with `publish-target: github`.
Pushes to `main`/`develop` trigger build/test/publish to GitHub Packages.

# auth_lib - AI Development Guide

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.

## Overview

Firebase authentication library providing configurable auth initialization, resilient network clients with automatic token refresh and logout handling, admin utilities, and React hooks for auth state management. Supports both web (Firebase JS SDK) and React Native (@react-native-firebase) platforms through conditional entry points.

- **Package**: `@sudobility/auth_lib`
- **Version**: 0.0.95
- **License**: BUSL-1.1
- **Package Manager**: Bun
- **Registry**: npm (public)
- **Repository**: https://github.com/sudobility/auth_lib.git

## Project Structure

```
src/
├── index.ts                                  # Web entry point (exports all public API)
├── index.rn.ts                               # React Native entry point (parallel exports using RN-specific modules)
├── admin/
│   └── index.ts                              # Re-exports parseAdminEmails, isAdminEmail, createAdminChecker from @sudobility/types
├── config/
│   ├── index.ts                              # Config barrel exports
│   ├── types.ts                              # FirebaseInitResult, FirebaseAuthNetworkClientOptions interfaces
│   ├── firebase-init.ts                      # Web Firebase init (singleton, uses firebase/app + firebase/auth)
│   ├── firebase-init.rn.ts                   # React Native Firebase init (lazy-loads @react-native-firebase modules)
│   ├── firebase-init.test.ts                 # Tests for firebase-init
│   ├── firebase-proxy-providers.ts           # Auth-specific: narrows the provider list while proxy routing is active (only Apple + non-OAuth survive)
│   ├── firebase-proxy-providers.test.ts      # Tests for provider filtering
│   └── firebase-proxy-reexport.test.ts       # Asserts the di re-export surface and that importing auth_lib does not route traffic
├── hooks/
│   ├── index.ts                              # Hooks barrel exports
│   ├── useFirebaseAuthNetworkClient.ts       # Hook + factory for auth-aware NetworkClient (401 retry, 403 logout)
│   ├── useFirebaseAuthNetworkClient.test.ts  # Tests for useFirebaseAuthNetworkClient
│   └── useSiteAdmin.ts                       # Hook for site admin check via TanStack Query
├── network/
│   ├── index.ts                              # Network barrel exports
│   ├── FirebaseAuthNetworkService.ts         # Web: extends WebNetworkClient with 401 retry + token cache
│   └── FirebaseAuthNetworkService.rn.ts      # RN: extends RNNetworkService with 401 retry + 403 logout
└── utils/
    ├── index.ts                              # Utils barrel exports
    ├── firebase-errors.ts                    # Firebase error code-to-message mapping utilities
    └── firebase-errors.test.ts               # Tests for firebase-errors
```

## Key Exports

### Firebase Initialization (`config/`)
| Export | Type | Description |
|---|---|---|
| `initializeFirebaseAuth()` | function | Initialize Firebase Auth using existing Firebase app (singleton). Web version expects `@sudobility/di/web` to have initialized Firebase first. |
| `getFirebaseApp()` | function | Get cached FirebaseApp instance (or null) |
| `getFirebaseAuth()` | function | Get cached Auth instance (or null) |
| `isFirebaseConfigured()` | function | Check if Firebase app is initialized |
| `FirebaseInitResult` | type | `{ app: FirebaseApp; auth: Auth }` |
| `FirebaseAuthNetworkClientOptions` | type | `{ onLogout?: () => void; onTokenRefreshFailed?: (error: unknown) => void }` |
| `setFirebaseProxy(origin?)` | function | **Re-exported from `@sudobility/di`.** Configure the China reverse proxy from the app's own env (`VITE_FIREBASE_PROXY` / `EXPO_PUBLIC_FIREBASE_PROXY`). Unset means Firebase direct. When set, `di` decides whether this device needs the proxy. |
| `getFirebaseProxyOrigin()` | function | Re-exported from `@sudobility/di`. The origin **while traffic is being routed**, else null. Null covers both "not configured" and "Google is reachable" — callers must not try to tell those apart. |
| `isFirebaseProxyActive()` | function | Re-exported from `@sudobility/di`. Boolean form of the above. |
| `firebaseProxyReady()` | function | Re-exported from `@sudobility/di`. Resolves once detection settles. |
| `disableFirebaseProxy()` / `rewriteFirebaseProxyUrl(url, origin)` | functions | Re-exported from `@sudobility/di`. |
| `filterAuthProvidersForProxy(providers, proxyActive?)` | function | Auth-specific, lives here. Defaults `proxyActive` to `isFirebaseProxyActive()`. |

### Hooks (`hooks/`)
| Export | Type | Description |
|---|---|---|
| `useFirebaseAuthNetworkClient(options?)` | React hook | Returns memoized `NetworkClient` with 401 auto-retry (force token refresh) and 403 auto-logout |
| `createFirebaseAuthNetworkClient(platformNetwork?, options?)` | factory function | Non-hook version for use outside React components |
| `useSiteAdmin(options)` | React hook | Fetches user info from backend `/api/v1/users/:userId` and returns `{ isSiteAdmin, userInfo, isLoading, isError, error, refetch }`. Uses TanStack Query with 5-min stale time, 1 retry, no refetch on window focus. |
| `siteAdminQueryKey(userId)` | function | Returns `['siteAdmin', userId]` for TanStack Query cache management |
| `UseSiteAdminOptions` | type | Options: `networkClient`, `baseUrl`, `userId`, `token`, `staleTime?`, `enabled?` |
| `UseSiteAdminResult` | type | Result: `isSiteAdmin`, `userInfo`, `isLoading`, `isError`, `error`, `refetch` |
| `UserInfoResponse` | type | Re-exported from `@sudobility/types` |

### Network Service (`network/`)
| Export | Type | Description |
|---|---|---|
| `FirebaseAuthNetworkService` | class | Web: extends `WebNetworkClient` from `@sudobility/di`. Overrides `request()` with 401 retry + proactive token cache (30s refresh interval). |
| `FirebaseAuthNetworkService` (RN) | class | RN: extends `RNNetworkService` from `@sudobility/di/rn`. Overrides `request()` with 401 retry + 403 logout. |
| `FirebaseAuthNetworkServiceOptions` | type | `{ onLogout?, onTokenRefreshFailed?, tokenRefreshIntervalMs? }` (web adds `tokenRefreshIntervalMs`) |

### Utils (`utils/`)
| Export | Type | Description |
|---|---|---|
| `getFirebaseErrorMessage(code)` | function | Maps Firebase error code (e.g., `'auth/user-not-found'`) to user-friendly string |
| `getFirebaseErrorCode(error)` | function | Extracts `.code` from an error object, returns `''` if not found |
| `formatFirebaseError(error)` | function | Combines `getFirebaseErrorCode` + `getFirebaseErrorMessage` in one call |
| `isFirebaseAuthError(error)` | function | Returns true if error code starts with `'auth/'` |

### Admin (`admin/`)
| Export | Type | Description |
|---|---|---|
| `parseAdminEmails(csv)` | function | Re-exported from `@sudobility/types`. Parse comma-separated admin email string. |
| `isAdminEmail(email, adminSet)` | function | Re-exported from `@sudobility/types`. Check if email is in admin set. |
| `createAdminChecker(csv)` | function | Re-exported from `@sudobility/types`. Returns a function that checks admin status. Deprecated in favor of `useSiteAdmin`. |

## Development Commands

```bash
bun run build          # Compile TypeScript to dist/ via tsc
bun run dev            # Watch mode build (tsc --watch)
bun run clean          # Remove dist/ directory
bun test               # Run tests with Vitest (vitest run)
bun run test:watch     # Run tests in watch mode (vitest)
bun run typecheck      # Type-check without emitting (bunx tsc --noEmit)
bun run lint           # Lint src/ with ESLint
bun run lint:fix       # Auto-fix lint issues
bun run format         # Format src/ with Prettier
bun run prepublishOnly # Build (alias for bun run build, runs before npm publish)
```

## Architecture / Patterns

### Dual Entry Points (Web + React Native)
The package uses conditional exports in `package.json`:
- **Web**: `import` resolves to `dist/index.js` (uses `firebase/app`, `firebase/auth`, `@sudobility/di`)
- **React Native**: `react-native` condition resolves to `dist/index.rn.js` (uses `@react-native-firebase/*`, `@sudobility/di/rn`)

Each platform has its own `firebase-init` and `FirebaseAuthNetworkService` implementation. Hooks and utils are shared across platforms.

### Singleton Firebase Initialization
`firebase-init.ts` (web) stores `firebaseApp` and `firebaseAuth` as module-level singletons. It expects the consuming app to initialize Firebase via `@sudobility/di/web` (`initializeWebApp()`) before calling `initializeFirebaseAuth()`. The RN variant uses lazy `require()` calls to load `@react-native-firebase` modules on demand.

### 401/403 HTTP Error Handling Strategy
Two parallel implementations exist for auth-aware networking:

1. **`useFirebaseAuthNetworkClient` / `createFirebaseAuthNetworkClient`** (hook/factory pattern):
   - Wraps a platform `NetworkService` obtained via `@sudobility/di`
   - On 401: force-refreshes Firebase ID token, retries once with new `Authorization: Bearer` header
   - On 403: signs out user via `signOut(auth)`, calls `onLogout` callback
   - Returns a `NetworkClient` interface with `request`, `get`, `post`, `put`, `delete` methods

2. **`FirebaseAuthNetworkService`** (class inheritance pattern):
   - Web: extends `WebNetworkClient`, overrides `request()`. Includes proactive token caching (default 30s refresh interval). Does NOT logout on 403 (treats it as a permission error, not an auth error).
   - RN: extends `RNNetworkService`, overrides `request()`. Logs out on 403.

### Token Caching (Web `FirebaseAuthNetworkService` only)
The web `FirebaseAuthNetworkService` maintains a module-level token cache (`cachedToken`, `tokenTimestamp`). Tokens are proactively refreshed if older than `tokenRefreshIntervalMs` (default 30 seconds), avoiding unnecessary calls to `user.getIdToken()`.

### Sign-in on the JS SDK, in a React Native app (`signin/`, subpath `@sudobility/auth_lib/signin`)
Google and Apple sign-in for an RN app that runs **Firebase's JS SDK on every platform** rather
than `@react-native-firebase` on mobile. The native modules (`@react-native-google-signin`,
`@invertase/react-native-apple-authentication`, `building_blocks_rn`'s `WebAuth`) are borrowed
for an ID token and nothing else; the token goes to the JS SDK's `signInWithCredential`, so one
Firebase holds one session everywhere. **This is what makes the China proxy work on a phone**:
the proxy is a `fetch` wrapper, the JS SDK's RN build looks `fetch` up per request, and the
native SDKs' connections never pass through it. Reference consumer: `music_app_rn`.

| Export | Description |
|---|---|
| `SignInConfig`, `SignInPlatform` | The four values an app supplies (iOS-type Google client, web-type Google client, Apple Services ID + redirect) and `Platform.OS` narrowed. The family's env names are `GOOGLE_OAUTH_CLIENT_ID_MACOS`, `GOOGLE_OAUTH_CLIENT_ID_WINDOWS`, `GOOGLE_OAUTH_CLIENT_SECRET_WINDOWS`, `APPLE_SERVICE_ID`, `APPLE_REDIRECT_URI` (iOS and Android read their Google clients from the services files); the library never reads an environment. |
| `googleSignInAvailable(platform, config)` / `appleSignInAvailable(platform, config)` | Pure. iOS + desktops need the iOS-type client (its reversed form must be derivable — that is the redirect scheme); Android needs the web-type client, which is what makes Google return an ID token; Apple is built in on iOS, the web flow on Android, absent on desktops. |
| `googleCredential(platform, config, modules)` / `appleCredential(platform, config, modules)` | An `OAuthCredential` or `null` for a closed sheet. Native modules are injected as narrow bridges (`GoogleSignInBridge`, `AppleAuthBridge`, `AppleAuthAndroidBridge`, `WebAuthBridge`) — **auth_lib names no native package** — as lazy `() => module` so the app can `require` inside the function (Metro turns a dynamic `import()` into a second bundle fetch that fails at the button). `iosClientId` is always passed on iOS: without it Google's module looks for a `GoogleService-Info.plist`, which an app on the JS SDK has no reason to ship. |
| `createFirebaseJsAuth(config, storage)` | The JS SDK's Auth with RN persistence (`getReactNativePersistence` read off the module, since only the RN build has it), null with no API key. |
| `reversedGoogleClientId(id)` (in `oauth/`) | `<id>.apps.googleusercontent.com` → `com.googleusercontent.apps.<id>`. Derived, never a second env variable — it drifted. |

**Account deletion has its own subpath, `@sudobility/auth_lib/account`** (`deleteAccount`, a plain backend call). An app on the JS SDK must not import it from the root: under Metro the root resolves to `index.rn.ts`, whose native Firebase init statically requires `@react-native-firebase/auth` — which such an app no longer installs, so the bundle fails to resolve. It only ever worked while a stale copy of that package sat in `node_modules`.

Platform-neutral on purpose: no `react-native` import, no native package, so it resolves the
same under Metro, Vite and Vitest, and the tests drive it through fake bridges.

### Firebase configuration, by where an app runs (`signin/firebase-config.ts`)
`useFirebaseAuthJs` initialises the JS SDK (auth, every platform) once, through `loadFirebaseJsAuth(config)` —
exported so code outside React reads the same instance.
- **iOS and Android — the Google services files, never env.** The app passes `platform` and `serviceFiles:
  { nativeFirebaseOptions: () => require('@react-native-firebase/app').getApp().options, googleServicesJson:
  require('../android/app/google-services.json') }`. Native Firebase reads `GoogleService-Info.plist` /
  `google-services.json` at launch (they are bundled and safe in git: each names the bundle ID, and the native SDK
  checks the running app matches); the JS SDK is configured from its options. iOS's Google client is the options'
  `clientId`; Android's web client (what makes Google return an ID token) is read from `google-services.json`.
- **The web, macOS and Windows — a `FirebaseWebConfig` the app builds from its environment**, passed as
  `firebaseConfig`: `{ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId }`,
  Firebase's own `initializeApp` keys. Firebase has no desktop platform, so macOS and Windows are registered as web
  apps, whose config carries no bundle ID. `projectId`, `storageBucket`, `messagingSenderId` are the project's;
  `apiKey`, `authDomain` are shared by its web apps; `appId`, `measurementId` are each web app's own — so the web,
  macOS and Windows differ only there.
- **auth_lib reads no environment and names no native package**: values and modules are injected.

### Google sign-in on the desktops: two different OAuth clients
- **macOS** uses the project's **iOS-type** client (`SignInConfig.googleIosClientId`): `ASWebAuthenticationSession`
  returns through the client's reversed id as a URL scheme (`com.googleusercontent.apps.<id>:/oauth2callback`).
- **Windows** uses a **"Desktop app"**-type client (`googleWindowsClientId` + `googleWindowsClientSecret`):
  building_blocks_rn's Windows `WebAuthModule` receives the redirect on a loopback listener
  (`http://127.0.0.1:<port>/callback`), which Google accepts only for that client type, and that type must send its
  secret with the token exchange (Google: not confidential in an installed app). auth_lib builds the URL with a
  placeholder `redirect_uri=http://127.0.0.1/callback`; the native side **replaces** it with the port it bound and
  returns the real loopback callback; `signInWithOAuthPkce` then exchanges the code with **exactly that redirect**
  (`loopbackRedirectOf`). Google rejects a token exchange whose `redirect_uri` differs from the authorize request's —
  the bug this fixed: the native side used to append a second, unencoded `redirect_uri` and hand back a rewritten
  `scheme://callback` URL, so the exchange repeated the wrong one.

### Firebase Proxy Lives in `di`, Not Here
The China reverse-proxy core moved to `@sudobility/di` (`src/firebase/firebase-proxy.ts`)
because it covers Analytics and Installations, not just Auth. `auth_lib`
re-exports the API for compatibility and keeps only the auth-specific provider filtering.

Rules that matter when touching this:
- There is **no default origin** and the library reads **no environment variable**. The app
  calls `setFirebaseProxy(origin)` at startup. If it never calls it, traffic goes direct.
- Importing `auth_lib` no longer configures the proxy as a side effect. The old
  `firebase-proxy-auto.ts` modules are gone.
- **Region detection belongs to `di`, not here.** Never probe, never check the timezone,
  never read a cache in this package. Ask `getFirebaseProxyOrigin()` / `isFirebaseProxyActive()`
  and believe the answer: null means route directly, whatever the reason.

### Analytics Integration
On auth state change, both web and RN `firebase-init` modules set the analytics user ID via `@sudobility/di` service locator:
- Web: `getFirebaseService().analytics.setUserId(user.uid)`
- RN: `getAnalyticsClient().setUserId(user.uid)`

### Barrel Exports
Every subdirectory has an `index.ts` that re-exports from implementation files. The top-level `index.ts` and `index.rn.ts` aggregate all barrel exports for the public API.

### TypeScript Configuration
- Target: ES2020, Module: ESNext, JSX: react-jsx
- Full strict mode enabled (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, etc.)
- Declaration files and source maps are generated
- Test files (`*.test.ts`, `*.spec.ts`) are excluded from compilation

## Common Tasks

### Adding a new hook
1. Create `src/hooks/useMyHook.ts` with implementation
2. Export it from `src/hooks/index.ts`
3. Export it from both `src/index.ts` (web) and `src/index.rn.ts` (React Native)
4. Add tests in `src/hooks/useMyHook.test.ts`

### Adding a new utility function
1. Create or edit the relevant file in `src/utils/`
2. Export from `src/utils/index.ts`
3. Export from `src/index.ts` and `src/index.rn.ts`

### Adding platform-specific code
1. Create two files: `myModule.ts` (web) and `myModule.rn.ts` (React Native)
2. Web entry point (`src/index.ts`) imports from `myModule`
3. RN entry point (`src/index.rn.ts`) imports from `myModule.rn.js` (note `.js` extension for RN imports)

### Publishing
```bash
bun run build && npm publish
```
CI/CD is handled via GitHub Actions using a shared workflow (`johnqh/workflows/.github/workflows/unified-cicd.yml`). Pushes to `main` or `develop` trigger the pipeline. NPM publish uses public access.

## Peer / Key Dependencies

### Peer Dependencies (required in consuming app)
| Package | Version | Optional | Purpose |
|---|---|---|---|
| `react` | ^18.0.0 \|\| ^19.0.0 | No | React hooks (useMemo, etc.) |
| `firebase` | ^12.7.0 | Yes | Web Firebase SDK (web builds) |
| `@react-native-firebase/app` | >=18.0.0 | Yes | React Native Firebase app (RN builds) |
| `@react-native-firebase/auth` | >=18.0.0 | Yes | React Native Firebase auth (RN builds) |
| `@sudobility/di` | ^1.5.64 | No | Dependency injection, WebNetworkClient, RNNetworkService, service locators |
| `@sudobility/types` | ^1.9.51 | No | Shared types (NetworkClient, NetworkResponse, UserInfoResponse, admin utils) |
| `@tanstack/react-query` | ^5.0.0 | No | Used by useSiteAdmin hook for caching |

### Key Dev Dependencies
| Package | Version | Purpose |
|---|---|---|
| `firebase` | ^12.7.0 | **Also a dev dependency, on purpose.** Optional for consumers, but `src/oauth`, `src/signin` and `src/config` import its types, so `tsc` needs it installed. Removing it from the lock as "peer-only" (0.0.98) made every CI run fail at typecheck and left npm stuck at 0.0.97 while pushes reported success locally. A library declares peer + dev; never drop the dev half of a peer it compiles against. |
| `typescript` | ~5.9.3 | TypeScript compiler |
| `vitest` | ^4.0.4 | Test runner |
| `eslint` | ^9.0.0 | Linter (flat config) |
| `prettier` | ^3.0.0 | Code formatter |

### Consuming Apps
```
auth_lib (this package)
    ^
shapeshyft_app (consumes auth)
sudojo_app (consumes auth)
```

### Code Style
- Prettier: single quotes, trailing commas (es5), 80 char width, 2-space indent, no tabs, arrow parens avoid
- ESLint: flat config, TypeScript plugin, prefer-const, no-var, prefer-template, sorted imports
- Unused vars prefixed with `_` are allowed

## Git Workflow

- Do not use feature branches for code changes. Always stay on the current branch.

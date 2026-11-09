# @sudobility/auth_lib

Firebase authentication library with configurable auth initialization, resilient network clients with automatic token refresh and logout handling, admin utilities, and React hooks for auth state management. Supports both web and React Native platforms.

## Installation

Published to **GitHub Packages** under the `@sudobility` scope, so the consuming
project needs an `.npmrc` pointing the scope at the GitHub registry (and a read
token with `read:packages`):

```
@sudobility:registry=https://npm.pkg.github.com
```

```bash
bun add @sudobility/auth_lib
```

### Peer Dependencies

```bash
bun add react firebase @sudobility/di @sudobility/types @tanstack/react-query
# For React Native, also:
bun add @react-native-firebase/app @react-native-firebase/auth
```

## The network client

Use **`FirebaseAuthNetworkService`**. It implements `NetworkClient`, injects the
Firebase ID token, sets `Content-Type: application/json` on request bodies, and
has a `.rn` variant for React Native.

Its session policy:

| Response | Behavior |
|----------|----------|
| 401, refresh succeeds | retry once with the fresh token |
| 401, unrecoverable | sign the user out -- the session is dead |
| 403 | return the response untouched; the caller is authenticated but lacks permission |

A 403 never ends the session. APIs in this workspace use 403 for role and
permission denials, so signing out there would log a user out for clicking
something they merely lack access to.

## Usage

```typescript
import {
  initializeFirebaseAuth,
  FirebaseAuthNetworkService,
  useSiteAdmin,
  getFirebaseErrorMessage,
} from '@sudobility/auth_lib';

// Initialize Firebase Auth (after Firebase app is initialized)
const { app, auth } = initializeFirebaseAuth();

// Auth-aware network client: 401 refreshes the token and retries once
const networkClient = new FirebaseAuthNetworkService();

// Check if user is a site admin
const { isSiteAdmin, isLoading } = useSiteAdmin({
  networkClient,
  baseUrl: 'https://api.example.com',
  userId: user.uid,
  token: idToken,
});
```

## API

### Firebase Initialization (`config/`)

| Export | Description |
|---|---|
| `initializeFirebaseAuth()` | Initialize Firebase Auth (singleton) |
| `getFirebaseApp()` | Get cached FirebaseApp instance |
| `getFirebaseAuth()` | Get cached Auth instance |
| `isFirebaseConfigured()` | Check if Firebase is initialized |

### Hooks (`hooks/`)

| Export | Description |
|---|---|
| `useSiteAdmin(options)` | Check site admin status via TanStack Query (fetches `/api/v1/users/:userId`) |
| `siteAdminQueryKey(userId)` | TanStack Query key `['siteAdmin', userId]` |
| `useProxyFilteredAuthProviders(providers)` | Narrow the provider list for the current China-proxy state; re-renders once proxy detection settles |

### Network (`network/`)

| Export | Description |
|---|---|
| `FirebaseAuthNetworkService` | Auth-aware network service (web and RN variants). 401 refresh-and-retry, logout only when unrecoverable; 403 left to the caller |

### Utils (`utils/`)

| Export | Description |
|---|---|
| `getFirebaseErrorMessage(code)` | Map Firebase error code to user-friendly message |
| `getFirebaseErrorCode(error)` | Extract `.code` from an error (`''` if absent) |
| `formatFirebaseError(error)` | Extract and map error code in one call |
| `isFirebaseAuthError(error)` | Check if error is a Firebase auth error |
| `isSignInCancelled(error)` / `signInCancelledError()` / `SIGN_IN_CANCELLED_CODE` | Normalize "user cancelled the sign-in sheet" across platforms (`auth/user-cancelled`) |

### Admin (`admin/`)

Re-exported from `@sudobility/types`.

| Export | Description |
|---|---|
| `parseAdminEmails(csv)` | Parse comma-separated admin email string |
| `isAdminEmail(email, adminSet)` | Check if email is in admin set |
| `createAdminChecker(csv)` | Returns admin check function (deprecated — prefer `useSiteAdmin`) |

### Account (`account/`)

| Export | Description |
|---|---|
| `deleteAccount(options)` | Call backend `DELETE /api/v1/users/:userId`; caller signs out afterward |

## Subpath Exports

Beyond the root entry, the package exposes focused subpaths (see `exports` in
`package.json`):

| Subpath | Purpose |
|---|---|
| `@sudobility/auth_lib/signin` | Google/Apple sign-in for an RN app running Firebase's **JS SDK** on every platform (not `@react-native-firebase`) |
| `@sudobility/auth_lib/oauth` | Lower-level OAuth/PKCE/web-auth-flow helpers used by `signin` |
| `@sudobility/auth_lib/account` | `deleteAccount` only — safe to import from an app that does not ship `@react-native-firebase` (the root RN entry statically requires it) |
| `@sudobility/auth_lib/auth-js` | JS-SDK auth hook/context (`useFirebaseAuthJs`, `loadFirebaseJsAuth`, `useIsLoggedIn`, `useAuthUser`) for web + desktop |
| `@sudobility/auth_lib/auth-native` | `@react-native-firebase` variant of the same auth hook |

## Dual Entry Points

- **Web**: `import` resolves to `dist/index.js` (Firebase JS SDK)
- **React Native**: `react-native` condition resolves to `dist/index.rn.js` (@react-native-firebase)

## Development

```bash
bun run build          # Compile TypeScript to dist/ (tsc + scripts/fix-esm-imports.mjs)
bun run dev            # Watch mode build
bun run test:unit      # Run tests with Vitest (there is no `test` script)
bun run test:watch     # Vitest in watch mode
bun run typecheck      # Type-check without emitting
bun run lint           # Lint with ESLint
bun run format         # Format with Prettier
```

## License

BUSL-1.1

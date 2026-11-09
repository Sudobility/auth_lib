/**
 * @fileoverview @sudobility/auth_lib - Firebase authentication utilities
 *
 * This library provides:
 * - Configurable Firebase Auth initialization
 * - Network client with automatic 401 token refresh and 403 logout handling
 * - Firebase error message utilities
 */

// China reverse-proxy API, re-exported from @sudobility/di. NOT automatic: the
// app must call setFirebaseProxy(origin) at startup; importing this library does
// not configure or route anything on its own.

// Config
export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './config';

export {
  setFirebaseProxy,
  getFirebaseProxyOrigin,
  isFirebaseProxyActive,
  firebaseProxyReady,
  disableFirebaseProxy,
  rewriteFirebaseProxyUrl,
} from '@sudobility/di';

export { filterAuthProvidersForProxy } from './config';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config';

// Hooks
export { useProxyFilteredAuthProviders } from './hooks';

export {
  useSiteAdmin,
  siteAdminQueryKey,
  type UseSiteAdminOptions,
  type UseSiteAdminResult,
  type UserInfoResponse,
} from './hooks';

// Utils
export {
  getFirebaseErrorMessage,
  getFirebaseErrorCode,
  formatFirebaseError,
  isFirebaseAuthError,
  isSignInCancelled,
  signInCancelledError,
  SIGN_IN_CANCELLED_CODE,
} from './utils';

// Network
export {
  FirebaseAuthNetworkService,
  type FirebaseAuthNetworkServiceOptions,
} from './network';

// Account management
export { deleteAccount, type DeleteAccountOptions } from './account';

// Admin
export { parseAdminEmails, isAdminEmail, createAdminChecker } from './admin';

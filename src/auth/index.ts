/**
 * @fileoverview Barrel for the JS-SDK auth hook. Exposed via
 * `@sudobility/auth_lib/auth-js` (no `react-native` condition) so desktop
 * (macOS/Windows) and web resolve this Firebase-JS-SDK build.
 */

export * from './types';
export {
  createFirebaseAuthContext,
  useIsLoggedIn,
  useAuthUser,
  type FirebaseAuthContext,
} from './context';
export { loadFirebaseJsAuth, useFirebaseAuthJs } from './useFirebaseAuth';

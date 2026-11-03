/**
 * @fileoverview Barrel for the native auth hook. Exposed via
 * `@sudobility/auth_lib/auth-native`; imported only by apps' `.ios`/`.android`
 * context files, which use `@react-native-firebase/auth`.
 */

export * from './types';
export {
  createFirebaseAuthContext,
  useIsLoggedIn,
  useAuthUser,
  type FirebaseAuthContext,
} from './context';
export { useFirebaseAuthNative } from './useFirebaseAuth.rn';

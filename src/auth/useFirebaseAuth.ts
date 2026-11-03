/**
 * @fileoverview Shared Firebase-auth hook — JS-SDK variant (desktop/web/macOS/
 * Windows). Mirrors the copied desktop `AuthContext` implementations from the
 * app fleet, parameterized by {@link FirebaseAuthConfig}. Reached only via the
 * `@sudobility/auth_lib/auth-js` subpath (no `react-native` export condition) so
 * macOS/Windows resolve this JS build instead of the native one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { signInWithGoogleOAuthDesktop } from '../oauth/google';
import { buildAppleCredential } from '../oauth/credentials';
import { appleCredential, googleCredential } from '../signin/credentials';
import {
  signInCancelledError,
  withAppleCancel,
} from '../utils/firebase-errors';
import {
  createFirebaseJsAuth,
  type FirebaseJsAuthConfig,
  type PersistenceStorage,
} from '../signin/firebase-js-auth';
import {
  loadServiceFileFirebaseConfig,
  type ServiceFileFirebaseConfig,
} from '../signin/firebase-config';
import {
  type AuthContextValue,
  type AuthUser,
  DEFAULT_REFRESH_INTERVAL_MS,
  type FirebaseAuthConfig,
} from './types';

let firebaseAuth: Auth | null = null;
let authPromise: Promise<Auth | null> | null = null;
/** What the services files said, once read (React Native only). */
let serviceFileConfig: ServiceFileFirebaseConfig | null = null;

/**
 * The app's one Firebase Auth, initialised once.
 *
 * iOS and Android (`serviceFiles` set): configured from the app's Google
 * services files, through native Firebase's options. The web, macOS and
 * Windows: from the `firebaseConfig` the app passes — a FirebaseWebConfig
 * built from its environment (see `signin/firebase-config`).
 * Null with nothing to configure from, which is a supported state — a
 * local-only build, no sign-in.
 *
 * Exported so code outside React (a document store's token getter) reads the
 * same instance the hook does, whichever asks first.
 */
export function loadFirebaseJsAuth(
  config: FirebaseAuthConfig
): Promise<Auth | null> {
  if (authPromise) return authPromise;
  const storage =
    (config.asyncStorage as PersistenceStorage | undefined) ?? null;
  authPromise = (async () => {
    if (
      (config.platform === 'ios' || config.platform === 'android') &&
      config.serviceFiles
    ) {
      serviceFileConfig = await loadServiceFileFirebaseConfig(
        config.serviceFiles
      );
      if (!serviceFileConfig?.firebase.apiKey) return null;
      firebaseAuth = createFirebaseJsAuth(serviceFileConfig.firebase, storage);
      return firebaseAuth;
    }
    const firebaseConfig = config.firebaseConfig;
    if (!firebaseConfig || !firebaseConfig.apiKey) return null;
    firebaseAuth = createFirebaseJsAuth(
      firebaseConfig as FirebaseJsAuthConfig,
      storage
    );
    return firebaseAuth;
  })().catch(error => {
    // A config that cannot be read is a build that cannot sign in, not a
    // crash; and the next call may try again.
    console.error('[Auth] Could not configure Firebase:', error);
    authPromise = null;
    return null;
  });
  return authPromise;
}

/**
 * The client ids for `signin/`: the services files' Google clients where they
 * were read, over whatever the app passed; Apple's always the app's.
 */
function signInConfigOf(cfg: FirebaseAuthConfig) {
  const base = cfg.signIn ?? {
    googleIosClientId:
      cfg.googleOAuth?.clientId ?? cfg.googleNative?.iosClientId ?? '',
    googleWebClientId: cfg.googleNative?.webClientId ?? '',
    appleServiceId: cfg.appleAndroid?.serviceId ?? '',
    appleRedirectUri: cfg.appleAndroid?.redirectUri ?? '',
  };
  if (!serviceFileConfig) return base;
  return {
    ...base,
    googleIosClientId:
      serviceFileConfig.googleIosClientId || base.googleIosClientId,
    googleWebClientId:
      serviceFileConfig.googleWebClientId || base.googleWebClientId,
  };
}

function toAuthUser(firebaseUser: User | null): AuthUser | null {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    isAnonymous: firebaseUser.isAnonymous,
  };
}

/**
 * JS-SDK Firebase auth state + operations. Wrap the returned value in the app's
 * own context provider so `useAuth()` keeps app-local context identity.
 */
export function useFirebaseAuthJs(
  config: FirebaseAuthConfig
): AuthContextValue {
  const configRef = useRef(config);
  configRef.current = config;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [rawUser, setRawUser] = useState<User | null>(null);
  const prevUidRef = useRef<string | null>(null);
  // Set by `signOut` so the auth listener can tell an explicit sign-out from a
  // fresh launch. On an explicit sign-out it publishes the logged-out state
  // right away (so the UI responds immediately) before the `autoSignInAnonymously`
  // fallback re-creates a guest session; on a fresh launch it goes straight to
  // the anonymous session without flashing a logged-out UI.
  const signedOutRef = useRef(false);

  useEffect(() => {
    const cfg = configRef.current;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    cfg.onInit?.();
    void loadFirebaseJsAuth(cfg).then(auth => {
      if (cancelled) return;
      if (!auth) {
        setIsLoading(false);
        setIsReady(true);
        return;
      }

      unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
        if (!firebaseUser && configRef.current.autoSignInAnonymously) {
          // Signed out, with the anonymous fallback enabled. On an *explicit*
          // sign-out, publish the signed-out state first so the UI leaves the
          // signed-in state immediately — even if the anonymous sign-in below
          // is slow or fails. The anonymous user that follows is still treated
          // as logged out by callers (via `isAnonymous`). On a fresh launch
          // (no explicit sign-out) skip that, to avoid flashing a logged-out UI
          // before the anonymous session is ready.
          if (signedOutRef.current) {
            signedOutRef.current = false;
            if (prevUidRef.current !== null) {
              configRef.current.onIdentityChange?.(prevUidRef.current, null);
              prevUidRef.current = null;
            }
            setUser(null);
            setRawUser(null);
            setToken(null);
            configRef.current.onUserChanged?.(null);
            setIsLoading(false);
            setIsReady(true);
          }
          try {
            await firebaseSignInAnonymously(auth);
          } catch (error) {
            console.error('[Auth] Anonymous sign-in failed:', error);
            setIsLoading(false);
            setIsReady(true);
          }
          return; // listener re-fires with the anonymous user
        }

        // Signed out with no anonymous fallback, or a user is present: clear
        // the explicit-sign-out guard and publish the current state.
        signedOutRef.current = false;

        const mapped = toAuthUser(firebaseUser);
        const nextUid = mapped?.uid ?? null;
        if (prevUidRef.current !== nextUid) {
          configRef.current.onIdentityChange?.(prevUidRef.current, nextUid);
          prevUidRef.current = nextUid;
        }

        setUser(mapped);
        setRawUser(firebaseUser);
        configRef.current.onUserChanged?.(mapped);

        if (firebaseUser) {
          try {
            setToken(await firebaseUser.getIdToken());
          } catch (error) {
            console.error('[Auth] Error getting ID token:', error);
            setToken(null);
          }
        } else {
          setToken(null);
        }

        setIsLoading(false);
        setIsReady(true);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const intervalMs = configRef.current.refreshIntervalMs;
    if (!rawUser || intervalMs === null) return;
    const refreshInterval = setInterval(async () => {
      try {
        setToken(await rawUser.getIdToken(true));
      } catch (error) {
        console.error('[Auth] Error refreshing token:', error);
      }
    }, intervalMs ?? DEFAULT_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshInterval);
  }, [rawUser]);

  const requireAuth = useCallback(async (): Promise<Auth> => {
    const auth = await loadFirebaseJsAuth(configRef.current);
    if (!auth) throw new Error('Firebase not configured');
    return auth;
  }, []);

  const requireProvider = useCallback(
    (name: keyof NonNullable<FirebaseAuthConfig['providers']>) => {
      const providers = configRef.current.providers;
      // Default-on for google + emailPassword to match the fleet's base behavior.
      const enabledByDefault = name === 'google' || name === 'emailPassword';
      const enabled = providers ? (providers[name] ?? false) : enabledByDefault;
      if (!enabled) throw new Error(`${name} sign-in is not enabled`);
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    requireProvider('google');
    const auth = await requireAuth();
    const cfg = configRef.current;
    setIsLoading(true);
    try {
      if (cfg.webPopup) {
        // Browser: Firebase's own popup flow (no borrowed credential).
        await signInWithPopup(auth, new GoogleAuthProvider());
        return;
      }
      let credential;
      if (cfg.platform) {
        credential = await googleCredential(cfg.platform, signInConfigOf(cfg), {
          ...(cfg.webAuth ? { webAuth: cfg.webAuth } : {}),
          ...(cfg.getGoogleSignin ? { googleSignIn: cfg.getGoogleSignin } : {}),
        });
      } else {
        if (!cfg.googleOAuth || !cfg.webAuth) {
          throw new Error(
            'Google desktop sign-in requires googleOAuth + webAuth config'
          );
        }
        credential = await signInWithGoogleOAuthDesktop(
          cfg.googleOAuth,
          cfg.webAuth
        );
      }
      // A closed sheet is no credential: reject, so the caller does not
      // take it for a sign-in.
      if (!credential) throw signInCancelledError();
      await signInWithCredential(auth, credential);
    } finally {
      setIsLoading(false);
    }
  }, [requireAuth, requireProvider]);

  const signInWithApple = useCallback(async () => {
    requireProvider('apple');
    const auth = await requireAuth();
    const cfg = configRef.current;
    if (cfg.platform) {
      setIsLoading(true);
      try {
        const credential = await appleCredential(
          cfg.platform,
          signInConfigOf(cfg),
          {
            ...(cfg.getAppleAuth ? { appleAuth: cfg.getAppleAuth } : {}),
            ...(cfg.getAppleAuthAndroid
              ? { appleAuthAndroid: cfg.getAppleAuthAndroid }
              : {}),
          }
        );
        if (!credential) throw signInCancelledError();
        await signInWithCredential(auth, credential);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (cfg.webPopup) {
      // Browser: Firebase's own popup flow.
      setIsLoading(true);
      try {
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        await signInWithPopup(auth, provider);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (!cfg.getAppleAuth)
      throw new Error('Apple sign-in requires getAppleAuth config');
    setIsLoading(true);
    try {
      const appleAuth = await cfg.getAppleAuth();
      const response = await withAppleCancel(() =>
        appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        })
      );
      if (!response.identityToken)
        throw new Error('No identity token from Apple');
      const credential = buildAppleCredential({
        idToken: response.identityToken,
        ...(response.nonce ? { rawNonce: response.nonce } : {}),
      });
      await signInWithCredential(auth, credential);
    } finally {
      setIsLoading(false);
    }
  }, [requireAuth, requireProvider]);

  const signInAnonymously = useCallback(async () => {
    requireProvider('anonymous');
    const auth = await requireAuth();
    setIsLoading(true);
    try {
      await firebaseSignInAnonymously(auth);
    } finally {
      setIsLoading(false);
    }
  }, [requireAuth, requireProvider]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      requireProvider('emailPassword');
      const auth = await requireAuth();
      setIsLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } finally {
        setIsLoading(false);
      }
    },
    [requireAuth, requireProvider]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      requireProvider('emailPassword');
      const auth = await requireAuth();
      setIsLoading(true);
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } finally {
        setIsLoading(false);
      }
    },
    [requireAuth, requireProvider]
  );

  const signOut = useCallback(async () => {
    const auth = await loadFirebaseJsAuth(configRef.current);
    if (!auth) return;
    setIsLoading(true);
    // Mark this as an explicit sign-out so the auth listener publishes the
    // signed-out state instead of re-creating an anonymous session.
    signedOutRef.current = true;
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      signedOutRef.current = false;
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    const auth = await loadFirebaseJsAuth(configRef.current);
    if (!auth) throw new Error('Firebase not configured');
    await firebaseSendPasswordResetEmail(auth, email);
  }, []);

  const getToken = useCallback(async () => {
    if (!rawUser) return null;
    try {
      return await rawUser.getIdToken();
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  }, [rawUser]);

  const refreshToken = useCallback(async () => {
    if (!rawUser) return null;
    try {
      const newToken = await rawUser.getIdToken(true);
      setToken(newToken);
      return newToken;
    } catch (error) {
      console.error('[Auth] Error refreshing token:', error);
      return null;
    }
  }, [rawUser]);

  return useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isReady,
      token,
      signInWithGoogle,
      signInWithApple,
      signInAnonymously,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      sendPasswordResetEmail,
      getToken,
      refreshToken,
    }),
    [
      user,
      isLoading,
      isReady,
      token,
      signInWithGoogle,
      signInWithApple,
      signInAnonymously,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      sendPasswordResetEmail,
      getToken,
      refreshToken,
    ]
  );
}

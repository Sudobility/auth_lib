/**
 * @fileoverview Canonical auth-context contract shared by every app's
 * AuthProvider, plus the config the shared hooks accept. Platform-agnostic
 * (types only) — safe to import from web, RN, and the `oauth` subpath.
 */

import type { OAuthClientConfig, WebAuthBridge } from '../oauth/webAuthFlow';
import type { SignInConfig, SignInPlatform } from '../signin/config';
import type {
  FirebaseWebConfig,
  ServiceFileSources,
} from '../signin/firebase-config';
import type {
  AppleAuthAndroidBridge,
  AppleAuthBridge,
  GoogleSignInBridge,
  ModuleGetter,
} from '../signin/credentials';

/** Serialisable subset of the Firebase user consumed by app components. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

/** The canonical value exposed by every app's `useAuth()`. */
export interface AuthContextValue {
  /** Currently authenticated user, or `null` when signed out. */
  user: AuthUser | null;
  /** Whether an auth operation is in progress. */
  isLoading: boolean;
  /** Whether the initial auth state has been determined. */
  isReady: boolean;
  /** Current Firebase ID token, or `null`. */
  token: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  /** Return the current ID token (cached), or `null`. */
  getToken: () => Promise<string | null>;
  /** Force-refresh the ID token and return it. */
  refreshToken: () => Promise<string | null>;
}

/** Which providers an app enables. Disabled providers' methods reject. */
export interface AuthProvidersConfig {
  google?: boolean;
  apple?: boolean;
  anonymous?: boolean;
  emailPassword?: boolean;
}

/**
 * The native sign-in modules, as the narrow bridges `signin/` defines — one
 * vocabulary for the JS-SDK and native hooks. Injected so auth_lib carries
 * no native dependency.
 */
export type GoogleSigninLike = GoogleSignInBridge;
export type AppleAuthLike = AppleAuthBridge;
export type AppleAuthAndroidLike = AppleAuthAndroidBridge;

/**
 * Config for the shared Firebase-auth hooks. Fields are consumed selectively by
 * the JS-SDK (desktop/web) vs native variant; unused ones are ignored.
 */
export interface FirebaseAuthConfig {
  /**
   * The web, macOS and Windows: this web app's Firebase configuration, which
   * the app builds from its environment (iOS and Android use `serviceFiles`).
   */
  firebaseConfig?: FirebaseWebConfig;
  /** JS-SDK only: AsyncStorage instance for RN persistence (injected). */
  asyncStorage?: unknown;
  /**
   * JS SDK on every platform — the fleet's layout since the China proxy,
   * a `fetch` wrapper, covers the JS SDK on a phone and the native SDK never.
   * With `platform` set, `signInWithGoogle` and `signInWithApple` go through
   * `signin/` (`googleCredential`/`appleCredential`): Google's SDK on iOS and
   * Android, the system browser on the desktops, Apple's sheet on iOS and
   * Apple's web flow on Android — each borrowed for an ID token that the JS
   * SDK's `signInWithCredential` takes. `signIn` holds the client ids; the
   * module getters below supply the modules. Without `platform`, the hook is
   * the desktop-only one it was (`googleOAuth` + `webAuth`).
   */
  platform?: SignInPlatform;
  signIn?: SignInConfig;
  /**
   * iOS and Android: read Firebase's configuration — and the Google sign-in
   * client id — from the app's Google services files (see
   * `signin/firebase-config`); `firebaseConfig` is not used there. The web,
   * macOS and Windows pass `firebaseConfig`, a FirebaseWebConfig, instead.
   */
  serviceFiles?: ServiceFileSources;
  /**
   * Browser (web) only: use Firebase's own `signInWithPopup` for Google and
   * Apple instead of a borrowed credential or desktop PKCE. Set by the web app,
   * where there is no `platform` and no system-browser bridge.
   */
  webPopup?: boolean;
  /** Desktop Google PKCE config (`clientId` + `reversedClientId`). */
  googleOAuth?: OAuthClientConfig;
  /** Injected system-browser bridge for desktop Google PKCE. */
  webAuth?: WebAuthBridge;
  /** Native Google client ids for `GoogleSignin.configure` (native hook). */
  googleNative?: { webClientId?: string; iosClientId?: string };
  /** Native Google Sign-In module getter — `require`d or `import()`ed. */
  getGoogleSignin?: ModuleGetter<GoogleSigninLike>;
  /** Native (iOS/macOS) Apple module getter. */
  getAppleAuth?: ModuleGetter<AppleAuthLike>;
  /** Android web Apple module getter + config (native hook). */
  getAppleAuthAndroid?: ModuleGetter<AppleAuthAndroidLike>;
  appleAndroid?: { serviceId: string; redirectUri: string };
  /** Which providers are enabled. Defaults: google + emailPassword on. */
  providers?: AuthProvidersConfig;
  /** Auto-anonymous sign-in when the listener fires with no user. */
  autoSignInAnonymously?: boolean;
  /** Called on every auth-state change (e.g. set consumables user id). */
  onUserChanged?: (user: AuthUser | null) => void;
  /** Called once on provider init (e.g. initialize a downstream service). */
  onInit?: () => void;
  /** Called on uid identity transitions (e.g. LayoutAnimation). */
  onIdentityChange?: (prevUid: string | null, nextUid: string | null) => void;
  /** Background token-refresh interval (ms). Default 50 min; `null` disables. */
  refreshIntervalMs?: number | null;
}

/** Default background refresh interval: 50 minutes (tokens expire at 60). */
export const DEFAULT_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

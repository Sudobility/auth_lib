/**
 * @fileoverview React context factory around a Firebase-auth hook. Lets each
 * app collapse its `AuthContext.{tsx,ios,android}` to a few lines: pick the
 * platform hook variant, pass config, get back `{ AuthProvider, useAuth }`.
 * Uses `createElement` (no JSX) so auth_lib needs no JSX build config.
 */

import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from 'react';
import type { AuthContextValue, AuthUser, FirebaseAuthConfig } from './types';

/**
 * A shared auth context fed by the AuthProvider that
 * `createFirebaseAuthContext` builds. It lets standalone hooks (`useIsLoggedIn`)
 * and other libraries (e.g. subscription_lib's `useIsUserSubscribable`) read
 * auth state without the per-app factory handle. Exactly one auth context is
 * live per app build, so this single shared context is unambiguous.
 */
const SharedAuthContext = createContext<AuthContextValue | null>(null);

/**
 * Whether the current user is logged in: a real, non-anonymous account
 * (`!!user && !user.isAnonymous`). An anonymous user has a userId but counts as
 * "logged out" for UI purposes. Standalone — reads the AuthProvider that
 * `createFirebaseAuthContext` builds; returns `false` outside any provider.
 */
export function useIsLoggedIn(): boolean {
  const ctx = useContext(SharedAuthContext);
  const user = ctx?.user ?? null;
  return !!user && !user.isAnonymous;
}

/**
 * The current authenticated user (real or anonymous), or `null` when there is
 * none. Standalone — reads the AuthProvider that `createFirebaseAuthContext`
 * builds, so shared libraries (building_blocks, entity_pages, subscription_pages)
 * can read the user without the per-app `useAuth` factory handle. Returns `null`
 * outside any provider.
 */
export function useAuthUser(): AuthUser | null {
  const ctx = useContext(SharedAuthContext);
  return ctx?.user ?? null;
}

export interface FirebaseAuthContext {
  AuthProvider: (props: { children: ReactNode }) => ReactNode;
  useAuth: () => AuthContextValue;
  /** The standalone {@link useIsLoggedIn}, re-exposed on the factory handle. */
  useIsLoggedIn: () => boolean;
}

/**
 * Build an `{ AuthProvider, useAuth, useIsLoggedIn }` set backed by the given
 * hook variant (`useFirebaseAuthJs` or `useFirebaseAuthNative`) and config.
 * Each platform's context file calls this once; Metro's `.ios`/`.android`/base
 * resolution ensures exactly one context is live per build. The AuthProvider
 * also feeds the shared context behind the standalone {@link useIsLoggedIn}.
 */
export function createFirebaseAuthContext(
  useAuthHook: (config: FirebaseAuthConfig) => AuthContextValue,
  config: FirebaseAuthConfig
): FirebaseAuthContext {
  const Context = createContext<AuthContextValue | null>(null);

  function AuthProvider({ children }: { children: ReactNode }): ReactNode {
    const value = useAuthHook(config);
    // Feed both the per-app context (for useAuth) and the shared context
    // (for the standalone useIsLoggedIn and other libraries).
    return createElement(
      SharedAuthContext.Provider,
      { value },
      createElement(Context.Provider, { value }, children)
    );
  }

  function useAuth(): AuthContextValue {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
  }

  return { AuthProvider, useAuth, useIsLoggedIn };
}

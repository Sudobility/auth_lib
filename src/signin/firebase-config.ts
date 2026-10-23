/**
 * @fileoverview Firebase's configuration for the JS SDK, by where an app runs.
 *
 * - **iOS and Android** are configured from the app's Google services files
 *   (`GoogleService-Info.plist`, `google-services.json`), never environment
 *   variables. The files are bundled with the app and safe in source control:
 *   each names the app's bundle ID, and the native SDK checks the running app
 *   matches it. Native Firebase (`@react-native-firebase/app`) reads them at
 *   launch and exposes what it read as `getApp().options`; the JS SDK (auth)
 *   is initialised from those. Android's Google *web* client id — what makes
 *   Google return an ID token there — is not among the options, so it is
 *   read from `google-services.json`, which the app `require`s.
 * - **The web, macOS and Windows** are Firebase *web apps*: Firebase has no
 *   desktop platform, and a web app's configuration carries no bundle ID. The
 *   app builds a {@link FirebaseWebConfig} from its environment variables and
 *   passes it in. Of its fields, `projectId`, `storageBucket` and
 *   `messagingSenderId` are the project's, `apiKey` and `authDomain` are
 *   shared by all of its web apps, and `appId` and `measurementId` belong to
 *   one web app — so the web, macOS and Windows each have their own.
 *
 * Native modules and files are injected; auth_lib names no native package and
 * reads no environment.
 */

import type { ModuleGetter } from './credentials';

/**
 * The JS SDK's configuration for a Firebase web app — the web, macOS and
 * Windows — and what the iOS and Android paths produce for the JS SDK too.
 * Firebase's own `initializeApp` keys, so it is passed straight through.
 */
export interface FirebaseWebConfig {
  [option: string]: unknown;
  /** Shared by the project's web apps. */
  apiKey: string;
  /** Shared by the project's web apps. */
  authDomain: string;
  /** The project's. */
  projectId: string;
  /** The project's. */
  storageBucket: string;
  /** The project's (Android calls it `project_number`). */
  messagingSenderId: string;
  /** This web app's own. */
  appId: string;
  /** This web app's own (Google Analytics). */
  measurementId: string;
}

/** `getApp().options` from `@react-native-firebase/app` — what it read natively. */
export interface NativeFirebaseOptions {
  apiKey?: string;
  appId: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  /** iOS only: the plist's CLIENT_ID. */
  clientId?: string;
}

/** Where iOS and Android read their configuration from. */
export interface ServiceFileSources {
  /** `() => require('@react-native-firebase/app').getApp().options` */
  nativeFirebaseOptions: ModuleGetter<NativeFirebaseOptions>;
  /** `require('../android/app/google-services.json')` — Android's web client. */
  googleServicesJson?: unknown;
}

/** The JS SDK's config and the Google sign-in client ids from the services files. */
export interface ServiceFileFirebaseConfig {
  firebase: FirebaseWebConfig;
  /** iOS: the plist's CLIENT_ID, or ''. */
  googleIosClientId: string;
  /** Android: the project's web-type client from google-services.json, or ''. */
  googleWebClientId: string;
}

/**
 * The project's web-type Google client from a google-services.json — the
 * same for every Android app the file lists, being the project's.
 */
export function googleWebClientIdFromServicesJson(json: unknown): string {
  const clients =
    (json as { client?: Array<Record<string, unknown>> } | null)?.client ?? [];
  for (const client of clients) {
    const oauth =
      (client['oauth_client'] as Array<Record<string, unknown>> | undefined) ??
      [];
    const services = client['services'] as
      Record<string, Record<string, unknown>> | undefined;
    const other =
      (services?.['appinvite_service']?.['other_platform_oauth_client'] as
        Array<Record<string, unknown>> | undefined) ?? [];
    const web = [...oauth, ...other].find(c => c['client_type'] === 3);
    if (web && typeof web['client_id'] === 'string') return web['client_id'];
  }
  return '';
}

/** The JS SDK's config from native Firebase's options (iOS and Android). */
export function firebaseConfigFromNativeOptions(
  options: NativeFirebaseOptions,
  googleServicesJson?: unknown
): ServiceFileFirebaseConfig {
  return {
    firebase: {
      apiKey: options.apiKey ?? '',
      authDomain: options.projectId
        ? `${options.projectId}.firebaseapp.com`
        : '',
      projectId: options.projectId,
      storageBucket: options.storageBucket ?? '',
      messagingSenderId: options.messagingSenderId ?? '',
      appId: options.appId,
      measurementId: options.measurementId ?? '',
    },
    googleIosClientId: options.clientId ?? '',
    googleWebClientId:
      googleServicesJson === undefined
        ? ''
        : googleWebClientIdFromServicesJson(googleServicesJson),
  };
}

/** iOS and Android: the configuration native Firebase read from the services files. */
export async function loadServiceFileFirebaseConfig(
  sources: ServiceFileSources
): Promise<ServiceFileFirebaseConfig> {
  const options = await sources.nativeFirebaseOptions();
  return firebaseConfigFromNativeOptions(options, sources.googleServicesJson);
}

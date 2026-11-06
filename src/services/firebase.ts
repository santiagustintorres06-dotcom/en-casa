import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from "firebase/firestore";

const env = import.meta.env;
export const emulatorMode =
  env.DEV &&
  env.VITE_USE_FIREBASE_EMULATORS === "true" &&
  ["localhost", "127.0.0.1"].includes(location.hostname);
const config = emulatorMode
  ? {
      apiKey: "demo-api-key",
      authDomain: "demo-encasa.firebaseapp.com",
      projectId: "demo-encasa",
      appId: "demo-encasa-app",
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
export const firebaseConfigured =
  Object.values(config).every(Boolean) &&
  (emulatorMode || !!env.VITE_RECAPTCHA_SITE_KEY);
function initialize() {
  if (!firebaseConfigured) return null;
  const app = initializeApp(config);
  if (!emulatorMode)
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  const auth = getAuth(app);
  // Stage 3 keeps shared data in memory. Persistent offline cache arrives with PWA support.
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (emulatorMode) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return { app, auth, db };
}
export const firebase = initialize();

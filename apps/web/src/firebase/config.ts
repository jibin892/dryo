import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth'

// Firebase Web config for project dryo-18227, sourced from Vite env vars
// (apps/web/.env). These keys are PUBLIC — access is governed by Firebase Auth.
// Fallbacks keep the app working if the .env is missing.
const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyC2IJPMS2cQTdJMWYckXPo4_PeFBREX9o8',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'dryo-18227.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'dryo-18227',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'dryo-18227.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '945160637230',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:945160637230:web:53fc7869787c14a53dc8bf',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-0XB4EBXCRK',
}

// Guard against HMR re-initialising the app.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Use localStorage persistence instead of the default IndexedDB. IndexedDB can
// throw "Database is closing/hidden" when the tab or service worker churns
// during development; localStorage is simpler and avoids that failure mode.
function makeAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    // Already initialised (e.g. HMR) — reuse the existing instance.
    return getAuth(app)
  }
}

export const auth = makeAuth()

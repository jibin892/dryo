// OneSignal Web SDK v16 integration.
// The SDK <script> is loaded in index.html; here we drive it via the deferred
// queue so calls are safe before the SDK finishes loading.

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID ?? 'd0b787e4-6ae5-4869-ad83-9086b501040f'

type OneSignalApi = {
  init: (config: Record<string, unknown>) => Promise<void>
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Slidedown: { promptPush: () => Promise<void> }
  Notifications: { requestPermission: () => Promise<void>; permission: boolean }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>
  }
}

function push(fn: (os: OneSignalApi) => void | Promise<void>) {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(fn)
}

let started = false

/** Initialise OneSignal once. The worker is scoped to /onesignal/ so it does
 *  not collide with the app's own (vite-plugin-pwa) service worker at /. */
export function initOneSignal() {
  if (started) return
  started = true
  push(async (OneSignal) => {
    await OneSignal.init({
      appId: APP_ID,
      serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/onesignal/' },
      allowLocalhostAsSecureOrigin: true,
    })
  })
}

/** Tie the subscription to the signed-in user (Firebase uid) so the backend
 *  could target them individually later. */
export function identifyOneSignalUser(uid: string) {
  push(async (OneSignal) => {
    await OneSignal.login(uid)
  })
}

/** Ask the browser for notification permission (call from a user action). */
export function promptOneSignal() {
  push(async (OneSignal) => {
    if (OneSignal.Notifications?.permission) return
    await OneSignal.Slidedown.promptPush()
  })
}

export function logoutOneSignal() {
  push(async (OneSignal) => {
    await OneSignal.logout()
  })
}

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import type { Role, Session } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { auth } from './config'

const HOUSE_NAME = 'Vandanmedu Curing House'

// Offline fallback role map, used only when the API is unreachable.
const ROLE_BY_PHONE: Record<string, Role> = {
  '+919847012345': 'MANAGER',
  '+919847067890': 'OPERATOR',
}

function roleFor(user: User): Role {
  if (user.phoneNumber && ROLE_BY_PHONE[user.phoneNumber]) return ROLE_BY_PHONE[user.phoneNumber]
  const usedGoogle = user.providerData.some((p) => p.providerId === 'google.com')
  return usedGoogle ? 'MANAGER' : 'OPERATOR'
}

/** Offline/local session — authoritative role comes from the API via fetchSession. */
export function sessionFromUser(user: User): Session {
  return {
    staffId: user.uid,
    displayName: user.displayName || user.phoneNumber || 'Dryo user',
    phone: user.phoneNumber?.replace(/^\+91/, '') || '',
    email: user.email ?? undefined,
    role: roleFor(user),
    houseName: HOUSE_NAME,
    status: 'ACTIVE',
  }
}

/**
 * Resolves the authoritative account from the backend (/me): role, status, and
 * profile come from Postgres. If the API is unreachable, falls back to a local
 * session so the app still works offline.
 */
export async function fetchSession(user: User): Promise<Session> {
  try {
    const me = await dryoApi.me()
    return {
      staffId: me.uid,
      displayName: me.displayName || user.displayName || user.phoneNumber || 'Dryo user',
      phone: (me.phone || user.phoneNumber || '').replace(/^\+91/, ''),
      email: me.email || user.email || undefined,
      role: me.role,
      houseName: me.houseName || HOUSE_NAME,
      status: me.status,
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      // Backend not running — degrade gracefully to a local session.
      return sessionFromUser(user)
    }
    throw err
  }
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider)
}

let recaptcha: RecaptchaVerifier | null = null

/** Fully tear down any existing verifier AND empty its host node, so the next
 *  attempt renders into a virgin element (avoids "reCAPTCHA has already been
 *  rendered in this element" on retries, StrictMode remounts, and HMR). */
export function resetRecaptcha(): void {
  try {
    recaptcha?.clear()
  } catch {
    // clear() throws if the widget was never rendered — safe to ignore.
  }
  recaptcha = null
  const wrapper = document.getElementById(RECAPTCHA_WRAPPER_ID)
  if (wrapper) wrapper.innerHTML = ''
}

const RECAPTCHA_WRAPPER_ID = 'dryo-recaptcha'

/** Sends an SMS OTP to an Indian mobile number (10 digits, no country code). */
export async function startPhoneSignIn(localNumber: string): Promise<ConfirmationResult> {
  resetRecaptcha()
  const wrapper = document.getElementById(RECAPTCHA_WRAPPER_ID)
  if (!wrapper) throw new Error('reCAPTCHA container is missing.')
  // Give the verifier a fresh child element every time. A VISIBLE ('normal')
  // widget uses the classic reCAPTCHA v2 flow, which is far more reliable on
  // localhost than the invisible attestation flow (that one 401s on /api2/pat).
  const host = document.createElement('div')
  host.style.marginTop = '12px'
  wrapper.appendChild(host)
  recaptcha = new RecaptchaVerifier(auth, host, { size: 'normal' })
  await recaptcha.render()
  return signInWithPhoneNumber(auth, `+91${localNumber}`, recaptcha)
}

export async function signOutUser(): Promise<void> {
  resetRecaptcha()
  await signOut(auth)
}

export { auth }

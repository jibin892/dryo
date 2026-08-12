import { useState, type FormEvent } from 'react'
import type { ConfirmationResult } from 'firebase/auth'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Button, StatusBanner } from '../shared/ui/components'
import { resetRecaptcha, signInWithGoogle, startPhoneSignIn } from '../firebase/auth'
import './auth.css'

const RECAPTCHA_ID = 'dryo-recaptcha'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in yet. Add it in the Firebase console.'
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled yet. Ask an admin to turn on the Phone provider in Firebase.'
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit mobile number.'
    case 'auth/invalid-verification-code':
      return 'That code is incorrect. Check the SMS and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a little while and try again.'
    case 'auth/billing-not-enabled':
      return 'Phone auth needs the Blaze plan enabled on this Firebase project.'
    default:
      return (err as { message?: string })?.message ?? 'Something went wrong. Please try again.'
  }
}

export function AuthFlow() {
  const [stage, setStage] = useState<'login' | 'otp'>('login')
  const [localNumber, setLocalNumber] = useState('')
  const [code, setCode] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      // onAuthStateChanged in App swaps to the app on success.
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSendCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await startPhoneSignIn(localNumber)
      setConfirmation(result)
      setStage('otp')
    } catch (err) {
      resetRecaptcha()
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault()
    if (!confirmation) return
    setError(null)
    setBusy(true)
    try {
      await confirmation.confirm(code)
      // onAuthStateChanged in App swaps to the app on success.
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  function backToLogin() {
    resetRecaptcha()
    setConfirmation(null)
    setCode('')
    setError(null)
    setStage('login')
  }

  if (stage === 'otp') {
    const masked = `+91 ${localNumber.slice(0, 2)} ••• ${localNumber.slice(-3)}`
    return (
      <main className="auth-screen">
        <button className="auth-back" type="button" onClick={backToLogin} aria-label="Back to sign in"><ArrowLeft aria-hidden="true" /></button>
        <div className="auth-content">
          <p className="eyebrow">Mobile verification</p>
          <h1>Enter your code.</h1>
          <p className="auth-intro">We sent a one-time code by SMS to {masked}.</p>
          <form onSubmit={onVerify} className="auth-form">
            <label className="field-label" htmlFor="otp">6-digit verification code</label>
            <input
              className="otp-field"
              id="otp"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
            />
            {error && <StatusBanner tone="critical">{error}</StatusBanner>}
            <Button type="submit" disabled={code.length !== 6 || busy}>{busy ? 'Verifying…' : 'Verify and continue'}</Button>
            <button className="text-button" type="button" onClick={backToLogin}>Use a different number</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-screen">
      <div className="auth-brand" aria-label="Dryo wordmark">Dry<span>o</span></div>
      <div className="auth-content">
        <p className="eyebrow">Curing house access</p>
        <h1>Welcome back.</h1>
        <p className="auth-intro">Sign in with Google, or verify your mobile number to reach the drying floor.</p>

        <button className="google-button" type="button" onClick={onGoogle} disabled={busy}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={onSendCode} className="auth-form">
          <label className="field-label" htmlFor="phone">Mobile number</label>
          <div className="phone-field-row">
            <div className="country-field-static">+91</div>
            <div className="field-shell phone-number-shell">
              <input
                id="phone"
                aria-label="Mobile number"
                value={localNumber}
                onChange={(event) => setLocalNumber(event.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98470 12345"
              />
            </div>
          </div>
          {error && <StatusBanner tone="critical">{error}</StatusBanner>}
          <Button type="submit" disabled={localNumber.length < 10 || busy}>{busy ? 'Sending…' : 'Send SMS code'}</Button>
        </form>

        <div id={RECAPTCHA_ID} />

        <div className="auth-security">
          <LockKeyhole aria-hidden="true" size={17} />
          <span>Secured by Firebase Authentication</span>
        </div>
      </div>
    </main>
  )
}

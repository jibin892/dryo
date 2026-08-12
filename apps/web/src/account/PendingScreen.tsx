import { Clock, LogOut } from 'lucide-react'
import type { Session } from '../shared/contracts'
import { Button } from '../shared/ui/components'
import '../auth/auth.css'

export function PendingScreen({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <main className="auth-screen">
      <div className="auth-content auth-centred" style={{ textAlign: 'center' }}>
        <span className="passkey-icon" style={{ display: 'grid', width: 72, height: 72, placeItems: 'center', margin: '0 auto 24px', borderRadius: 999, background: 'var(--fill-08)' }}>
          <Clock aria-hidden="true" size={34} strokeWidth={1.5} />
        </span>
        <p className="eyebrow">Awaiting access</p>
        <h1 style={{ marginTop: 10 }}>Almost there.</h1>
        <p className="auth-intro">
          You're signed in as {session.email || session.phone}, but your account isn't linked to a curing house yet.
          Ask your owner or manager to invite {session.email ? 'this email' : 'this number'} — you'll get in the moment they do.
        </p>
        <Button variant="light" onClick={onLogout} style={{ marginTop: 28 }}>
          <LogOut size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          Sign out
        </Button>
      </div>
    </main>
  )
}

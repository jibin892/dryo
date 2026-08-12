import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Phone, ShieldCheck, UserRound, X } from 'lucide-react'
import type { Invitation, Member, Role } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, Pill, ScreenHeading, SectionHeader, StatusBanner } from '../shared/ui/components'
import './team.css'

const ROLE_TONE: Record<string, 'accent' | 'positive' | 'neutral'> = {
  OWNER: 'accent',
  MANAGER: 'positive',
  OPERATOR: 'neutral',
}

export function TeamScreen({ canEditRoles }: { canEditRoles: boolean }) {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [channel, setChannel] = useState<'phone' | 'email'>('phone')
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<Role>('OPERATOR')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const [m, i] = await Promise.all([dryoApi.listMembers(), dryoApi.listInvitations()])
      setMembers(m)
      setInvites(i)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to manage your team.' : 'Could not load your team.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function sendInvite(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await dryoApi.createInvitation({ role, ...(channel === 'phone' ? { phone: contact } : { email: contact }) })
      setContact('')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invitation.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    await dryoApi.revokeInvitation(id).catch(() => undefined)
    await refresh()
  }

  const pendingInvites = invites.filter((i) => i.status === 'PENDING')

  return (
    <>
      <ScreenHeading eyebrow="People & permissions" title="Team" description="Invite staff to your curing house and set what they can do." />

      {error && <StatusBanner tone="warning">{error}</StatusBanner>}

      <div className="card">
        <p className="team-form-title">Invite someone</p>
        <div className="chip-row" style={{ padding: '10px 0' }}>
          <button type="button" className={`chip ${channel === 'phone' ? 'is-active' : ''}`} onClick={() => setChannel('phone')}>
            <Phone size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Phone
          </button>
          <button type="button" className={`chip ${channel === 'email' ? 'is-active' : ''}`} onClick={() => setChannel('email')}>
            <Mail size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Email
          </button>
        </div>
        <form onSubmit={sendInvite} className="team-invite-form">
          <input
            className="team-input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            inputMode={channel === 'phone' ? 'tel' : 'email'}
            placeholder={channel === 'phone' ? '+91 98470 12345' : 'name@example.com'}
            aria-label={channel === 'phone' ? 'Phone number' : 'Email address'}
          />
          <div className="chip-row" style={{ padding: '4px 0' }}>
            {(['MANAGER', 'OPERATOR'] as Role[]).map((r) => (
              <button key={r} type="button" className={`chip ${role === r ? 'is-active' : ''}`} onClick={() => setRole(r)}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={contact.trim().length < 4 || busy}>{busy ? 'Sending…' : 'Send invitation'}</Button>
        </form>
      </div>

      {pendingInvites.length > 0 && (
        <>
          <SectionHeader title="Pending invitations" />
          <div className="list-group">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="list-row">
                <span className="list-row-lead">{inv.phone ? <Phone size={18} /> : <Mail size={18} />}</span>
                <span className="list-row-copy">
                  <span className="list-row-title">{inv.phone || inv.email}</span>
                  <span className="list-row-subtitle">Invited as {inv.role.toLowerCase()}</span>
                </span>
                <button type="button" className="team-revoke" aria-label="Revoke invitation" onClick={() => revoke(inv.id)}>
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHeader title={`Members${members.length ? ` · ${members.length}` : ''}`} />
      <div className="list-group">
        {loading && <div className="empty-state"><p>Loading your team…</p></div>}
        {!loading && members.map((m) => (
          <div key={m.uid} className="list-row">
            <span className="list-row-lead"><UserRound size={18} /></span>
            <span className="list-row-copy">
              <span className="list-row-title">{m.displayName}</span>
              <span className="list-row-subtitle">{m.email || m.phone || '—'}{m.status !== 'ACTIVE' ? ` · ${m.status.toLowerCase()}` : ''}</span>
            </span>
            <Pill tone={ROLE_TONE[m.role] ?? 'neutral'}>{m.role.charAt(0) + m.role.slice(1).toLowerCase()}</Pill>
          </div>
        ))}
        {!loading && members.length === 0 && (
          <div className="empty-state"><ShieldCheck size={22} /><p>No members yet. Invite your first teammate above.</p></div>
        )}
      </div>

      {!canEditRoles && (
        <StatusBanner>Only the owner can change a member's role.</StatusBanner>
      )}
    </>
  )
}

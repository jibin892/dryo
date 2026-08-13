import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Phone, Plus, ShieldCheck, UserRound, X } from 'lucide-react'
import type { Invitation, Member, Role } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, Pill, ScreenHeading, SectionHeader, StatusBanner } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import './team.css'

const ROLE_TONE: Record<string, 'accent' | 'positive' | 'neutral'> = { OWNER: 'accent', MANAGER: 'positive', OPERATOR: 'neutral' }
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

export function TeamScreen({ canEditRoles }: { canEditRoles: boolean }) {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editMember, setEditMember] = useState<Member | null>(null)

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
  useEffect(() => { void refresh() }, [])

  async function sendInvite(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await dryoApi.createInvitation({ role, ...(channel === 'phone' ? { phone: contact } : { email: contact }) })
      setContact('')
      setInviteOpen(false)
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

      <div className="section-header">
        <h2>Invitations</h2>
        <button className="chip" type="button" onClick={() => setInviteOpen(true)}>
          <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Invite
        </button>
      </div>
      {pendingInvites.length > 0 ? (
        <div className="list-group">
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="list-row">
              <span className="list-row-lead">{inv.phone ? <Phone size={18} /> : <Mail size={18} />}</span>
              <span className="list-row-copy">
                <span className="list-row-title">{inv.phone || inv.email}</span>
                <span className="list-row-subtitle">Invited as {inv.role.toLowerCase()}</span>
              </span>
              <button type="button" className="team-revoke" aria-label="Revoke invitation" onClick={() => revoke(inv.id)}><X size={18} /></button>
            </div>
          ))}
        </div>
      ) : (
        <StatusBanner>No pending invitations. Tap Invite to add staff.</StatusBanner>
      )}

      <SectionHeader title={`Members${members.length ? ` · ${members.length}` : ''}`} />
      <div className="list-group">
        {loading && <div className="empty-state"><p>Loading your team…</p></div>}
        {!loading && members.map((m) => {
          const content = (
            <>
              <span className="list-row-lead"><UserRound size={18} /></span>
              <span className="list-row-copy">
                <span className="list-row-title">{m.displayName}</span>
                <span className="list-row-subtitle">{m.email || m.phone || '—'}{m.status !== 'ACTIVE' ? ` · ${m.status.toLowerCase()}` : ''}</span>
              </span>
              <Pill tone={ROLE_TONE[m.role] ?? 'neutral'}>{title(m.role)}</Pill>
            </>
          )
          return canEditRoles ? (
            <button key={m.uid} type="button" className="list-row" onClick={() => setEditMember(m)}>{content}</button>
          ) : (
            <div key={m.uid} className="list-row">{content}</div>
          )
        })}
        {!loading && members.length === 0 && (
          <div className="empty-state"><ShieldCheck size={22} /><p>No members yet. Invite your first teammate.</p></div>
        )}
      </div>

      {!canEditRoles && <StatusBanner>Only the owner can change a member's role.</StatusBanner>}

      <BottomSheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite someone">
        <div className="chip-row" style={{ padding: '2px 0 10px' }}>
          <button type="button" className={`chip ${channel === 'phone' ? 'is-active' : ''}`} onClick={() => setChannel('phone')}><Phone size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Phone</button>
          <button type="button" className={`chip ${channel === 'email' ? 'is-active' : ''}`} onClick={() => setChannel('email')}><Mail size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Email</button>
        </div>
        <form onSubmit={sendInvite} className="biz-form">
          <input className="biz-input" value={contact} onChange={(e) => setContact(e.target.value)} inputMode={channel === 'phone' ? 'tel' : 'email'} placeholder={channel === 'phone' ? '+91 98470 12345' : 'name@example.com'} autoFocus />
          <div className="chip-row" style={{ padding: '2px 0' }}>
            {(['MANAGER', 'OPERATOR'] as Role[]).map((r) => (
              <button key={r} type="button" className={`chip ${role === r ? 'is-active' : ''}`} onClick={() => setRole(r)}>{title(r)}</button>
            ))}
          </div>
          <Button type="submit" disabled={contact.trim().length < 4 || busy}>{busy ? 'Sending…' : 'Send invitation'}</Button>
        </form>
      </BottomSheet>

      <MemberEditor member={editMember} onClose={() => setEditMember(null)} onSaved={() => { setEditMember(null); void refresh() }} />
    </>
  )
}

const STATUSES = ['ACTIVE', 'DISABLED'] as const

function MemberEditor({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<Role>('OPERATOR')
  const [status, setStatus] = useState<string>('ACTIVE')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (member) {
      setRole(member.role)
      setStatus(member.status)
    }
  }, [member])

  async function save() {
    if (!member) return
    setBusy(true)
    await dryoApi.updateMember(member.uid, { role, status }).catch(() => undefined)
    setBusy(false)
    onSaved()
  }

  return (
    <BottomSheet open={!!member} onClose={onClose} title={member?.displayName ?? 'Member'}>
      {member && (
        <div className="biz-form">
          <p className="detail-sub" style={{ padding: '0 2px' }}>{member.email || member.phone || '—'}</p>
          <p className="field"><small>Role</small></p>
          <div className="chip-row" style={{ padding: '2px 0' }}>
            {(['OWNER', 'MANAGER', 'OPERATOR'] as Role[]).map((r) => (
              <button key={r} type="button" className={`chip ${role === r ? 'is-active' : ''}`} onClick={() => setRole(r)}>{title(r)}</button>
            ))}
          </div>
          <p className="field"><small>Status</small></p>
          <div className="chip-row" style={{ padding: '2px 0' }}>
            {STATUSES.map((s) => (
              <button key={s} type="button" className={`chip ${status === s ? 'is-active' : ''}`} onClick={() => setStatus(s)}>{title(s)}</button>
            ))}
          </div>
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      )}
    </BottomSheet>
  )
}

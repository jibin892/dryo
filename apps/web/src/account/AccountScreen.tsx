import { Bell, Building2, LogOut, ShieldCheck, SlidersHorizontal, Tag, Users, UserRound, Warehouse, Wheat } from 'lucide-react'
import type { Session } from '../shared/contracts'
import { canManageMembers } from '../shared/contracts'
import { promptOneSignal } from '../notifications/oneSignal'
import { Button, ListRow, Pill, ScreenHeading, SectionHeader } from '../shared/ui/components'

const ROLE_LABEL: Record<Session['role'], string> = {
  OWNER: 'Curing house owner',
  MANAGER: 'Curing house manager',
  OPERATOR: 'Drying floor operator',
}

export function AccountScreen({
  session,
  onLogout,
  onNavigate,
}: {
  session: Session
  onLogout: () => void
  onNavigate: (path: string) => void
}) {
  const contact = session.email || (session.phone ? `+91 ${session.phone}` : '—')

  return (
    <>
      <ScreenHeading eyebrow="Your profile" title="Account" />

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="list-row-lead" style={{ width: 52, height: 52 }}><UserRound aria-hidden="true" size={26} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 19 }}>{session.displayName}</p>
          <p className="detail-sub" style={{ marginTop: 2 }}>{contact}</p>
        </div>
        <Pill tone="accent">{ROLE_LABEL[session.role]}</Pill>
      </div>

      {canManageMembers(session.role) && (
        <>
          <SectionHeader title="Operations" />
          <div className="list-group">
            <ListRow
              lead={<Warehouse aria-hidden="true" size={20} />}
              title="Stock"
              subtitle="What's in store, by grade & value"
              onClick={() => onNavigate('/inventory')}
            />
          </div>

          <SectionHeader title="Management" />
          <div className="list-group">
            <ListRow
              lead={<Users aria-hidden="true" size={20} />}
              title="Team & invitations"
              subtitle="Invite staff, set roles"
              onClick={() => onNavigate('/team')}
            />
            <ListRow
              lead={<Wheat aria-hidden="true" size={20} />}
              title="Farmers & ledger"
              subtitle="Suppliers, advances, payments"
              onClick={() => onNavigate('/farmers')}
            />
            <ListRow
              lead={<Tag aria-hidden="true" size={20} />}
              title="Pricing"
              subtitle="Selling rate per grade"
              onClick={() => onNavigate('/pricing')}
            />
            <ListRow
              lead={<SlidersHorizontal aria-hidden="true" size={20} />}
              title="House settings"
              subtitle="Name, curing rate, GST"
              onClick={() => onNavigate('/settings')}
            />
          </div>
        </>
      )}

      <SectionHeader title="Workplace" />
      <div className="list-group">
        <ListRow lead={<Building2 aria-hidden="true" size={20} />} title={session.houseName} subtitle="Idukki, Kerala" />
        <ListRow lead={<ShieldCheck aria-hidden="true" size={20} />} title="Role & permissions" subtitle={ROLE_LABEL[session.role]} />
      </div>

      <SectionHeader title="Preferences" />
      <div className="list-group">
        <ListRow lead={<Bell aria-hidden="true" size={20} />} title="Push notifications" subtitle="Over-temp alerts, batches, sales" value="Enable" onClick={() => promptOneSignal()} />
      </div>

      <div className="sticky-action">
        <Button variant="danger" onClick={onLogout}>
          <LogOut size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          Sign out
        </Button>
      </div>
    </>
  )
}

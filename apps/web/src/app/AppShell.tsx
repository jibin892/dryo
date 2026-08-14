import type { ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
  Boxes,
  Flame,
  LayoutDashboard,
  Receipt,
  ScrollText,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../shared/contracts'
import { PwaStatus } from './PwaStatus'
import './shell.css'

type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
}

const managerNav: NavigationItem[] = [
  { label: 'Dashboard', path: '/today', icon: LayoutDashboard },
  { label: 'Batches', path: '/batches', icon: Boxes },
  { label: 'Chambers', path: '/chambers', icon: Flame },
  { label: 'Sales', path: '/sales', icon: Receipt },
  { label: 'Account', path: '/account', icon: UserRound },
]

const roleNavigation: Record<Role, NavigationItem[]> = {
  OWNER: managerNav,
  MANAGER: managerNav,
  OPERATOR: [
    { label: 'Today', path: '/today', icon: ScrollText },
    { label: 'Batches', path: '/batches', icon: Boxes },
    { label: 'Chambers', path: '/chambers', icon: Flame },
    { label: 'Account', path: '/account', icon: UserRound },
  ],
}

type AppShellProps = {
  role: Role
  activePath: string
  onNavigate: (path: string) => void
  children: ReactNode
  detail?: ReactNode
  title?: string
  userName?: string
  notificationCount?: number
  focusDetail?: boolean
  mobileDetail?: MobileDetailNavigation
}

export type MobileDetailNavigation = {
  title: string
  onBack: () => void
}

function NavigationItems({
  items,
  activePath,
  onNavigate,
}: {
  items: NavigationItem[]
  activePath: string
  onNavigate: (path: string) => void
}) {
  return items.map(({ label, path, icon: Icon }) => {
    const active = activePath === path || activePath.startsWith(`${path}/`)
    return (
      <button
        className="nav-item"
        type="button"
        key={path}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        onClick={() => onNavigate(path)}
      >
        <Icon aria-hidden="true" size={21} strokeWidth={active ? 2.2 : 1.7} />
        <span>{label}</span>
      </button>
    )
  })
}

export function AppShell({
  role,
  activePath,
  onNavigate,
  children,
  detail,
  title = 'Vandanmedu Curing House',
  userName = 'Dryo operator',
  notificationCount = 0,
  focusDetail = false,
  mobileDetail,
}: AppShellProps) {
  const items = roleNavigation[role]

  return (
    <div className={`app-shell ${mobileDetail ? 'has-mobile-detail' : ''}`}>
      <PwaStatus />
      {mobileDetail && (
        <header className="mobile-detail-toolbar" aria-label={mobileDetail.title}>
          <button type="button" aria-label="Back" onClick={mobileDetail.onBack}>
            <ArrowLeft aria-hidden="true" size={22} />
            <span>Back</span>
          </button>
          <strong>{mobileDetail.title}</strong>
          <span className="mobile-detail-toolbar-balance" aria-hidden="true" />
        </header>
      )}
      <nav className="navigation-rail" aria-label="Primary">
        <button className="brand-mark" type="button" aria-label="Dryo home" onClick={() => onNavigate('/today')}>
          Dry<span>o</span>
        </button>
        <div className="rail-items">
          <NavigationItems items={items} activePath={activePath} onNavigate={onNavigate} />
        </div>
      </nav>

      <div className="app-frame">
        <header className="app-header">
          <div>
            <p className="eyebrow">{title}</p>
            <p className="header-name">{userName}</p>
          </div>
          <button
            className="notification-button"
            type="button"
            aria-label={`${notificationCount} unread notifications`}
            onClick={() => onNavigate('/notifications')}
          >
            <Bell aria-hidden="true" size={22} strokeWidth={1.8} />
            {notificationCount > 0 && <span className="notification-dot">{notificationCount}</span>}
          </button>
        </header>

        <main className={`workspace ${detail ? 'has-detail' : ''} ${focusDetail ? 'focus-detail' : ''}`}>
          <section className="workspace-primary">{children}</section>
          {detail && <section className="workspace-detail">{detail}</section>}
        </main>
      </div>

      <nav className="bottom-navigation" aria-label="Primary">
        <NavigationItems items={items} activePath={activePath} onNavigate={onNavigate} />
      </nav>
    </div>
  )
}

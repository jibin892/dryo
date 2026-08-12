import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import './ui.css'

type Tone = 'neutral' | 'positive' | 'warning' | 'critical' | 'accent'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'full' | 'capsule' | 'light' | 'danger'
}

export function Button({ variant = 'full', className = '', ...props }: ButtonProps) {
  return <button className={`button button-${variant} ${className}`} type="button" {...props} />
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action}
    </div>
  )
}

export function ListRow({
  title,
  subtitle,
  value,
  lead,
  onClick,
  selected = false,
}: {
  title: string
  subtitle?: string
  value?: ReactNode
  lead?: ReactNode
  onClick?: () => void
  selected?: boolean
}) {
  const content = (
    <>
      {lead && <span className="list-row-lead">{lead}</span>}
      <span className="list-row-copy">
        <span className="list-row-title">{title}</span>
        {subtitle && <span className="list-row-subtitle">{subtitle}</span>}
      </span>
      {value && <span className="list-row-value">{value}</span>}
      {onClick && <ChevronRight className="row-chevron" aria-hidden="true" size={18} />}
    </>
  )

  if (onClick) {
    return (
      <button className={`list-row ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="list-row">{content}</div>
}

export function ScreenHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <header className="screen-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  )
}

export function StatusBanner({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className={`status-banner status-banner-${tone}`} role={tone === 'critical' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 18 }: { width?: string; height?: number }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height }} />
}

/** Weight formatter — the domain's answer to darlink's <Price>. */
export function Weight({ kg, size = 'md' }: { kg: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`metric metric-${size}`} aria-label={`${kg} kilograms`}>
      {kg.toLocaleString('en-IN')}
      <span aria-hidden="true">kg</span>
    </span>
  )
}

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = false,
}: {
  label: string
  value: string | number
  unit?: string
  icon?: LucideIcon
  accent?: boolean
}) {
  return (
    <div className={`stat-card ${accent ? 'stat-card-accent' : ''}`}>
      <span className="stat-card-head">
        {Icon && <Icon aria-hidden="true" size={15} strokeWidth={1.8} />}
        {label}
      </span>
      <span className="stat-card-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  )
}

export function Gauge({
  label,
  value,
  max,
  display,
  tone = 'neutral',
}: {
  label: string
  value: number
  max: number
  display?: string
  tone?: 'neutral' | 'positive' | 'warning' | 'critical'
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="gauge">
        <span className="gauge-label">{label}</span>
        <span className="metric metric-sm">{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tone !== 'neutral' ? `is-${tone}` : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

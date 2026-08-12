import { Bell, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { DryoNotification } from '../shared/contracts'
import { relativeTime } from '../shared/format'
import { useDryo } from '../app/store'
import { ScreenHeading } from '../shared/ui/components'
import './notifications.css'

const ICON = {
  neutral: Info,
  positive: CheckCircle2,
  warning: TriangleAlert,
  critical: TriangleAlert,
} as const

export function NotificationsScreen() {
  const notifications = useDryo((state) => state.notifications)

  return (
    <>
      <ScreenHeading eyebrow="Alerts & activity" title="Notifications" />
      <div className="list-group">
        {notifications.map((note: DryoNotification) => {
          const Icon = ICON[note.tone]
          return (
            <div key={note.id} className={`list-row notify-row notify-${note.tone}`}>
              <span className="list-row-lead"><Icon aria-hidden="true" size={20} /></span>
              <span className="list-row-copy">
                <span className="list-row-title">{note.title}</span>
                <span className="list-row-subtitle" style={{ whiteSpace: 'normal' }}>{note.body}</span>
                <span className="notify-time">{relativeTime(note.at)}</span>
              </span>
            </div>
          )
        })}
        {notifications.length === 0 && (
          <div className="empty-state"><Bell aria-hidden="true" size={26} /><p>You're all caught up.</p></div>
        )}
      </div>
    </>
  )
}

import type { BatchStage, ChamberStatus } from './contracts'

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export type Tone = 'neutral' | 'positive' | 'warning' | 'critical'

export function stageTone(stage: BatchStage): Tone {
  switch (stage) {
    case 'READY':
    case 'DISPATCHED':
      return 'positive'
    case 'GRADING':
      return 'warning'
    case 'INTAKE':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function chamberTone(status: ChamberStatus): Tone {
  switch (status) {
    case 'FAULT':
      return 'critical'
    case 'HEATING':
    case 'DRYING':
      return 'warning'
    case 'CURING':
    case 'COOLING':
      return 'positive'
    default:
      return 'neutral'
  }
}

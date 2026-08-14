import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { BottomSheet } from './BottomSheet'
import './date-picker.css'

// Local date ⇄ YYYY-MM-DD (matches the backend's plain-date storage).
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromISO(s?: string | null): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  if (!y) return undefined
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Calendar date picker (react-day-picker) styled to the Dryo design system,
 *  presented in a bottom sheet like the app's other pickers. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date…',
  clearable = true,
}: {
  value?: string | null
  onChange: (v: string) => void // '' clears
  placeholder?: string
  clearable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = fromISO(value)

  return (
    <>
      <button type="button" className="picker-trigger" onClick={() => setOpen(true)}>
        <span className="picker-lead"><CalendarDays size={18} /></span>
        <span className={`picker-label ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : placeholder}
        </span>
        <ChevronDown size={18} className="picker-chevron" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Pick a date">
        <div className="dryo-calendar">
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            showOutsideDays
            onSelect={(d) => { if (d) { onChange(toISO(d)); setOpen(false) } }}
          />
        </div>
        {clearable && value ? (
          <button type="button" className="picker-add" onClick={() => { onChange(''); setOpen(false) }}>Clear date</button>
        ) : null}
      </BottomSheet>
    </>
  )
}

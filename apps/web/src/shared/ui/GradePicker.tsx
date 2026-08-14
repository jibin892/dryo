import { useMemo, useState } from 'react'
import { ChevronDown, Search, Tag } from 'lucide-react'
import type { Grade, GradePrice } from '../contracts'
import { GRADE_LABEL } from '../contracts'
import { BottomSheet } from './BottomSheet'

const label = (g: string) => GRADE_LABEL[g as Grade] ?? g
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** Searchable grade picker. Shows each grade's sell/cost/yield reference. */
export function GradePicker({
  value,
  prices,
  onChange,
}: {
  value: Grade | ''
  prices: GradePrice[]
  onChange: (p: GradePrice | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = prices.find((p) => p.grade === value)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return prices
    return prices.filter((p) => p.grade.toLowerCase().includes(s) || label(p.grade).toLowerCase().includes(s))
  }, [prices, q])

  return (
    <>
      <button type="button" className="picker-trigger" onClick={() => setOpen(true)}>
        <span className="picker-lead"><Tag size={18} /></span>
        <span className={`picker-label ${value ? '' : 'is-placeholder'}`}>
          {selected ? label(selected.grade) : 'Expected grade (optional)…'}
        </span>
        <ChevronDown size={18} className="picker-chevron" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Select grade">
        <div className="picker-search">
          <Search size={18} />
          <input autoFocus placeholder="Search grade…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className="picker-add" onClick={() => { onChange(null); setOpen(false) }}>None — not graded</button>
        <div className="picker-list">
          {filtered.map((p) => (
            <button key={p.grade} type="button" className="picker-item" onClick={() => { onChange(p); setOpen(false) }}>
              <span className="picker-lead"><Tag size={18} /></span>
              <span className="picker-item-copy">
                <span className="picker-item-title">{label(p.grade)}</span>
                <span className="picker-item-sub">sell {inr(p.sellRatePerKg)}/kg · cost {inr(p.costRatePerKg)}/kg · {Math.round(p.yieldRatio * 100)}% yield</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="picker-empty">No grades match “{q}”.</p>}
        </div>
      </BottomSheet>
    </>
  )
}

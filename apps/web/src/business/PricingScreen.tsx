import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Tag } from 'lucide-react'
import type { Grade, GradePrice } from '../shared/contracts'
import { GRADE_LABEL } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ScreenHeading, StatusBanner } from '../shared/ui/components'
import './business.css'

const gradeLabel = (g: string) => GRADE_LABEL[g as Grade] ?? g

export function PricingScreen({ canEdit }: { canEdit: boolean }) {
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ tone: 'positive' | 'warning'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newRate, setNewRate] = useState('')

  async function refresh() {
    try {
      const p = await dryoApi.listPricing()
      setPrices(p)
      setDraft(Object.fromEntries(p.map((x) => [x.grade, String(x.sellRatePerKg)])))
    } catch (err) {
      setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to manage pricing.' : 'Could not load pricing.' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])

  const dirty = useMemo(
    () => prices.filter((p) => Number(draft[p.grade]) !== p.sellRatePerKg && draft[p.grade] !== '' && !Number.isNaN(Number(draft[p.grade]))),
    [prices, draft],
  )

  async function saveAll() {
    setSaving(true)
    setBanner(null)
    try {
      await Promise.all(dirty.map((p) => dryoApi.upsertPrice(p.grade, Number(draft[p.grade]))))
      await refresh()
      setBanner({ tone: 'positive', text: `Saved ${dirty.length} price${dirty.length > 1 ? 's' : ''}.` })
      setTimeout(() => setBanner(null), 2500)
    } catch (err) {
      // Surface the real reason so failures are diagnosable.
      const text = err instanceof ApiError
        ? (err.status === 0 ? 'Cannot reach the Dryo API — is the Go server running?' : `Save failed: ${err.message}`)
        : 'Could not save prices.'
      setBanner({ tone: 'warning', text })
    } finally {
      setSaving(false)
    }
  }

  async function addGrade(e: FormEvent) {
    e.preventDefault()
    const code = newCode.trim().toUpperCase()
    if (!code) return
    try {
      await dryoApi.upsertPrice(code, Number(newRate) || 0)
      setNewCode(''); setNewRate(''); setAdding(false)
      await refresh()
      setBanner({ tone: 'positive', text: `Added ${code}.` })
      setTimeout(() => setBanner(null), 2000)
    } catch (err) {
      setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Cannot reach the Dryo API — is the Go server running?' : 'Could not add grade.' })
    }
  }

  return (
    <>
      <ScreenHeading eyebrow="Price list" title="Pricing" description="Your selling rate per grade. New sales default to these." />
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
      {!canEdit && <StatusBanner>Only owners and managers can change prices.</StatusBanner>}

      <div className="section-header">
        <h2>Selling rate (₹ / kg)</h2>
        {canEdit && (
          <button className="chip" type="button" onClick={() => setAdding((v) => !v)}>
            <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New grade
          </button>
        )}
      </div>

      {adding && canEdit && (
        <form className="card biz-form" onSubmit={addGrade}>
          <input className="biz-input" placeholder="Grade code (e.g. AGB-1 or SPECIAL)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <input className="biz-input" placeholder="₹ / kg" value={newRate} onChange={(e) => setNewRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
          <Button type="submit" disabled={newCode.trim().length < 2}>Add grade</Button>
        </form>
      )}

      <div className="list-group">
        {loading && <div className="empty-state"><p>Loading prices…</p></div>}
        {!loading && prices.map((p) => {
          const changed = Number(draft[p.grade]) !== p.sellRatePerKg
          return (
            <div key={p.grade} className="list-row">
              <span className="list-row-lead"><Tag size={18} /></span>
              <span className="list-row-copy"><span className="list-row-title">{gradeLabel(p.grade)}</span></span>
              <input
                className="price-row-input"
                value={draft[p.grade] ?? ''}
                disabled={!canEdit}
                inputMode="decimal"
                style={changed ? { borderColor: 'var(--status-warning)' } : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, [p.grade]: e.target.value.replace(/[^\d.]/g, '') }))}
              />
            </div>
          )
        })}
      </div>

      {canEdit && (
        <div className="sticky-action">
          <Button onClick={saveAll} disabled={dirty.length === 0 || saving}>
            {saving ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}
          </Button>
        </div>
      )}
    </>
  )
}

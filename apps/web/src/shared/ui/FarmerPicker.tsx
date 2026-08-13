import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, Search, UserRound } from 'lucide-react'
import type { Farmer } from '../contracts'
import { dryoApi } from '../../api/dryo'
import { BottomSheet } from './BottomSheet'
import { Button } from './components'

/** Searchable farmer selector with inline "add new farmer". */
export function FarmerPicker({ value, onChange }: { value: Farmer | null; onChange: (f: Farmer) => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [q, setQ] = useState('')
  const [nf, setNf] = useState({ name: '', village: '', phone: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('list')
    setQ('')
    dryoApi.listFarmers().then(setFarmers).catch(() => setFarmers([]))
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return farmers
    return farmers.filter((f) => f.name.toLowerCase().includes(s) || f.village.toLowerCase().includes(s) || f.phone.includes(s))
  }, [farmers, q])

  function pick(f: Farmer) {
    onChange(f)
    setOpen(false)
  }

  async function addFarmer(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const created = await dryoApi.createFarmer(nf)
      setNf({ name: '', village: '', phone: '' })
      pick(created)
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="picker-trigger" onClick={() => setOpen(true)}>
        <span className="picker-lead"><UserRound size={18} /></span>
        <span className={`picker-label ${value ? '' : 'is-placeholder'}`}>
          {value ? `${value.name}${value.village ? ` · ${value.village}` : ''}` : 'Select farmer…'}
        </span>
        <ChevronDown size={18} className="picker-chevron" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={mode === 'list' ? 'Select farmer' : 'New farmer'}>
        {mode === 'list' ? (
          <>
            <div className="picker-search">
              <Search size={18} />
              <input autoFocus placeholder="Search name, village, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button type="button" className="picker-add" onClick={() => setMode('add')}>＋ Add new farmer</button>
            <div className="picker-list">
              {filtered.map((f) => (
                <button key={f.id} type="button" className="picker-item" onClick={() => pick(f)}>
                  <span className="picker-lead"><UserRound size={18} /></span>
                  <span className="picker-item-copy">
                    <span className="picker-item-title">{f.name}</span>
                    <span className="picker-item-sub">{f.village || '—'}{f.phone ? ` · ${f.phone}` : ''}</span>
                  </span>
                </button>
              ))}
              {filtered.length === 0 && <p className="picker-empty">No farmers match “{q}”.</p>}
            </div>
          </>
        ) : (
          <form className="biz-form" onSubmit={addFarmer}>
            <input className="biz-input" placeholder="Farmer name" value={nf.name} onChange={(e) => setNf((n) => ({ ...n, name: e.target.value }))} autoFocus />
            <div style={{ display: 'flex', gap: 12 }}>
              <input className="biz-input" placeholder="Village" value={nf.village} onChange={(e) => setNf((n) => ({ ...n, village: e.target.value }))} />
              <input className="biz-input" placeholder="Phone" value={nf.phone} onChange={(e) => setNf((n) => ({ ...n, phone: e.target.value }))} inputMode="tel" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button type="submit" disabled={nf.name.trim().length < 2 || busy}>{busy ? 'Saving…' : 'Add & select'}</Button>
              <Button type="button" variant="light" onClick={() => setMode('list')}>Back</Button>
            </div>
          </form>
        )}
      </BottomSheet>
    </>
  )
}

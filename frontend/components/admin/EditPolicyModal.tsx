// ESG Lens — Edit Policy Modal (Admin)
'use client'

import { useState } from 'react'
import { AdminPolicyRow } from '@/lib/api'
import { X, Check } from 'lucide-react'

const PILLARS = ['E', 'S', 'G']
const STATUSES = ['Proposed', 'Consultation', 'Enacted', 'Amended']
const URGENCIES = ['Low', 'Medium', 'High', 'Critical']
const JURISDICTIONS = ['India', 'EU', 'US', 'UK', 'Global', 'UN', 'APAC']
const SECTORS = ['Energy', 'Finance', 'Manufacturing', 'Real Estate', 'FMCG', 'Technology', 'Healthcare', 'Infrastructure', 'Agriculture', 'Aviation', 'Shipping', 'Chemicals']

interface Props {
  policy: AdminPolicyRow
  onClose: () => void
  onSave: (edits: Partial<AdminPolicyRow>) => void
}

export default function EditPolicyModal({ policy, onClose, onSave }: Props) {
  const [title, setTitle] = useState(policy.title)
  const [pillar, setPillar] = useState(policy.pillar || 'G')
  const [sectors, setSectors] = useState<string[]>(policy.sectors || [])
  const [status, setStatus] = useState(policy.status || 'Proposed')
  const [urgency, setUrgency] = useState(policy.urgency || 'Low')
  const [summary, setSummary] = useState(policy.summary || '')
  const [jurisdiction, setJurisdiction] = useState(policy.jurisdiction || 'Global')
  const [saving, setSaving] = useState(false)

  function toggleSector(s: string) {
    setSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ title, pillar: pillar as any, sectors, status: status as any, urgency: urgency as any, summary, jurisdiction })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" id="edit-policy-modal-overlay">
      <div className="modal" id="edit-policy-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="btn btn-ghost btn-sm" id="close-edit-modal" onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16 }}>
          <X size={16} />
        </button>

        <h2 className="modal-title" id="modal-title">Edit & Approve Policy</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-title">Title</label>
            <input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Pillar + Urgency + Status + Jurisdiction */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-pillar">ESG Pillar</label>
              <select id="edit-pillar" value={pillar} onChange={e => setPillar(e.target.value as any)}>
                {PILLARS.map(p => <option key={p} value={p}>{p === 'E' ? 'E — Environmental' : p === 'S' ? 'S — Social' : 'G — Governance'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-urgency">Urgency</label>
              <select id="edit-urgency" value={urgency} onChange={e => setUrgency(e.target.value as any)}>
                {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-status">Status</label>
              <select id="edit-status" value={status} onChange={e => setStatus(e.target.value as any)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-jurisdiction">Jurisdiction</label>
              <select id="edit-jurisdiction" value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
                {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-summary">Summary (3 sentences for CSO audience)</label>
            <textarea id="edit-summary" value={summary} onChange={e => setSummary(e.target.value)}
              rows={4} style={{ resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {/* Sectors */}
          <div className="form-group">
            <label className="form-label">Sectors</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SECTORS.map(s => (
                <button key={s} id={`edit-sector-${s}`} type="button"
                  onClick={() => toggleSector(s)}
                  className={`filter-chip ${sectors.includes(s) ? 'active' : ''}`}
                  style={{ gap: 4 }}>
                  {sectors.includes(s) && <Check size={11} />}{s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
            <button id="save-edit-approve-btn" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : <><Check size={14} /> Approve with Edits</>}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

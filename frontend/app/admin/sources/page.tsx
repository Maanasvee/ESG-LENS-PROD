// ESG Lens — Admin Source Management Page
'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api, Source } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Plus, Radio, Globe, RefreshCw, Check, X, Edit, Trash2, ExternalLink, Wifi, WifiOff } from 'lucide-react'

const JURISDICTIONS = ['India', 'EU', 'US', 'UK', 'Global', 'UN', 'APAC']
const PILLAR_HINTS = ['E', 'S', 'G']

const defaultForm: Omit<Source, 'id' | 'last_checked_at'> = {
  name: '',
  url: '',
  source_type: 'news',
  fetch_strategy: 'rss',
  frequency_minutes: 30,
  is_active: true,
  selector: '',
  jurisdiction: 'Global',
  pillar_hint: null,
}

export default function SourcesPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<typeof defaultForm>(defaultForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/')
  }, [isAdmin, authLoading])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setSources(await api.getSources())
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load regulatory sources. Please verify backend connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      if (editId !== null) {
        await api.updateSource(editId, form)
        showToast('Source updated ✓')
      } else {
        await api.createSource(form)
        showToast('Source added ✓')
      }
      setShowForm(false); setEditId(null); setForm(defaultForm)
      await load()
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally { setSaving(false) }
  }

  async function handleToggle(src: Source) {
    setToggling(prev => new Set(prev).add(src.id))
    try {
      await api.updateSource(src.id, { is_active: !src.is_active })
      setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_active: !s.is_active } : s))
    } catch (e) { showToast('Toggle failed', 'error') }
    finally { setToggling(prev => { const s = new Set(prev); s.delete(src.id); return s }) }
  }

  function startEdit(src: Source) {
    setForm({ name: src.name, url: src.url, source_type: src.source_type || 'news', fetch_strategy: src.fetch_strategy, frequency_minutes: src.frequency_minutes, is_active: src.is_active, selector: src.selector || '', jurisdiction: src.jurisdiction || 'Global', pillar_hint: src.pillar_hint })
    setEditId(src.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const rssSources = sources.filter(s => s.fetch_strategy === 'rss')
  const pwSources = sources.filter(s => s.fetch_strategy === 'playwright')

  return (
    <DashboardLayout>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Regulatory Source Management</h1>
          <p className="page-subtitle">{sources.length} total sources · {sources.filter(s => s.is_active).length} active</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="refresh-sources-btn" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button id="add-source-btn" className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm) }}>
            <Plus size={14} /> Add Source
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', border: '1px solid rgba(220,38,38,0.2)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'inline-flex', width: 44, height: 44, background: 'var(--color-critical-bg)', borderRadius: 'var(--radius-md)', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-critical)" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Unable to Load Sources</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 460, margin: '0 auto var(--space-4)', lineHeight: 1.6 }}>
            {error}
          </p>
          <button type="button" className="btn btn-secondary" onClick={load} style={{ gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            Retry Loading
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
              {editId !== null ? 'Edit Source' : 'Add New Source'}
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditId(null) }}><X size={16} /></button>
          </div>

          <form id="source-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="src-name">Source Name</label>
              <input id="src-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. SEBI — Securities and Exchange Board of India" required />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="src-url">URL</label>
              <input id="src-url" type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="src-strategy">Fetch Strategy</label>
              <select id="src-strategy" value={form.fetch_strategy} onChange={e => setForm({ ...form, fetch_strategy: e.target.value as any })}>
                <option value="rss">RSS Feed</option>
                <option value="playwright">Playwright (JS Portal)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="src-frequency">Poll Frequency (minutes)</label>
              <input id="src-frequency" type="number" min={10} max={1440} value={form.frequency_minutes}
                onChange={e => setForm({ ...form, frequency_minutes: parseInt(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="src-jurisdiction">Jurisdiction</label>
              <select id="src-jurisdiction" value={form.jurisdiction || ''} onChange={e => setForm({ ...form, jurisdiction: e.target.value })}>
                {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="src-pillar">Pillar Hint</label>
              <select id="src-pillar" value={form.pillar_hint || ''} onChange={e => setForm({ ...form, pillar_hint: e.target.value || null })}>
                <option value="">Auto-detect</option>
                {PILLAR_HINTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {form.fetch_strategy === 'playwright' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="src-selector">CSS Selector (Playwright)</label>
                <input id="src-selector" value={form.selector || ''} onChange={e => setForm({ ...form, selector: e.target.value })} placeholder="e.g. table.style-a td a, .content-area li a" />
              </div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
              <button id="save-source-btn" type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : <><Check size={14} /> {editId !== null ? 'Update Source' : 'Add Source'}</>}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Playwright Sources */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={14} /> India Portals (Playwright) · {pwSources.length}
        </h2>
        <SourceTable sources={pwSources} loading={loading} toggling={toggling} onToggle={handleToggle} onEdit={startEdit} />
      </div>

      {/* RSS Sources */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio size={14} /> RSS Feeds · {rssSources.length}
        </h2>
        <SourceTable sources={rssSources} loading={loading} toggling={toggling} onToggle={handleToggle} onEdit={startEdit} />
      </div>

      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <X size={16} />} {toast.msg}
        </div>
      )}
    </DashboardLayout>
  )
}

function SourceTable({ sources, loading, toggling, onToggle, onEdit }: {
  sources: Source[]; loading: boolean; toggling: Set<number>
  onToggle: (s: Source) => void; onEdit: (s: Source) => void
}) {
  if (loading) return <div className="skeleton" style={{ height: 120 }} />
  if (sources.length === 0) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>No sources in this category.</p>

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Status</th><th>Name</th><th>Jurisdiction</th><th>Pillar</th>
            <th>Frequency</th><th>Last Checked</th><th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(src => (
            <tr key={src.id} id={`source-row-${src.id}`} style={{ opacity: src.is_active ? 1 : 0.5 }}>
              <td>
                <button id={`toggle-source-${src.id}`} onClick={() => onToggle(src)}
                  disabled={toggling.has(src.id)}
                  title={src.is_active ? 'Deactivate' : 'Activate'}
                  className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
                  {toggling.has(src.id)
                    ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    : src.is_active
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                      : <WifiOff size={14} style={{ color: 'var(--color-text-muted)' }} />}
                </button>
              </td>
              <td>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{src.name}</div>
                <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
                  <ExternalLink size={10} /> {src.url.slice(0, 50)}{src.url.length > 50 ? '…' : ''}
                </a>
              </td>
              <td style={{ fontSize: 12 }}>{src.jurisdiction || '—'}</td>
              <td>{src.pillar_hint ? <span className={`badge badge-${src.pillar_hint}`}>{src.pillar_hint === 'E' ? 'Environmental' : src.pillar_hint === 'S' ? 'Social' : 'Governance'}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Auto</span>}</td>
              <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Every {src.frequency_minutes}m</td>
              <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {src.last_checked_at ? new Date(src.last_checked_at).toLocaleDateString() : 'Never'}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button id={`edit-source-${src.id}`} className="btn btn-secondary btn-sm" onClick={() => onEdit(src)} title="Edit">
                    <Edit size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

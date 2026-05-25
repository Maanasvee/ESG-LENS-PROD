// ESG Lens — Admin Moderation Queue Page
'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api, AdminPolicyRow } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Check, X, Edit, ChevronDown, ChevronUp, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import EditPolicyModal from '@/components/admin/EditPolicyModal'

export default function AdminQueuePage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [policies, setPolicies] = useState<AdminPolicyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState<Set<number>>(new Set())
  const [editTarget, setEditTarget] = useState<AdminPolicyRow | null>(null)
  const [rejecting, setRejecting] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/')
  }, [isAdmin, authLoading])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getModerationQueue()
      setPolicies(data)
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load editorial moderation queue. Please verify backend connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleApprove(id: number) {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await api.moderatePolicy(id, { action: 'approve' })
      setPolicies(prev => prev.filter(p => p.id !== id))
      showToast('Policy approved and published ✓')
    } catch (e: any) {
      showToast(e.message || 'Approve failed', 'error')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleReject(id: number) {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await api.moderatePolicy(id, { action: 'reject', rejection_note: rejectNote })
      setPolicies(prev => prev.filter(p => p.id !== id))
      setRejecting(null); setRejectNote('')
      showToast('Policy rejected')
    } catch (e: any) {
      showToast(e.message || 'Reject failed', 'error')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleEditApprove(id: number, edits: Partial<AdminPolicyRow>) {
    setProcessing(prev => new Set(prev).add(id))
    try {
      await api.moderatePolicy(id, { action: 'edit_approve', ...edits as any })
      setPolicies(prev => prev.filter(p => p.id !== id))
      setEditTarget(null)
      showToast('Policy edited and approved ✓')
    } catch (e: any) {
      showToast(e.message || 'Edit approve failed', 'error')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  if (authLoading) return null

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Editorial Review Queue</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${policies.length} policies pending review`}
          </p>
        </div>
        <button id="refresh-queue-btn" className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Table */}
      {error ? (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', border: '1px solid rgba(220,38,38,0.2)' }}>
          <div style={{ display: 'inline-flex', width: 44, height: 44, background: 'var(--color-critical-bg)', borderRadius: 'var(--radius-md)', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-critical)" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Unable to Load Moderation Queue</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 460, margin: '0 auto var(--space-4)', lineHeight: 1.6 }}>
            {error}
          </p>
          <button type="button" className="btn btn-secondary" onClick={load} style={{ gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            Retry Loading
          </button>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
      ) : policies.length === 0 ? (
        <div className="empty-state">
          <Check size={48} style={{ color: 'var(--color-border)', marginBottom: 16 }} />
          <h3>Queue is clear!</h3>
          <p>All policies have been reviewed. Run the pipeline to fetch new ones.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table" id="moderation-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Pillar</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Jurisdiction</th>
                <th>Added</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(policy => (
                <>
                  <tr key={policy.id} id={`policy-row-${policy.id}`} className="moderation-row">
                    <td style={{ maxWidth: 280 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(policy.id)}
                        style={{ marginRight: 6, padding: 4, height: 'auto' }}>
                        {expanded.has(policy.id) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{policy.title.slice(0, 80)}{policy.title.length > 80 ? '…' : ''}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{policy.source_name || '—'}</td>
                    <td>
                      {policy.pillar && <span className={`badge badge-${policy.pillar}`}>{policy.pillar === 'E' ? 'Environmental' : policy.pillar === 'S' ? 'Social' : 'Governance'}</span>}
                    </td>
                    <td>
                      {policy.urgency && <span className={`badge badge-${policy.urgency}`}>{policy.urgency}</span>}
                    </td>
                    <td>
                      {policy.status && <span className={`badge badge-${policy.status}`}>{policy.status}</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{policy.jurisdiction || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDistanceToNow(new Date(policy.created_at), { addSuffix: true })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button id={`approve-${policy.id}`} className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(policy.id)}
                          disabled={processing.has(policy.id)} title="Approve">
                          <Check size={13} />
                        </button>
                        <button id={`edit-approve-${policy.id}`} className="btn btn-secondary btn-sm"
                          onClick={() => setEditTarget(policy)}
                          disabled={processing.has(policy.id)} title="Edit & Approve">
                          <Edit size={13} />
                        </button>
                        <button id={`reject-${policy.id}`} className="btn btn-danger btn-sm"
                          onClick={() => setRejecting(policy.id)}
                          disabled={processing.has(policy.id)} title="Reject">
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded details */}
                  {expanded.has(policy.id) && (
                    <tr key={`${policy.id}-expand`}>
                      <td colSpan={8} className="moderation-expand-panel">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 6 }}>AI-Generated Summary</p>
                            <p style={{ lineHeight: 1.6 }}>{policy.summary || 'No summary generated.'}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 6 }}>Raw Text Excerpt</p>
                            <p style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', lineHeight: 1.5 }}>
                              {policy.raw_text_excerpt || '—'}
                            </p>
                          </div>
                        </div>
                        <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sectors: {policy.sectors.join(', ') || '—'}</span>
                          <a href={policy.source_url} target="_blank" rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                            <ExternalLink size={12} /> Original Source
                          </a>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Reject form inline */}
                  {rejecting === policy.id && (
                    <tr key={`${policy.id}-reject`}>
                      <td colSpan={8} style={{ background: 'rgba(239,68,68,0.05)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                          <AlertTriangle size={14} style={{ color: 'var(--color-critical)', flexShrink: 0 }} />
                          <input placeholder="Rejection reason (optional)…" value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            className="form-input" style={{ flex: 1 }} id={`reject-note-${policy.id}`} />
                          <button id={`confirm-reject-${policy.id}`} className="btn btn-danger btn-sm"
                            onClick={() => handleReject(policy.id)}>
                            Confirm Reject
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditPolicyModal
          policy={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(edits) => handleEditApprove(editTarget.id, edits)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {toast.msg}
        </div>
      )}
    </DashboardLayout>
  )
}

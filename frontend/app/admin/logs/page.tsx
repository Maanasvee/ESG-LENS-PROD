// ESG Lens — Admin Pipeline Logs Page
'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api, PipelineRun } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Activity, RefreshCw, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

export default function LogsPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<PipelineRun[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/')
  }, [isAdmin, authLoading])

  async function load() {
    setLoading(true)
    try { setLogs(await api.getPipelineLogs()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const lastRun = logs[0]
  const totalProcessed = logs.reduce((sum, r) => sum + r.items_after_dedup, 0)
  const totalLLM = logs.reduce((sum, r) => sum + r.llm_calls_made, 0)
  const hasErrors = logs.some(r => r.errors.length > 0)

  return (
    <DashboardLayout>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Pipeline Logs</h1>
          <p className="page-subtitle">Last {logs.length} pipeline runs</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label id="auto-refresh-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button id="refresh-logs-btn" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-value">{logs.length}</div>
          <div className="stat-label">Runs (last 20)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-blue)' }}>{totalProcessed}</div>
          <div className="stat-label">Items Processed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-medium)' }}>{totalLLM}</div>
          <div className="stat-label">LLM Calls</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: hasErrors ? 'var(--color-critical)' : 'var(--color-accent)' }}>
            {hasErrors ? '⚠️' : '✓'}
          </div>
          <div className="stat-label">Health</div>
        </div>
      </div>

      {/* Last run summary */}
      {lastRun && (
        <div className="card" style={{ marginBottom: 'var(--space-5)', borderColor: lastRun.errors.length > 0 ? 'rgba(239,68,68,0.3)' : 'var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <Activity size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Latest Run — {formatDistanceToNow(new Date(lastRun.triggered_at), { addSuffix: true })}
            </h2>
            {lastRun.completed_at
              ? <span className="badge badge-urgency-Low"><CheckCircle size={11} /> Completed</span>
              : <span className="badge badge-status-Proposed">🔄 Running</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)', fontSize: 13 }}>
            {[
              { label: 'Fetched', value: lastRun.items_fetched },
              { label: 'After Dedup', value: lastRun.items_after_dedup },
              { label: 'LLM Calls', value: lastRun.llm_calls_made },
              { label: 'Duration', value: lastRun.duration_seconds ? `${lastRun.duration_seconds.toFixed(0)}s` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table" id="pipeline-logs-table">
            <thead>
              <tr>
                <th>#</th><th>Triggered</th><th>Fetched</th><th>New</th>
                <th>LLM Calls</th><th>Duration</th><th>Status</th><th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(run => (
                <tr key={run.id} id={`run-${run.id}`}
                  style={{ background: run.errors.length > 0 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>#{run.id}</td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{format(new Date(run.triggered_at), 'MMM d, HH:mm')}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{formatDistanceToNow(new Date(run.triggered_at), { addSuffix: true })}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{run.items_fetched}</td>
                  <td style={{ fontWeight: 700, color: run.items_after_dedup > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                    {run.items_after_dedup}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{run.llm_calls_made}</td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {run.duration_seconds ? `${run.duration_seconds.toFixed(0)}s` : '—'}
                  </td>
                  <td>
                    {run.completed_at
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)', fontSize: 12 }}><CheckCircle size={12} /> Done</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-medium)', fontSize: 12 }}><Clock size={12} /> Running</span>}
                  </td>
                  <td>
                    {run.errors.length > 0 ? (
                      <div title={run.errors.join('\n')} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-critical)', fontSize: 12, cursor: 'help' }}>
                        <XCircle size={12} /> {run.errors.length} error{run.errors.length > 1 ? 's' : ''}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  )
}

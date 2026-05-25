'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { api, Policy, PolicyFilters, TrackerMeta } from '@/lib/api'
import { ExternalLink, Search, CheckCircle2 } from 'lucide-react'
import './tracker.css'

type SortMode = 'latest' | 'alphabetical' | 'relevance' | 'urgency'

const PILLAR_LABELS: Record<string, string> = {
  E: 'Environmental',
  S: 'Social',
  G: 'Governance',
}

function PillarBadge({ pillar }: { pillar: string | null }) {
  if (!pillar) return null
  return (
    <span className={`badge badge-${pillar}`} title={PILLAR_LABELS[pillar] || pillar}>
      {PILLAR_LABELS[pillar] || pillar}
    </span>
  )
}

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency) return null
  return <span className={`badge badge-${urgency}`}>{urgency}</span>
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <span className={`badge badge-${status}`}>{status}</span>
}

function formatDate(d: string | null) {
  if (!d) return '—'
  try { return format(new Date(d), 'd MMM yyyy') } catch { return '—' }
}

export default function PolicyTrackerPage() {
  const [meta, setMeta] = useState<TrackerMeta | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [titleOnly, setTitleOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('latest')
  const [filters, setFilters] = useState<PolicyFilters>({})

  const loadMeta = useCallback(async () => {
    try {
      const data = await api.getTrackerMeta()
      setMeta(data)
    } catch (e: any) {
      console.error('Failed to load metadata:', e)
      // We don't block the whole page for metadata, but log it
    }
  }, [])

  const loadPolicies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getPolicies({
        ...filters,
        q: query || undefined,
        title_only: titleOnly,
        sort,
        page: 1,
        page_size: 50,
      })
      setPolicies(res.items)
      setTotal(res.total)
    } catch (e: any) {
      console.error('Failed to load policies:', e)
      setError(e.message || 'Unable to connect to the ESG Lens Intelligence API. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [filters, query, titleOnly, sort])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadPolicies() }, [loadPolicies])

  function toggleFilter(key: keyof PolicyFilters, value: string) {
    setFilters(prev => {
      const next = { ...prev }
      if ((next as Record<string, string | undefined>)[key] === value) {
        delete (next as Record<string, string | undefined>)[key]
      } else {
        (next as Record<string, string | undefined>)[key] = value
      }
      return next
    })
  }

  const activeFilterCount = Object.keys(filters).filter(k => k !== 'sort').length

  return (
    <div style={{ margin: 'calc(-1 * var(--space-6))', minHeight: 'calc(100vh - var(--topbar-height))' }}>
      {/* Page Header */}
      <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Policy Intelligence Feed</h1>
          <p className="page-subtitle">
            {meta?.active_source_count
              ? `Monitoring ${meta.active_source_count} active regulatory sources — AI-classified and editorially verified`
              : 'Global ESG regulatory intelligence — classified and verified'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setFilters({})}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {loading ? 'Loading…' : `${total.toLocaleString()} result${total !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div className="tracker-layout">
        {/* ── Filter Panel ────────────────────────────────────── */}
        <aside className="tracker-filters">
          <form
            className="tracker-search-form"
            onSubmit={e => { e.preventDefault(); loadPolicies() }}
          >
            <input
              type="search"
              className="tracker-search-input"
              placeholder="Search regulatory intelligence…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search policies"
            />
            <button type="submit" className="tracker-search-btn">
              <Search size={14} />
            </button>
          </form>

          <label className="tracker-title-only">
            <input
              type="checkbox"
              checked={titleOnly}
              onChange={e => setTitleOnly(e.target.checked)}
            />
            Match title only
          </label>

          {/* ESG Pillar Filter */}
          <details className="tracker-filter-section" open>
            <summary className="tracker-filter-heading">
              ESG Pillar
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div className="tracker-filter-list">
              {meta?.applicability?.map(a => (
                <label key={a.value} className="tracker-filter-option">
                  <input
                    type="checkbox"
                    checked={filters.pillar === a.value}
                    onChange={() => toggleFilter('pillar', a.value)}
                  />
                  {a.label}
                </label>
              )) ?? (
                ['Environmental', 'Social', 'Governance'].map((label, i) => (
                  <label key={label} className="tracker-filter-option">
                    <input type="checkbox" disabled />
                    {label}
                  </label>
                ))
              )}
            </div>
          </details>

          {/* Sector Filter */}
          {meta?.sectors && meta.sectors.length > 0 && (
            <details className="tracker-filter-section" open>
              <summary className="tracker-filter-heading">
                Industry Sector
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </summary>
              <div className="tracker-filter-list">
                {meta.sectors.map(s => (
                  <label key={s} className="tracker-filter-option">
                    <input
                      type="checkbox"
                      checked={filters.sector === s}
                      onChange={() => toggleFilter('sector', s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </details>
          )}

          {/* Jurisdiction Filter */}
          {meta?.jurisdictions && meta.jurisdictions.length > 0 && (
            <details className="tracker-filter-section" open>
              <summary className="tracker-filter-heading">
                Region / Jurisdiction
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </summary>
              <div className="tracker-filter-list">
                {meta.jurisdictions.map(j => (
                  <label key={j} className="tracker-filter-option">
                    <input
                      type="checkbox"
                      checked={filters.jurisdiction === j}
                      onChange={() => toggleFilter('jurisdiction', j)}
                    />
                    {j}
                  </label>
                ))}
              </div>
            </details>
          )}

          {/* Regulatory Status */}
          {meta?.regulatory_statuses && meta.regulatory_statuses.length > 0 && (
            <details className="tracker-filter-section">
              <summary className="tracker-filter-heading">
                Regulatory Status
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </summary>
              <div className="tracker-filter-list">
                {meta.regulatory_statuses.map(st => (
                  <label key={st} className="tracker-filter-option">
                    <input
                      type="checkbox"
                      checked={filters.status === st}
                      onChange={() => toggleFilter('status', st)}
                    />
                    {st}
                  </label>
                ))}
              </div>
            </details>
          )}

          {/* Obligation Type */}
          {meta?.obligations && meta.obligations.length > 0 && (
            <details className="tracker-filter-section">
              <summary className="tracker-filter-heading">
                Compliance Obligation
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </summary>
              <div className="tracker-filter-list">
                {meta.obligations.map(o => (
                  <label key={o} className="tracker-filter-option">
                    <input
                      type="checkbox"
                      checked={filters.obligation === o}
                      onChange={() => toggleFilter('obligation', o)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </details>
          )}

          {/* Source Filter */}
          {meta?.sources && meta.sources.length > 0 && (
            <details className="tracker-filter-section">
              <summary className="tracker-filter-heading">
                Regulatory Body
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </summary>
              <div className="tracker-filter-list">
                {meta.sources.map(s => (
                  <label key={s.id} className="tracker-filter-option">
                    <input
                      type="checkbox"
                      checked={filters.source_id === s.id}
                      onChange={() => {
                        setFilters(prev => {
                          const next = { ...prev }
                          if (next.source_id === s.id) delete next.source_id
                          else next.source_id = s.id
                          return next
                        })
                      }}
                    />
                    {s.name}{!s.is_active && <span style={{ color: 'var(--color-text-muted)' }}> (paused)</span>}
                  </label>
                ))}
              </div>
            </details>
          )}

          <div className="tracker-source-note">
            Monitoring <strong>{meta?.active_source_count ?? '—'}</strong> active regulatory sources
            including SEBI, MoEFCC, RBI, EU Taxonomy, BRSR, and more.
          </div>
        </aside>

        {/* ── Results ─────────────────────────────────────────── */}
        <main className="tracker-results">
          {/* Sort Bar */}
          <div className="tracker-results-bar">
            <div>
              <div className="tracker-results-count">
                {loading ? 'Loading intelligence…' : `${total.toLocaleString()} ${total === 1 ? 'Policy' : 'Policies'}`}
              </div>
              {activeFilterCount > 0 && (
                <div className="tracker-results-sub">
                  {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied
                </div>
              )}
            </div>
            <div className="tracker-sort-bar">
              <span className="tracker-sort-label">Sort:</span>
              {(['latest', 'urgency', 'alphabetical', 'relevance'] as SortMode[]).map(s => (
                <button
                  key={s}
                  type="button"
                  className={`tracker-sort-btn ${sort === s ? 'active' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'latest' ? 'Latest' : s === 'alphabetical' ? 'A–Z' : s === 'urgency' ? 'Urgency' : 'Relevance'}
                </button>
              ))}
            </div>
          </div>

          {/* Policy List */}
          {error ? (
            <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', border: '1px solid rgba(220,38,38,0.2)' }}>
              <div style={{ display: 'inline-flex', width: 44, height: 44, background: 'var(--color-critical-bg)', borderRadius: 'var(--radius-md)', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-critical)" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>API Connection Offline</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 460, margin: '0 auto var(--space-4)', lineHeight: 1.6 }}>
                {error}
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => { loadMeta(); loadPolicies(); }} style={{ gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Retry Request
              </button>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="policy-row">
                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div className="skeleton" style={{ width: 80, height: 20 }} />
                    <div className="skeleton" style={{ width: 60, height: 20 }} />
                  </div>
                  <div className="skeleton" style={{ height: 22, width: '70%', marginBottom: 'var(--space-2)' }} />
                  <div className="skeleton" style={{ height: 16, width: '90%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 16, width: '75%' }} />
                </div>
              ))}
            </div>
          ) : policies.length === 0 ? (
            <div className="tracker-empty">
              <div className="tracker-empty-icon">
                <Search size={22} color="var(--color-text-muted)" />
              </div>
              <div className="tracker-empty-title">No policies match your criteria</div>
              <div className="tracker-empty-body">
                Try adjusting your search terms or filters. New regulatory intelligence enters
                as <strong>pending editorial review</strong> before being published.
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilters({})}
                  style={{ marginTop: 'var(--space-4)' }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            policies.map(p => (
              <article key={p.id} className="policy-row">
                <div className="policy-row-top">
                  <div className="policy-badges">
                    <PillarBadge pillar={p.pillar} />
                    <UrgencyBadge urgency={p.urgency} />
                    <StatusBadge status={p.status} />
                  </div>
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    title="View source document"
                    style={{ flexShrink: 0 }}
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>

                <div className="policy-title">
                  <a href={p.source_url} target="_blank" rel="noopener noreferrer">
                    {p.title}
                  </a>
                </div>

                {p.summary && <p className="policy-summary">{p.summary}</p>}

                <div className="policy-meta-row">
                  <div className="policy-meta-item">
                    <span className="policy-meta-label">Provision Type</span>
                    <span className="policy-meta-value">{(p as any).provision_subtype || 'Regulation'}</span>
                  </div>
                  <div className="policy-meta-item">
                    <span className="policy-meta-label">Latest Update</span>
                    <span className="policy-meta-value">
                      {formatDate((p as any).latest_update || p.published_date || p.created_at)}
                    </span>
                  </div>
                  <div className="policy-meta-item">
                    <span className="policy-meta-label">Obligation</span>
                    <span className="policy-meta-value">{(p as any).obligation || 'Voluntary'}</span>
                  </div>
                  <div className="policy-meta-item">
                    <span className="policy-meta-label">Issuing Authority</span>
                    <span className="policy-meta-value">{p.source_name || '—'}</span>
                  </div>
                  <div className="policy-meta-item">
                    <span className="policy-meta-label">Region</span>
                    <span className="policy-meta-value">{p.jurisdiction || 'Global'}</span>
                  </div>
                  {p.sectors && p.sectors.length > 0 && (
                    <div className="policy-meta-item">
                      <span className="policy-meta-label">Industry Impact</span>
                      <span className="policy-meta-value">{p.sectors.join(', ')}</span>
                    </div>
                  )}
                  <div className="policy-meta-item" style={{ marginLeft: 'auto' }}>
                    <div className="policy-verified-tag">
                      <CheckCircle2 size={12} />
                      AI-Verified Intelligence
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </main>
      </div>
    </div>
  )
}

// ESG Lens — Main Policy Feed Page (User Dashboard)
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PolicyCard from '@/components/ui/PolicyCard'
import { api, Policy, PolicyFilters } from '@/lib/api'
import { Filter, SortDesc, Zap } from 'lucide-react'

const PILLARS = [
  { value: 'E', label: '🌿 Environmental' },
  { value: 'S', label: '🤝 Social' },
  { value: 'G', label: '⚖️ Governance' },
]

const URGENCIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Proposed', 'Consultation', 'Enacted', 'Amended']

const JURISDICTIONS = ['India', 'EU', 'US', 'UK', 'Global', 'UN', 'APAC']

export default function PolicyFeedPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasNext, setHasNext] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<PolicyFilters>({ sort: 'recent' })

  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadPolicies = useCallback(async (f: PolicyFilters, p: number, replace = false) => {
    if (replace) setLoading(true); else setLoadingMore(true)
    try {
      const res = await api.getPolicies({ ...f, page: p, page_size: 20 })
      setPolicies(prev => replace ? res.items : [...prev, ...res.items])
      setHasNext(res.has_next)
      setTotal(res.total)
      setPage(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    loadPolicies(filters, 1, true)
  }, [filters])

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNext && !loadingMore) {
        loadPolicies(filters, page + 1)
      }
    }, { rootMargin: '200px' })
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasNext, loadingMore, page, filters])

  function setFilter(key: keyof PolicyFilters, value: string | undefined) {
    setFilters(prev => {
      const next = { ...prev } as any
      if (next[key] === value) delete next[key]
      else next[key] = value
      return next
    })
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Policy Feed</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${total.toLocaleString()} verified ESG policies`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="sort-recent" onClick={() => setFilter('sort', 'recent')}
            className={`btn btn-sm ${filters.sort !== 'urgency' ? 'btn-primary' : 'btn-secondary'}`}>
            <SortDesc size={13} /> Most Recent
          </button>
          <button id="sort-urgency" onClick={() => setFilter('sort', 'urgency')}
            className={`btn btn-sm ${filters.sort === 'urgency' ? 'btn-primary' : 'btn-secondary'}`}>
            <Zap size={13} /> Highest Urgency
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" id="policy-filter-bar">
        {/* Pillar chips */}
        {PILLARS.map(p => (
          <button key={p.value} id={`filter-pillar-${p.value}`}
            className={`filter-chip ${filters.pillar === p.value ? 'active' : ''}`}
            onClick={() => setFilter('pillar', p.value)}>
            {p.label}
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

        {/* Jurisdiction dropdown */}
        <select id="filter-jurisdiction" className="filter-select"
          value={filters.jurisdiction || ''}
          onChange={e => setFilter('jurisdiction', e.target.value || undefined)}>
          <option value="">All Jurisdictions</option>
          {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
        </select>

        {/* Urgency chips */}
        {URGENCIES.map(u => (
          <button key={u} id={`filter-urgency-${u}`}
            className={`filter-chip ${filters.urgency === u ? 'active' : ''}`}
            onClick={() => setFilter('urgency', u)}>
            {u}
          </button>
        ))}

        {/* Status dropdown */}
        <select id="filter-status" className="filter-select"
          value={filters.status || ''}
          onChange={e => setFilter('status', e.target.value || undefined)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Clear filters */}
        {Object.keys(filters).length > 1 && (
          <button id="clear-filters" className="btn btn-ghost btn-sm"
            onClick={() => setFilters({ sort: 'recent' })}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Policy Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="empty-state">
          <Filter size={48} style={{ color: 'var(--color-border)', marginBottom: 16 }} />
          <h3>No policies found</h3>
          <p>Try adjusting your filters or check back after the next pipeline run.</p>
        </div>
      ) : (
        <div id="policy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {policies.map((policy, idx) => (
            <div key={policy.id} style={{
              animation: `fadeInUp 400ms ease both`,
              animationDelay: `${Math.min(idx % 20, 8) * 40}ms`,
            }}>
              <style>{`
                @keyframes fadeInUp {
                  from { opacity: 0; transform: translateY(16px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <PolicyCard policy={policy} />
            </div>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div className="spinner" />
        </div>
      )}
    </DashboardLayout>
  )
}

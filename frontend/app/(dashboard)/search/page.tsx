// ESG Lens — Semantic Search Page
'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api, SearchResult } from '@/lib/api'
import { Search, ExternalLink } from 'lucide-react'

const EXAMPLE_QUERIES = [
  'Scope 3 reporting rules in India',
  'Carbon credit trading scheme regulations',
  'BRSR mandatory disclosure requirements',
  'EU taxonomy sustainable finance',
  'RBI green bond guidelines',
]

const PILLAR_COLOURS: Record<string, string> = {
  E: 'var(--color-pillar-e)',
  S: 'var(--color-pillar-s)',
  G: 'var(--color-pillar-g)',
}

function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true); setError('')
    try {
      const res = await api.search(q)
      setResults(res)
      setSearched(true)
    } catch (e: any) {
      setError(e.message || 'Search failed')
    } finally { setLoading(false) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(query)
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div className="page-header" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{
              width: 56, height: 56, background: 'var(--color-primary-light)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Search size={24} style={{ color: 'var(--color-primary)' }} />
            </div>
          </div>
          <h1 className="page-title">Regulatory Intelligence Search</h1>
          <p className="page-subtitle" style={{ fontSize: 15 }}>
            Ask a question in plain English — search across all verified ESG regulatory policies.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSubmit} style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input
              id="semantic-search-input"
              type="text"
              placeholder="e.g. Scope 3 reporting rules in India…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingRight: 100, fontSize: 16 }}
            />
          </div>
          <button type="submit" id="semantic-search-btn" className="btn btn-primary"
            disabled={loading || !query.trim()}
            style={{ position: 'absolute', right: 6, top: 6, bottom: 6 }}>
            {loading ? <span className="spinner" /> : 'Search'}
          </button>
        </form>

        {/* Example queries */}
        {!searched && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Try these examples
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EXAMPLE_QUERIES.map(q => (
                <button key={q} id={`example-query-${q.replace(/\s+/g, '-').slice(0, 20)}`}
                  className="filter-chip"
                  onClick={() => { setQuery(q); doSearch(q) }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-critical-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-critical)', fontSize: 14, marginTop: 16 }}>
            {error}
          </div>
        )}

        {/* Results */}
        {searched && !loading && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              {results.length === 0 ? 'No results found. Try a different query.' : `${results.length} results for "${query}"`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((r, idx) => (
                <div key={r.policy_id} id={`search-result-${r.policy_id}`} className="card"
                  style={{ padding: 'var(--space-5)', animation: `fadeInUp 300ms ease both`, animationDelay: `${idx * 50}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {r.pillar && (
                        <span className={`badge badge-${r.pillar}`}>{r.pillar === 'E' ? 'Environmental' : r.pillar === 'S' ? 'Social' : 'Governance'}</span>
                      )}
                      {r.urgency && (
                        <span className={`badge badge-${r.urgency}`}>{r.urgency}</span>
                      )}
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-enacted-bg)', color: 'var(--color-enacted)',
                        border: '1px solid #A7F3D0', fontWeight: 600,
                      }}>
                        {(r.similarity * 100).toFixed(0)}% match
                      </span>
                    </div>
                    {/* Source link removed for non-admin users */}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6, lineHeight: 1.4 }}>
                    {r.title}
                  </h3>
                  {r.summary && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      {r.summary}
                    </p>
                  )}
                  {r.jurisdiction && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                      📍 {r.jurisdiction}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

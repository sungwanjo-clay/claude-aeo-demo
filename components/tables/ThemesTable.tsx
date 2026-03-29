'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ThemeRow } from '@/lib/queries/types'
import { cn } from '@/lib/utils/cn'
import { getSentimentColor } from '@/lib/utils/colors'

interface ThemesTableProps {
  data: ThemeRow[]
}

type Filter = 'all' | 'Positive' | 'Negative'
type SortKey = 'theme' | 'occurrences' | 'sentiment'

export default function ThemesTable({ data }: ThemesTableProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('occurrences')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  const filtered = filter === 'all' ? data : data.filter(r => r.sentiment === filter)
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mr-2">Sentiment Themes</h3>
        {(['all', 'Positive', 'Negative'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0) }}
            className={cn(
              'px-2.5 py-1 text-xs rounded-full border transition-colors',
              filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="w-6 px-3" />
            <th
              className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
              onClick={() => { setSortKey('theme'); setSortDir(d => sortKey === 'theme' ? (d === 'asc' ? 'desc' : 'asc') : 'asc') }}
            >
              Theme {sortKey === 'theme' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th
              className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
              onClick={() => { setSortKey('sentiment'); setSortDir(d => sortKey === 'sentiment' ? (d === 'asc' ? 'desc' : 'asc') : 'asc') }}
            >
              Sentiment
            </th>
            <th
              className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
              onClick={() => { setSortKey('occurrences'); setSortDir(d => sortKey === 'occurrences' ? (d === 'asc' ? 'desc' : 'asc') : 'desc') }}
            >
              Occurrences {sortKey === 'occurrences' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((row, i) => {
            const key = `${row.theme}|||${row.sentiment}`
            const isOpen = expanded.has(key)
            return (
              <>
                <tr
                  key={key}
                  className={cn('border-b border-gray-50 text-sm cursor-pointer hover:bg-gray-50', i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white')}
                  onClick={() => toggleExpand(key)}
                >
                  <td className="px-3 py-2.5 text-gray-400">
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{row.theme}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: getSentimentColor(row.sentiment) }}
                    >
                      {row.sentiment}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 tabular-nums">{row.occurrences}</td>
                </tr>
                {isOpen && row.snippets.length > 0 && (
                  <tr key={`${key}-expand`} className="bg-gray-50 border-b border-gray-100">
                    <td colSpan={4} className="px-6 py-3">
                      <div className="space-y-1.5">
                        {row.snippets.slice(0, 3).map((s, j) => (
                          <p key={j} className="text-xs text-gray-600 italic border-l-2 border-gray-200 pl-2">&ldquo;{s}&rdquo;</p>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
          {!paginated.length && (
            <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">No themes found</td></tr>
          )}
        </tbody>
      </table>
      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          <span>{sorted.length} themes</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">← Prev</button>
            <span>Page {page + 1} of {Math.ceil(sorted.length / PAGE_SIZE)}</span>
            <button disabled={(page + 1) * PAGE_SIZE >= sorted.length} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

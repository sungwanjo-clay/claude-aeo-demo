'use client'

import { useState } from 'react'
import type { CitationDomainRow } from '@/lib/queries/types'
import { cn } from '@/lib/utils/cn'
import { getCitationTypeColor } from '@/lib/utils/colors'
import DownloadButton, { downloadCSV } from '@/components/shared/DownloadButton'

interface CitationDomainsTableProps {
  data: CitationDomainRow[]
  totalResponses?: number
}

type SortKey = 'domain' | 'citation_count' | 'citation_type'

export default function CitationDomainsTable({ data, totalResponses }: CitationDomainsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('citation_count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort(col)}>
        {label} {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Citation Domains</h3>
        <DownloadButton onClick={() => downloadCSV('citation_domains.csv', sorted)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">Rank</th>
              <SortHeader col="domain" label="Domain" />
              <SortHeader col="citation_type" label="Type" />
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">URL Type</th>
              <SortHeader col="citation_count" label="Citations" />
              {totalResponses && <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Share %</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr
                key={row.domain}
                className={cn(
                  'border-b border-gray-50 text-sm hover:bg-gray-50',
                  row.is_clay ? 'bg-green-50' : i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                )}
              >
                <td className="px-3 py-2.5 text-gray-400 text-xs">{page * PAGE_SIZE + i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900">
                  {row.domain}
                  {row.is_clay && <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Clay</span>}
                </td>
                <td className="px-3 py-2.5">
                  {row.citation_type && (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: getCitationTypeColor(row.citation_type) }}
                    >
                      {row.citation_type}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{row.url_type ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-700 tabular-nums">{row.citation_count.toLocaleString()}</td>
                {totalResponses && (
                  <td className="px-3 py-2.5 text-gray-700 tabular-nums">
                    {((row.citation_count / totalResponses) * 100).toFixed(1)}%
                  </td>
                )}
              </tr>
            ))}
            {!paginated.length && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">No citation data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          <span>{sorted.length} domains</span>
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

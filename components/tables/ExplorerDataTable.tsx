'use client'

import { useState } from 'react'
import type { ExplorerRow } from '@/lib/queries/explorer'
import DownloadButton, { downloadCSV } from '@/components/shared/DownloadButton'

interface ExplorerDataTableProps {
  data: ExplorerRow[]
  metric: string
  dimension: string
  dateRange: string
}

export default function ExplorerDataTable({ data, metric, dimension, dateRange }: ExplorerDataTableProps) {
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  const paginated = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleDownload() {
    const filename = `explorer_${metric}_${dimension}_${dateRange}.csv`
    downloadCSV(filename, data.map(r => ({
      'Time Period': r.period,
      [dimension]: r.dimensionValue,
      [metric]: r.value != null ? r.value.toFixed(2) : '',
      'Response Count': r.responseCount,
    })))
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Data Table</h3>
        <DownloadButton onClick={handleDownload} label="Export CSV" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{dimension}</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{metric}</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Responses</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr key={`${row.period}-${row.dimensionValue}`} className={`border-b border-gray-50 text-sm ${i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
                <td className="px-3 py-2.5 text-gray-700 tabular-nums">{row.period}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900">{row.dimensionValue}</td>
                <td className="px-3 py-2.5 text-gray-700 tabular-nums">{row.value != null ? row.value.toFixed(2) : '—'}</td>
                <td className="px-3 py-2.5 text-gray-500 tabular-nums">{row.responseCount.toLocaleString()}</td>
              </tr>
            ))}
            {!paginated.length && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {data.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          <span>{data.length} rows</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">← Prev</button>
            <span>Page {page + 1} of {Math.ceil(data.length / PAGE_SIZE)}</span>
            <button disabled={(page + 1) * PAGE_SIZE >= data.length} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

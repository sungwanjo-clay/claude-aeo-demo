'use client'

import { Download } from 'lucide-react'

interface DownloadButtonProps {
  onClick: () => void
  label?: string
  className?: string
}

export default function DownloadButton({ onClick, label, className }: DownloadButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-md px-2.5 py-1.5 transition-colors ${className ?? ''}`}
      title={label ?? 'Download'}
    >
      <Download size={12} />
      {label && <span>{label}</span>}
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function downloadCSV(filename: string, rows: any[]) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const header = keys.join(',')
  const body = rows.map(row =>
    keys.map(k => JSON.stringify(row[k] ?? '')).join(',')
  ).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

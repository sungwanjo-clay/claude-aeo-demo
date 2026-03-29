'use client'

import { getCitationTypeColor } from '@/lib/utils/colors'

interface CitationBarItem {
  type: string
  pct: number
  count: number
}

interface CitationProportionalBarProps {
  data: CitationBarItem[]
}

export default function CitationProportionalBar({ data }: CitationProportionalBarProps) {
  if (!data.length) return <p className="text-sm text-gray-400 py-4 text-center">No citation data</p>

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden">
        {data.map(item => (
          <div
            key={item.type}
            style={{ width: `${item.pct}%`, backgroundColor: getCitationTypeColor(item.type) }}
            title={`${item.type}: ${item.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {data.map(item => (
          <div key={item.type} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: getCitationTypeColor(item.type) }}
            />
            <span className="font-medium">{item.type}</span>
            <span className="text-gray-400">{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

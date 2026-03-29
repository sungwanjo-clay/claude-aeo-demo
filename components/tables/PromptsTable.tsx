'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PromptRow } from '@/lib/queries/prompts'
import { cn } from '@/lib/utils/cn'
import { truncate } from '@/lib/utils/formatters'
import { getPlatformColor } from '@/lib/utils/colors'
import PromptDrilldown from '@/components/panels/PromptDrilldown'

interface PromptsTableProps {
  data: PromptRow[]
}

function getPromptVisibility(p: PromptRow) {
  if (!p.responses.length) return null
  const yes = p.responses.filter(r => r.clay_mentioned === 'Yes').length
  return (yes / p.responses.length) * 100
}

function getPromptAvgPosition(p: PromptRow) {
  const positions = p.responses.map(r => r.clay_mention_position).filter((v): v is number => v != null)
  if (!positions.length) return null
  return positions.reduce((a, b) => a + b, 0) / positions.length
}

export default function PromptsTable({ data }: PromptsTableProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [selectedPrompt, setSelectedPrompt] = useState<PromptRow | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // Group by topic
  const byTopic = new Map<string, PromptRow[]>()
  for (const p of data) {
    const t = p.topic ?? 'Uncategorized'
    const arr = byTopic.get(t) ?? []
    arr.push(p)
    byTopic.set(t, arr)
  }

  function toggleTopic(t: string) {
    setExpandedTopics(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
            <tr>
              <th className="w-6 px-3" />
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prompt / Topic</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Visibility</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Position</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Platforms</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byTopic.entries()).map(([topic, prompts]) => {
              const isOpen = expandedTopics.has(topic)
              const topicVisibility = prompts.reduce((acc, p) => {
                const v = getPromptVisibility(p)
                return v != null ? acc + v : acc
              }, 0) / (prompts.filter(p => getPromptVisibility(p) != null).length || 1)

              return (
                <>
                  {/* Topic group row */}
                  <tr
                    key={`topic-${topic}`}
                    className="border-b border-gray-100 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleTopic(topic)}
                  >
                    <td className="px-3 py-2.5 text-gray-400">
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800 text-sm">
                      {topic} <span className="text-gray-400 font-normal">({prompts.length} prompts)</span>
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">
                      {topicVisibility.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5" />
                  </tr>

                  {/* Prompt rows */}
                  {isOpen && prompts.map(p => {
                    const vis = getPromptVisibility(p)
                    const pos = getPromptAvgPosition(p)
                    const platforms = [...new Set(p.responses.map(r => r.platform))]
                    return (
                      <tr
                        key={p.prompt_id}
                        className={cn("border-b border-gray-50 text-sm hover:bg-blue-50 cursor-pointer transition-colors", p.is_active === false && 'opacity-50')}
                        onClick={() => setSelectedPrompt(p)}
                      >
                        <td className="px-3 py-2.5 pl-8 text-gray-300">·</td>
                        <td className="px-3 py-2.5 text-gray-700 max-w-sm">
                          <span title={p.prompt_text} className={p.is_active === false ? 'text-gray-400' : ''}>{truncate(p.prompt_text, 80)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {p.is_active === false && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 mr-1">
                              Removed from Clay
                            </span>
                          )}
                          {p.prompt_type && (
                            <span className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded',
                              p.is_active === false
                                ? 'bg-gray-100 text-gray-400'
                                : p.prompt_type === 'benchmark'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-orange-100 text-orange-700'
                            )}>
                              {p.prompt_type}
                            </span>
                          )}
                          {p.tags && (
                            <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {p.tags}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 tabular-nums">
                          {vis != null ? `${vis.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 tabular-nums">
                          {pos != null ? `#${pos.toFixed(1)}` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            {platforms.map(plat => (
                              <span
                                key={plat}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: getPlatformColor(plat) }}
                              >
                                {plat}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )
            })}
            {!byTopic.size && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">No prompts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPrompt && (
        <PromptDrilldown prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
      )}
    </>
  )
}

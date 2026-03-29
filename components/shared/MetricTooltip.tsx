'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

interface MetricTooltipProps {
  text: string
}

export const TOOLTIP_DEFINITIONS: Record<string, string> = {
  'Visibility Score': '% of prompts where Clay was mentioned by the AI platform',
  'Mention Share': "Clay's mentions as a % of all competitor mentions across the same responses",
  'Citation Share': '% of responses where clay.com was included as a cited source',
  'Avg Position': 'Where Clay first appears among all tools mentioned (1 = first). Lower is better.',
  'Share of Voice': "Clay's share of all competitor mentions. Different from Visibility Score — this measures relative presence, not just whether Clay appeared.",
  'Positive Sentiment %': 'Of the responses where Clay was mentioned, what % described Clay positively',
  'Brand Sentiment Score': '0–100 score of how positively Clay is portrayed. 0 = not mentioned, 76–100 = primary recommendation',
  'Response Quality Score': "1–10 score of the AI response's overall clarity and helpfulness, regardless of Clay mention",
  'Benchmark Prompts': 'Prompts designated as the canonical set for measuring AI visibility. Campaign prompts are excluded from these metrics by default.',
  'Neutral %': 'Of responses where Clay was mentioned, what % described Clay neutrally',
  'Negative %': 'Of responses where Clay was mentioned, what % described Clay negatively',
  'Citation Domain Rank': 'Clay.com\'s rank among all domains cited across responses (1 = most cited)',
  'Total Unique Domains': 'Number of distinct domains cited across all responses in the selected period',
  'Avg Citations per Response': 'Average number of source URLs cited per AI response',
  'Claygent / MCP Rate': '% of responses that mention Claygent or Clay MCP as a tool or integration',
}

export default function MetricTooltip({ text }: MetricTooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={`Info: ${text}`}
        type="button"
      >
        <Info size={12} />
      </button>
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-md bg-gray-900 text-white text-xs px-3 py-2 shadow-lg leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}

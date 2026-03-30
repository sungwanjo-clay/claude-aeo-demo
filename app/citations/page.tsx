'use client'
// @ts-nocheck

import React, { useState, useEffect, useMemo } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getCitationShare,
  getCitationCount,
  getCitationOverallTimeseries,
  getCompetitorCitationTimeseries,
  getClayURLsByType,
  getTopCitedDomainsEnhanced,
  getCitationGaps,
  getCitationTypeBreakdown,
} from '@/lib/queries/citations'
import type { ClayURLTypeGroup, TopDomainRow } from '@/lib/queries/citations'
import KpiCard from '@/components/cards/KpiCard'
import { SkeletonCard, SkeletonChart } from '@/components/shared/Skeleton'
import { formatShortDate } from '@/lib/utils/formatters'
import { ChevronDown, ChevronRight, ExternalLink, Info, X } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const LABEL = {
  color: 'rgba(26,25,21,0.45)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}
const CARD = { background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }

// Extended citation type colors (all known types)
const TYPE_COLORS: Record<string, string> = {
  'Earned Media':  '#4A5AFF',
  'Social':        '#8B5CF6',
  'Institution':   '#0EA5E9',
  'Competition':   '#E5362A',
  'Owned':         '#3DAA6A',
  'PR Wire':       '#F59E0B',
  'Other':         '#9CA3AF',
}
function typeColor(t: string) { return TYPE_COLORS[t] ?? '#9CA3AF' }

// URL type colors
const URL_TYPE_COLORS: Record<string, string> = {
  'Blog Post':        '#4A5AFF',
  'Documentation':    '#3DAA6A',
  'Landing Page':     '#FF6B35',
  'Case Study':       '#CC3D8A',
  'Integration Page': '#3DB8CC',
  'Product Page':     '#F5C518',
  'Guide':            '#C8F040',
  'Other':            '#9CA3AF',
}
function urlTypeColor(t: string) { return URL_TYPE_COLORS[t] ?? '#9CA3AF' }

// Simple color from string for fallback favicon
function domainColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 55%, 45%)`
}

// Extract unique subdomains from URL list
function countSubdomains(domain: string, urls: { url: string }[]): number {
  const subs = new Set<string>()
  for (const { url } of urls) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      if (host !== domain && host.endsWith(`.${domain}`)) {
        subs.add(host)
      }
    } catch { /* ignore */ }
  }
  return subs.size
}

// ── Info tooltip ───────────────────────────────────────────────────────────────
function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1.5"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={12} style={{ color: 'rgba(26,25,21,0.35)', cursor: 'help', verticalAlign: 'middle' }} />
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg px-3 py-2 text-[11px] leading-relaxed font-medium shadow-lg pointer-events-none"
          style={{ background: 'var(--clay-black)', color: 'white', whiteSpace: 'normal' }}>
          {text}
        </span>
      )}
    </span>
  )
}

// ── Domain favicon (Google, fallback to letter) ────────────────────────────────
function DomainIcon({ domain }: { domain: string }) {
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <div className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
        style={{ background: domainColor(domain) }}>
        {domain.charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={18} height={18}
      className="rounded-sm shrink-0"
      onError={() => setErr(true)}
    />
  )
}

// ── Stacked category bar ────────────────────────────────────────────────────────
function CitationCategoryBar({
  types,
  selected,
  onSelect,
}: {
  types: { type: string; count: number; pct: number }[]
  selected: string | null
  onSelect: (t: string | null) => void
}) {
  if (!types.length) return null
  return (
    <div style={CARD} className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span style={LABEL}>Citation Categories</span>
          <InfoTip text="Breakdown of total citations in the selected period by category. Click a segment or label to filter the domain table below." />
        </div>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors hover:opacity-70"
            style={{ background: typeColor(selected) + '20', color: typeColor(selected) }}
          >
            <X size={10} />
            Clear filter
          </button>
        )}
      </div>

      {/* Stacked bar */}
      <div className="flex w-full overflow-hidden mb-3" style={{ borderRadius: '6px', height: '36px' }}>
        {types.map(t => (
          <button
            key={t.type}
            onClick={() => onSelect(selected === t.type ? null : t.type)}
            title={`${t.type}: ${t.pct.toFixed(1)}%`}
            className="flex items-center justify-center transition-opacity"
            style={{
              width: `${t.pct}%`,
              minWidth: t.pct > 2 ? undefined : '2px',
              background: typeColor(t.type),
              opacity: selected && selected !== t.type ? 0.3 : 1,
              cursor: 'pointer',
            }}
          >
            {t.pct >= 3 && (
              <span className="text-[11px] font-bold text-white select-none">
                {t.pct.toFixed(1)}%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {types.map(t => (
          <button
            key={t.type}
            onClick={() => onSelect(selected === t.type ? null : t.type)}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: selected && selected !== t.type ? 0.35 : 1 }}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: typeColor(t.type), outline: selected === t.type ? `2px solid ${typeColor(t.type)}` : 'none', outlineOffset: '1px' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--clay-black)' }}>{t.type}</span>
            <span className="text-[10px]" style={{ color: 'rgba(26,25,21,0.4)' }}>{t.pct.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Domain row: expandable with URLs ──────────────────────────────────────────
function DomainRowItem({ row, rank }: { row: TopDomainRow; rank: number }) {
  const [open, setOpen] = useState(false)
  const color = typeColor(row.citation_type ?? 'Other')
  const subdomainCount = countSubdomains(row.domain, row.top_urls)

  return (
    <React.Fragment>
      <tr
        onClick={() => row.top_urls.length > 0 && setOpen(v => !v)}
        className={`transition-colors ${row.top_urls.length > 0 ? 'cursor-pointer hover:bg-[rgba(26,25,21,0.015)]' : ''}`}
        style={{
          borderBottom: open ? 'none' : '1px solid rgba(26,25,21,0.06)',
          background: row.is_clay ? 'rgba(200,240,64,0.04)' : 'transparent',
        }}
      >
        {/* Rank */}
        <td className="py-3 pl-4 pr-2 text-[12px] font-bold tabular-nums w-10" style={{ color: 'rgba(26,25,21,0.3)' }}>
          {rank}
        </td>
        {/* Domain + favicon */}
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <DomainIcon domain={row.domain} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--clay-black)' }}>{row.domain}</span>
            {row.is_clay && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'rgba(200,240,64,0.3)', color: 'var(--clay-black)' }}>Clay ✓</span>
            )}
            {subdomainCount > 0 && (
              <span className="text-[10px] font-semibold shrink-0" style={{ color: 'rgba(26,25,21,0.4)' }}>
                {subdomainCount} subdomain{subdomainCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </td>
        {/* Category */}
        <td className="py-3 px-3 w-36">
          {row.citation_type && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {row.citation_type}
            </span>
          )}
        </td>
        {/* Share */}
        <td className="py-3 px-3 text-right text-[13px] font-bold tabular-nums w-20" style={{ color: 'var(--clay-black)' }}>
          {row.share_pct.toFixed(2)}%
        </td>
        {/* Expand */}
        <td className="py-3 pr-4 pl-2 w-8 text-center">
          {row.top_urls.length > 0 && (
            open
              ? <ChevronDown size={11} style={{ color: 'rgba(26,25,21,0.4)' }} />
              : <ChevronRight size={11} style={{ color: 'rgba(26,25,21,0.4)' }} />
          )}
        </td>
      </tr>

      {/* URL drill-down */}
      {open && row.top_urls.length > 0 && (
        <tr style={{ borderBottom: '1px solid rgba(26,25,21,0.06)', background: 'rgba(26,25,21,0.01)' }}>
          <td colSpan={5} className="px-4 pb-3 pt-1">
            <div className="ml-8 space-y-1">
              {/* Sub-header */}
              <div className="grid gap-2 px-2 pb-1"
                style={{ gridTemplateColumns: '1fr 90px 80px 64px', borderBottom: '1px solid rgba(26,25,21,0.07)' }}>
                {['Page', 'Type', 'Count', ''].map((h, i) => (
                  <span key={h} className={i > 0 ? 'text-right' : ''} style={{ ...LABEL, fontSize: '9px' }}>{h}</span>
                ))}
              </div>
              {row.top_urls.map(u => {
                const uc = urlTypeColor(u.url_type ?? 'Other')
                return (
                  <div key={u.url} className="grid gap-2 items-center px-2 py-1.5 rounded hover:bg-[rgba(26,25,21,0.02)]"
                    style={{ gridTemplateColumns: '1fr 90px 80px 64px' }}>
                    {/* Title + URL */}
                    <div className="min-w-0">
                      {u.title && (
                        <p className="text-[11px] font-semibold leading-tight mb-0.5 truncate" style={{ color: 'var(--clay-black)' }}>
                          {u.title}
                        </p>
                      )}
                      <a href={u.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 group" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={9} className="shrink-0 opacity-40 group-hover:opacity-70" />
                        <span className="text-[10px] truncate group-hover:underline" style={{ color: 'rgba(26,25,21,0.45)' }}>
                          {u.url}
                        </span>
                      </a>
                      {u.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {u.topics.slice(0, 3).map(t => (
                            <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(74,90,255,0.08)', color: '#4A5AFF' }}>{t}</span>
                          ))}
                          {u.topics.length > 3 && (
                            <span className="text-[9px]" style={{ color: 'rgba(26,25,21,0.35)' }}>+{u.topics.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* url_type */}
                    <div className="text-right">
                      {u.url_type && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${uc}18`, color: uc, border: `1px solid ${uc}30` }}>
                          {u.url_type}
                        </span>
                      )}
                    </div>
                    {/* Count */}
                    <span className="text-right text-[12px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                      {u.count.toLocaleString()}
                    </span>
                    <span />
                  </div>
                )
              })}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  )
}

// ── Category group section (when no type is selected) ─────────────────────────
function CategoryGroup({
  typeName,
  domains,
  rankOffset,
}: {
  typeName: string
  domains: TopDomainRow[]
  rankOffset: number
}) {
  const [open, setOpen] = useState(false)
  const color = typeColor(typeName)
  const total = domains.reduce((s, d) => s + d.citation_count, 0)

  return (
    <tbody>
      {/* Group header row */}
      <tr
        onClick={() => setOpen(v => !v)}
        className="cursor-pointer hover:bg-[rgba(26,25,21,0.02)] transition-colors"
        style={{ background: `${color}08`, borderBottom: open ? 'none' : '1px solid rgba(26,25,21,0.07)' }}
      >
        <td className="py-2.5 pl-4" colSpan={2}>
          <div className="flex items-center gap-2">
            {open
              ? <ChevronDown size={12} style={{ color }} />
              : <ChevronRight size={12} style={{ color }} />}
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
              {typeName}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: 'rgba(26,25,21,0.5)' }}>
              {domains.length} domain{domains.length !== 1 ? 's' : ''} · {total.toLocaleString()} citations
            </span>
          </div>
        </td>
        <td colSpan={3} />
      </tr>
      {/* Domain rows (only when open) */}
      {open && domains.map((row, i) => (
        <DomainRowItem key={row.domain} row={row} rank={rankOffset + i + 1} />
      ))}
      {/* Spacer when closed */}
      {!open && <tr style={{ height: 0 }} />}
    </tbody>
  )
}

// ── Clay citations by content type ─────────────────────────────────────────────
function ClayURLTypeRow({ group, totalCitations }: { group: ClayURLTypeGroup; totalCitations: number }) {
  const [open, setOpen] = useState(true) // default expanded
  const [showAll, setShowAll] = useState(false)
  const color = urlTypeColor(group.url_type)
  const LIMIT = 5
  const visible = showAll ? group.urls : group.urls.slice(0, LIMIT)

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(26,25,21,0.08)' }}>
      {/* Group header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(26,25,21,0.02)] transition-colors"
        onClick={() => setOpen(v => !v)}
        style={{ borderBottom: open ? '1px solid rgba(26,25,21,0.07)' : 'none' }}
      >
        <div className="shrink-0">
          {open
            ? <ChevronDown size={12} style={{ color: 'rgba(26,25,21,0.4)' }} />
            : <ChevronRight size={12} style={{ color: 'rgba(26,25,21,0.4)' }} />}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
          style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
          {group.url_type}
        </span>
        <div className="flex-1 min-w-0 hidden sm:block">
          <div className="w-full rounded-full overflow-hidden" style={{ height: '4px', background: 'rgba(26,25,21,0.07)' }}>
            <div style={{ width: `${Math.min(group.share_pct, 100)}%`, background: color, height: '100%', transition: 'width 0.4s' }} />
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
            {group.share_pct.toFixed(1)}%
          </span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
            {group.total.toLocaleString()} <span className="text-[10px] font-medium" style={{ color: 'rgba(26,25,21,0.4)' }}>citations</span>
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: 'rgba(26,25,21,0.4)' }}>
            {group.urls.length} URLs
          </span>
        </div>
      </div>

      {open && (
        <div style={{ background: 'rgba(26,25,21,0.01)' }}>
          {/* Sub-header */}
          <div className="grid gap-2 px-4 py-1.5"
            style={{ gridTemplateColumns: '1fr 80px 80px 100px', background: 'rgba(26,25,21,0.03)', borderBottom: '1px solid rgba(26,25,21,0.07)' }}>
            {['Content / URL', 'Times Cited', 'Topics', 'Platforms'].map((h, i) => (
              <span key={h} className={i > 0 ? 'text-right' : ''} style={{ ...LABEL, fontSize: '9px' }}>{h}</span>
            ))}
          </div>

          {visible.map(item => (
            <div key={item.url} className="grid gap-2 px-4 py-2.5 hover:bg-[rgba(26,25,21,0.02)] items-start"
              style={{ gridTemplateColumns: '1fr 80px 80px 100px', borderBottom: '1px solid rgba(26,25,21,0.04)' }}>
              <div className="min-w-0">
                {item.title && (
                  <p className="text-[12px] font-semibold mb-0.5 leading-tight" style={{ color: 'var(--clay-black)' }}>
                    {item.title}
                  </p>
                )}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 group">
                  <ExternalLink size={9} className="opacity-40 group-hover:opacity-70 shrink-0" />
                  <span className="text-[10px] truncate group-hover:underline max-w-xs" style={{ color: 'rgba(26,25,21,0.45)' }}>
                    {item.url}
                  </span>
                </a>
              </div>
              <span className="text-right text-[13px] font-bold tabular-nums pt-0.5" style={{ color: 'var(--clay-black)' }}>
                {item.count.toLocaleString()}
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {item.topics.slice(0, 2).map(t => (
                  <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(74,90,255,0.08)', color: '#4A5AFF' }}>{t}</span>
                ))}
                {item.topics.length > 2 && (
                  <span className="text-[9px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>+{item.topics.length - 2}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                {item.platforms.map(p => (
                  <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(74,90,255,0.08)', color: '#4A5AFF' }}>{p}</span>
                ))}
              </div>
            </div>
          ))}

          {group.urls.length > LIMIT && (
            <button
              onClick={e => { e.stopPropagation(); setShowAll(v => !v) }}
              className="w-full py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
              style={{ borderTop: '1px solid rgba(26,25,21,0.06)', color: 'rgba(26,25,21,0.4)' }}
            >
              {showAll ? `Show top ${LIMIT} ↑` : `Show all ${group.urls.length} URLs ↓`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Citation Share chart ───────────────────────────────────────────────────────
function CitationShareChart({
  clayTs,
  competitorTs,
}: {
  clayTs: { date: string; value: number }[]
  competitorTs: { date: string; domain: string; value: number }[]
}) {
  const [showComp, setShowComp] = useState(false)
  const COMP_COLORS = ['#4A5AFF', '#E5362A', '#FF6B35', '#CC3D8A', '#3DAA6A']

  const totals = new Map<string, number>()
  for (const r of competitorTs) totals.set(r.domain, (totals.get(r.domain) ?? 0) + r.value)
  const top5 = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d]) => d)

  const allDates = [...new Set([...clayTs.map(r => r.date), ...competitorTs.map(r => r.date)])].sort()
  const clayMap = new Map(clayTs.map(r => [r.date, r.value]))
  const compMap = new Map(competitorTs.map(r => [`${r.date}|||${r.domain}`, r.value]))

  const chartData = allDates.map(date => {
    const row: Record<string, string | number> = { date, Clay: clayMap.get(date) ?? 0 }
    if (showComp) for (const d of top5) row[d] = compMap.get(`${date}|||${d}`) ?? 0
    return row
  })

  return (
    <div style={CARD} className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <span style={LABEL}>Citation Share Over Time</span>
          <InfoTip text="% of AI responses that cite clay.com. Toggle to compare against top cited competing domains." />
        </div>
        {competitorTs.length > 0 && (
          <button
            onClick={() => setShowComp(v => !v)}
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors"
            style={{
              background: showComp ? 'var(--clay-black)' : 'rgba(26,25,21,0.06)',
              color: showComp ? 'white' : 'rgba(26,25,21,0.55)',
            }}
          >
            {showComp ? 'Hide competitors' : 'Show top 5 competitors'}
          </button>
        )}
      </div>
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={showComp ? 210 : 180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,25,21,0.06)" />
            <XAxis dataKey="date" tickFormatter={(v: any) => formatShortDate(v)}
              tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.4)' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v: any) => `${Number(v).toFixed(0)}%`}
              tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.4)' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]}
              labelFormatter={(l: any) => formatShortDate(String(l))}
              contentStyle={{ fontSize: 11, border: '1px solid var(--clay-border)', borderRadius: '8px' }}
            />
            {showComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
            <Line type="monotone" dataKey="Clay" stroke="var(--clay-black)" strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--clay-black)' }} activeDot={{ r: 5 }} />
            {showComp && top5.map((d, i) => (
              <Line key={d} type="monotone" dataKey={d}
                stroke={COMP_COLORS[i % COMP_COLORS.length]}
                strokeWidth={1.8} dot={{ r: 2, strokeWidth: 0 }} activeDot={{ r: 4 }} name={d} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center py-12" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
          Not enough data points
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CitationsPage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [loadingExtra, setLoadingExtra] = useState(true)

  const [citShare, setCitShare] = useState<{ current: number | null; previous: number | null } | null>(null)
  const [citCount, setCitCount] = useState<{ current: number; previous: number } | null>(null)
  const [clayTs, setClayTs] = useState<{ date: string; value: number }[]>([])
  const [competitorTs, setCompetitorTs] = useState<{ date: string; domain: string; value: number }[]>([])
  const [clayUrlTypes, setClayUrlTypes] = useState<ClayURLTypeGroup[]>([])
  const [topDomains, setTopDomains] = useState<TopDomainRow[]>([])
  const [gaps, setGaps] = useState<{ domain: string; topic: string; prompt_count: number; pct_of_topic: number }[]>([])
  const [citTypes, setCitTypes] = useState<{ type: string; count: number; pct: number }[]>([])
  const [domainSearch, setDomainSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Fast: KPIs + chart
  useEffect(() => {
    setLoading(true)
    Promise.all([
      getCitationShare(supabase, f).catch(() => null),
      getCitationCount(supabase, f).catch(() => null),
      getCitationOverallTimeseries(supabase, f).catch(() => []),
    ]).then(([share, count, ts]) => {
      if (share) setCitShare(share)
      if (count) setCitCount(count)
      setClayTs(ts ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter])

  // Slow: all domain-level data
  useEffect(() => {
    setLoadingExtra(true)
    setSelectedType(null)
    Promise.all([
      getCompetitorCitationTimeseries(supabase, f, 5).catch(() => []),
      getClayURLsByType(supabase, f).catch(() => []),
      getTopCitedDomainsEnhanced(supabase, f).catch(() => []),
      getCitationGaps(supabase, f).catch(() => []),
      getCitationTypeBreakdown(supabase, f).catch(() => []),
    ]).then(([compTs, urlTypes, domains, gapData, typeBreakdown]) => {
      setCompetitorTs(compTs ?? [])
      setClayUrlTypes(urlTypes ?? [])
      setTopDomains(domains ?? [])
      setGaps(gapData ?? [])
      setCitTypes(typeBreakdown ?? [])
      setLoadingExtra(false)
    }).catch(() => setLoadingExtra(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter])

  const citDelta = (citShare?.current != null && citShare?.previous != null)
    ? citShare.current - citShare.previous : null
  const countDelta = (citCount != null && citCount.previous > 0)
    ? citCount.current - citCount.previous : null
  const clayDomainRank = topDomains.findIndex(d => d.is_clay) + 1
  const totalClayCitations = clayUrlTypes.reduce((s, g) => s + g.total, 0)

  // Filter + search for flat domain list (when type selected)
  const displayDomains = useMemo(() => {
    let list = selectedType ? topDomains.filter(d => d.citation_type === selectedType) : topDomains.slice(0, 20)
    if (domainSearch) list = list.filter(d => d.domain.toLowerCase().includes(domainSearch.toLowerCase()))
    return list
  }, [topDomains, selectedType, domainSearch])

  // Grouped domains (when no type selected)
  const groupedDomains = useMemo(() => {
    const map = new Map<string, TopDomainRow[]>()
    for (const d of topDomains.slice(0, 20)) {
      const t = d.citation_type ?? 'Other'
      if (!map.has(t)) map.set(t, [])
      map.get(t)!.push(d)
    }
    // Sort groups by total citations descending
    return [...map.entries()].sort((a, b) => {
      const sa = a[1].reduce((s, d) => s + d.citation_count, 0)
      const sb = b[1].reduce((s, d) => s + d.citation_count, 0)
      return sb - sa
    })
  }, [topDomains])

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--clay-black)', letterSpacing: '-0.03em' }}>Citations</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(26,25,21,0.55)' }}>
          What content is being cited by AI, what type, and where are the gaps?
        </p>
      </div>

      {/* KPI tiles */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Citation Share"
            value={citShare?.current != null ? `${citShare.current.toFixed(1)}%` : '—'}
            delta={citDelta} deltaLabel="vs prev period" />
          <KpiCard label="Citation Count"
            value={citCount?.current != null ? citCount.current.toLocaleString() : '—'}
            delta={countDelta} deltaLabel="vs prev period" deltaIsCount />
          <KpiCard label="Clay Domain Rank"
            value={clayDomainRank > 0 ? `#${clayDomainRank}` : '—'}
            delta={null} deltaLabel="among all cited domains" />
          <KpiCard label="Clay Citations"
            value={totalClayCitations > 0 ? totalClayCitations.toLocaleString() : '—'}
            delta={null} deltaLabel="total clay.com citations" />
        </div>
      )}

      {/* Citation Share chart */}
      {loading ? (
        <div style={CARD} className="p-4">
          <div style={LABEL} className="mb-3">Citation Share Over Time</div>
          <SkeletonChart />
        </div>
      ) : (
        <CitationShareChart clayTs={clayTs} competitorTs={competitorTs} />
      )}

      {/* Citation Categories stacked bar */}
      {!loadingExtra && citTypes.length > 0 && (
        <CitationCategoryBar
          types={citTypes}
          selected={selectedType}
          onSelect={setSelectedType}
        />
      )}

      {/* Top Cited Domains */}
      <div style={CARD} className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="flex items-center">
              <span style={LABEL}>Top Cited Domains</span>
              <InfoTip text="Websites most frequently cited by AI across the prompt set. Grouped by citation category. Expand a group to see individual domains and their pages." />
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(26,25,21,0.45)' }}>
              {selectedType
                ? `Filtered to ${selectedType} — showing ${displayDomains.length} domain${displayDomains.length !== 1 ? 's' : ''}`
                : 'Top 20 domains grouped by citation type. Click category bar above to filter.'}
            </p>
          </div>
          <input
            type="text"
            value={domainSearch}
            onChange={e => setDomainSearch(e.target.value)}
            placeholder="Search domain…"
            className="text-[12px] px-2.5 py-1.5 rounded-lg outline-none"
            style={{ border: '1px solid var(--clay-border)', background: 'rgba(26,25,21,0.02)', color: 'var(--clay-black)', width: '160px' }}
          />
        </div>

        {loadingExtra ? (
          <SkeletonChart />
        ) : (
          <>
            {/* Flat filtered list (when type selected or search active) */}
            {(selectedType || domainSearch) ? (
              displayDomains.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-[13px]" style={{ color: 'rgba(26,25,21,0.35)' }}>
                  No domains match your selection
                </div>
              ) : (
                <table className="w-full mt-3">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--clay-border)' }}>
                      <th className="pb-2 pl-4 text-left w-10" style={LABEL}>#</th>
                      <th className="pb-2 text-left" style={LABEL}>Domain</th>
                      <th className="pb-2 px-3 text-left w-36" style={LABEL}>Category</th>
                      <th className="pb-2 px-3 text-right w-20" style={LABEL}>Share</th>
                      <th style={{ width: '28px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayDomains.map((row, i) => (
                      <DomainRowItem key={row.domain} row={row} rank={i + 1} />
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              /* Grouped view (default) */
              topDomains.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-[13px]" style={{ color: 'rgba(26,25,21,0.35)' }}>
                  No domain citation data
                </div>
              ) : (
                <table className="w-full mt-3">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--clay-border)' }}>
                      <th className="pb-2 pl-4 text-left w-10" style={LABEL}>#</th>
                      <th className="pb-2 text-left" style={LABEL}>Domain</th>
                      <th className="pb-2 px-3 text-left w-36" style={LABEL}>Category</th>
                      <th className="pb-2 px-3 text-right w-20" style={LABEL}>Share</th>
                      <th style={{ width: '28px' }} />
                    </tr>
                  </thead>
                  {groupedDomains.map(([typeName, domains], gi) => (
                    <CategoryGroup
                      key={typeName}
                      typeName={typeName}
                      domains={domains}
                      rankOffset={groupedDomains.slice(0, gi).reduce((s, [, ds]) => s + ds.length, 0)}
                    />
                  ))}
                </table>
              )
            )}
          </>
        )}
      </div>

      {/* Clay Citations by Content Type */}
      <div style={CARD} className="p-4">
        <div className="flex items-center mb-1">
          <span style={LABEL}>Clay Citations by Content Type</span>
          <InfoTip text="Which types of Clay content AI cites most. Expand a type to see individual URLs, topics they appear in, and which platforms cite them." />
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Breakdown of how clay.com is cited — by content type, with top cited pages per category.
        </p>
        {loadingExtra ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(26,25,21,0.05)' }} />
            ))}
          </div>
        ) : clayUrlTypes.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[13px]" style={{ color: 'rgba(26,25,21,0.35)' }}>
            No Clay citation data in this period
          </div>
        ) : (
          <div className="space-y-2">
            {clayUrlTypes.map(group => (
              <ClayURLTypeRow key={group.url_type} group={group} totalCitations={totalClayCitations} />
            ))}
          </div>
        )}
      </div>

      {/* Citation Gap Analysis */}
      <div style={CARD} className="p-4">
        <div className="flex items-center mb-1">
          <span style={LABEL}>Citation Gap Analysis</span>
          <InfoTip text="Competitor domains cited by AI when Clay isn't mentioned — topics where rival content ranks but Clay doesn't appear." />
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Competitor domains cited by AI when Clay isn&apos;t mentioned — topics where rival content ranks but Clay doesn&apos;t appear.
        </p>
        {loadingExtra ? (
          <SkeletonChart />
        ) : gaps.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[13px]" style={{ color: 'rgba(26,25,21,0.35)' }}>No gap data found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--clay-border)' }}>
                <th className="pb-2 px-4 text-left" style={LABEL}>Competitor Domain</th>
                <th className="pb-2 px-3 text-left" style={LABEL}>Topic</th>
                <th className="pb-2 px-3 text-right" style={LABEL}>Prompts</th>
                <th className="pb-2 px-3 text-right" style={LABEL}>% of Topic</th>
              </tr>
            </thead>
            <tbody>
              {gaps.slice(0, 25).map((g, i) => (
                <tr key={`${g.domain}-${g.topic}-${i}`} style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                  <td className="py-2.5 px-4">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--clay-pomegranate)' }}>{g.domain}</span>
                  </td>
                  <td className="py-2.5 px-3 text-[12px]" style={{ color: 'var(--clay-black)' }}>{g.topic}</td>
                  <td className="py-2.5 px-3 text-right text-[12px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                    {g.prompt_count}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[12px] tabular-nums" style={{ color: 'rgba(26,25,21,0.55)' }}>
                    {g.pct_of_topic.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}

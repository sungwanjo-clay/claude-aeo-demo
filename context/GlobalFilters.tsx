'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { FilterParams } from '@/lib/queries/types'

/** Format a Date as a local-timezone YYYY-MM-DD string.
 *  Avoids the toISOString() UTC-conversion bug where e.g. Apr 21 at
 *  9pm PDT becomes Apr 22 in UTC, shifting the date range by a day. */
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface GlobalFilters {
  promptType: 'benchmark' | 'campaign' | 'all'
  tags: string        // 'all' or specific tag value
  dateRange: { start: Date; end: Date }
  comparisonRange: { start: Date; end: Date }
  compareEnabled: boolean
  platform: string    // 'all' | 'Claude' | 'ChatGPT'
  topics: string[]
  brandedFilter: 'all' | 'branded' | 'non-branded'
}

interface GlobalFiltersContextValue {
  filters: GlobalFilters
  setFilters: (f: Partial<GlobalFilters>) => void
  toQueryParams: () => FilterParams
  clearAll: () => void
}

function computeComparisonRange(start: Date, end: Date): { start: Date; end: Date } {
  const diffMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return { start: prevStart, end: prevEnd }
}

function defaultFilters(): GlobalFilters {
  const end = new Date()
  end.setDate(end.getDate() - 1)   // yesterday — last day guaranteed to have full data
  const start = new Date(end)
  start.setDate(start.getDate() - 9) // 10-day window ending yesterday
  return {
    promptType: 'all',
    tags: 'all',
    dateRange: { start, end },
    comparisonRange: computeComparisonRange(start, end),
    compareEnabled: false,
    platform: 'all',
    topics: [],
    brandedFilter: 'all',
  }
}

const GlobalFiltersContext = createContext<GlobalFiltersContextValue | null>(null)

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters)

  const setFilters = (partial: Partial<GlobalFilters>) => {
    setFiltersState(prev => {
      const next = { ...prev, ...partial }
      if (partial.dateRange) {
        next.comparisonRange = computeComparisonRange(partial.dateRange.start, partial.dateRange.end)
      }
      return next
    })
  }

  const toQueryParams = (): FilterParams => ({
    promptType: filters.promptType,
    tags: filters.tags,
    // Use local date strings + explicit time to avoid UTC offset shifting
    // the date into the next/previous day. T23:59:59 ensures all timestamps
    // on the end date are included regardless of when data was ingested.
    startDate: localDateStr(filters.dateRange.start) + 'T00:00:00',
    endDate:   localDateStr(filters.dateRange.end)   + 'T23:59:59',
    prevStartDate: localDateStr(filters.comparisonRange.start) + 'T00:00:00',
    prevEndDate:   localDateStr(filters.comparisonRange.end)   + 'T23:59:59',
    platforms: filters.platform === 'all' ? [] : [filters.platform],
    topics: filters.topics,
    brandedFilter: filters.brandedFilter,
  })

  const clearAll = () => setFiltersState(defaultFilters())

  return (
    <GlobalFiltersContext.Provider value={{ filters, setFilters, toQueryParams, clearAll }}>
      {children}
    </GlobalFiltersContext.Provider>
  )
}

export function useGlobalFilters() {
  const ctx = useContext(GlobalFiltersContext)
  if (!ctx) throw new Error('useGlobalFilters must be used within GlobalFiltersProvider')
  return ctx
}

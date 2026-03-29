'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { FilterParams } from '@/lib/queries/types'

export interface GlobalFilters {
  promptType: string  // 'benchmark' | 'all' | tag string
  dateRange: { start: Date; end: Date }
  comparisonRange: { start: Date; end: Date }
  platforms: string[]
  topics: string[]
  brandedFilter: 'all' | 'branded' | 'non-branded'
}

interface GlobalFiltersContextValue {
  filters: GlobalFilters
  setFilters: (f: Partial<GlobalFilters>) => void
  toQueryParams: () => FilterParams
  activeFilterCount: number
  clearAll: () => void
}

function defaultFilters(): GlobalFilters {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)

  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date()
  prevStart.setDate(prevEnd.getDate() - 7)

  return {
    promptType: 'benchmark',
    dateRange: { start, end },
    comparisonRange: { start: prevStart, end: prevEnd },
    platforms: [],
    topics: [],
    brandedFilter: 'all',
  }
}

function computeComparisonRange(start: Date, end: Date): { start: Date; end: Date } {
  const diffMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return { start: prevStart, end: prevEnd }
}

const GlobalFiltersContext = createContext<GlobalFiltersContextValue | null>(null)

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters)

  const setFilters = (partial: Partial<GlobalFilters>) => {
    setFiltersState(prev => {
      const next = { ...prev, ...partial }
      // Auto-update comparison range when date range changes
      if (partial.dateRange) {
        next.comparisonRange = computeComparisonRange(
          partial.dateRange.start,
          partial.dateRange.end
        )
      }
      return next
    })
  }

  const toQueryParams = (): FilterParams => ({
    promptType: filters.promptType,
    startDate: filters.dateRange.start.toISOString(),
    endDate: filters.dateRange.end.toISOString(),
    prevStartDate: filters.comparisonRange.start.toISOString(),
    prevEndDate: filters.comparisonRange.end.toISOString(),
    platforms: filters.platforms,
    topics: filters.topics,
    brandedFilter: filters.brandedFilter,
  })

  const activeFilterCount = [
    filters.promptType !== 'benchmark' ? 1 : 0,
    filters.platforms.length > 0 ? 1 : 0,
    filters.topics.length > 0 ? 1 : 0,
    filters.brandedFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const clearAll = () => setFiltersState(defaultFilters())

  return (
    <GlobalFiltersContext.Provider value={{ filters, setFilters, toQueryParams, activeFilterCount, clearAll }}>
      {children}
    </GlobalFiltersContext.Provider>
  )
}

export function useGlobalFilters() {
  const ctx = useContext(GlobalFiltersContext)
  if (!ctx) throw new Error('useGlobalFilters must be used within GlobalFiltersProvider')
  return ctx
}

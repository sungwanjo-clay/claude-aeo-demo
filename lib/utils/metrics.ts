export interface MetricDelta {
  current: number | null
  previous: number | null
  deltaAbs: number | null
  deltaPct: number | null
  direction: 'up' | 'down' | 'flat' | null
}

export function computeDelta(current: number | null, previous: number | null): MetricDelta {
  if (current == null || previous == null) {
    return { current, previous, deltaAbs: null, deltaPct: null, direction: null }
  }
  const deltaAbs = current - previous
  const deltaPct = previous === 0 ? null : ((current - previous) / previous) * 100
  const direction: 'up' | 'down' | 'flat' =
    Math.abs(deltaAbs) < 0.001 ? 'flat' : deltaAbs > 0 ? 'up' : 'down'
  return { current, previous, deltaAbs, deltaPct, direction }
}

export function visibilityScore(mentioned: number, total: number): number {
  if (total === 0) return 0
  return (mentioned / total) * 100
}

export function getSubRange(start: Date, end: Date): { start: Date; end: Date } {
  const diffMs = end.getTime() - start.getTime()
  return {
    start: new Date(start.getTime() - diffMs),
    end: new Date(start.getTime() - 1),
  }
}

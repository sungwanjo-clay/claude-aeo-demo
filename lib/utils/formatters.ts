export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatRawPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString()
}

export function formatScore(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return value.toFixed(decimals)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDelta(delta: number | null | undefined): { text: string; positive: boolean } {
  if (delta == null) return { text: '—', positive: true }
  const sign = delta >= 0 ? '↑' : '↓'
  return {
    text: `${sign} ${Math.abs(delta).toFixed(1)}%`,
    positive: delta >= 0,
  }
}

export function formatPosition(pos: number | null | undefined): string {
  if (pos == null) return '—'
  return `#${pos}`
}

export function truncate(text: string | null | undefined, maxLen = 80): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}

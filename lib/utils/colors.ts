// Clay brand palette — sourced from clay.com design system
export const PLATFORM_COLORS: Record<string, string> = {
  ChatGPT: '#3DAA6A',   // matcha
  Claude: '#CC3D8A',    // dragonfruit
  Perplexity: '#4A5AFF', // blueberry
  Gemini: '#FF6B35',    // tangerine
}

export const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#3DAA6A',         // matcha green
  Neutral: '#9CA3AF',          // neutral gray
  Negative: '#E5362A',         // pomegranate
  'Not Mentioned': '#D1D5DB',
}

export const CITATION_TYPE_COLORS: Record<string, string> = {
  Competition: '#E5362A',       // pomegranate
  'Earned Media': '#4A5AFF',    // blueberry
  Social: '#CC3D8A',            // dragonfruit
  Owned: '#3DAA6A',             // matcha
  Other: '#9CA3AF',
}

export const CLAY_BRAND = '#1D2026'
export const CLAY_LIME = '#C8F040'

export const CHART_COLORS = [
  '#1D2026', // clay black
  '#C8F040', // lime
  '#4A5AFF', // blueberry
  '#3DAA6A', // matcha
  '#FF6B35', // tangerine
  '#CC3D8A', // dragonfruit
  '#E5362A', // pomegranate
  '#3DB8CC', // slushie
  '#F5C518', // lemon
  '#9CA3AF', // neutral
]

export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? '#9CA3AF'
}

export function getSentimentColor(sentiment: string): string {
  return SENTIMENT_COLORS[sentiment] ?? '#9CA3AF'
}

export function getCitationTypeColor(type: string): string {
  return CITATION_TYPE_COLORS[type] ?? '#9CA3AF'
}

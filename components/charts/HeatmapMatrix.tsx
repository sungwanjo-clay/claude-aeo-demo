'use client'

interface HeatmapCell {
  competitor: string
  platform: string
  visibility_score: number
}

interface HeatmapMatrixProps {
  data: HeatmapCell[]
}

function getColor(score: number): string {
  // 0 = white, 100 = indigo-700
  const opacity = Math.min(score / 80, 1)
  return `rgba(92, 111, 255, ${opacity})`
}

export default function HeatmapMatrix({ data }: HeatmapMatrixProps) {
  const platforms = [...new Set(data.map(d => d.platform))]
  const competitors = [...new Set(data.map(d => d.competitor))]
  const sorted = competitors.sort((a, b) => {
    const aScore = data.filter(d => d.competitor === a).reduce((s, r) => s + r.visibility_score, 0)
    const bScore = data.filter(d => d.competitor === b).reduce((s, r) => s + r.visibility_score, 0)
    return bScore - aScore
  })

  if (!data.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No competitor data</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full min-w-[400px]">
        <thead>
          <tr>
            <th className="text-left p-2 text-gray-500 font-medium w-32">Competitor</th>
            {platforms.map(p => (
              <th key={p} className="text-center p-2 text-gray-500 font-medium">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(comp => {
            const isClay = comp.toLowerCase() === 'clay'
            return (
              <tr key={comp} className={isClay ? 'ring-2 ring-inset ring-indigo-300' : ''}>
                <td className={`p-2 font-medium ${isClay ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {comp}
                  {isClay && <span className="ml-1 text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">Clay</span>}
                </td>
                {platforms.map(p => {
                  const cell = data.find(d => d.competitor === comp && d.platform === p)
                  const score = cell?.visibility_score ?? 0
                  return (
                    <td
                      key={p}
                      className="p-2 text-center font-medium"
                      style={{ backgroundColor: getColor(score) }}
                      title={`${comp} on ${p}: ${score.toFixed(1)}%`}
                    >
                      {score > 0 ? `${score.toFixed(0)}%` : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

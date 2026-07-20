/**
 * Regressão linear simples: calcula inclinação (por minuto) de uma série de pontos.
 */
function linearRegression(points) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 }

  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/**
 * Calcula tendência e valor previsto a partir de leituras históricas.
 * @param {Array<{value:number, recorded_at:string}>} readings - mais recentes primeiro
 * @param {number} horasFuturas
 * @param {{min:number,max:number}} clamp - limites do valor (ex: 0-100)
 */
export function predictTrend(readings, horasFuturas = 3, clamp = { min: 0, max: 100 }) {
  if (!readings || readings.length < 3) return null

  const ordered = [...readings].reverse()
  const t0 = new Date(ordered[0].recorded_at).getTime()
  const points = ordered.map((r) => ({
    x: (new Date(r.recorded_at).getTime() - t0) / 60000,
    y: r.value,
  }))

  const { slope, intercept } = linearRegression(points)
  const ultimoX = points[points.length - 1].x
  const futuroX = ultimoX + horasFuturas * 60
  let predicted = slope * futuroX + intercept
  predicted = Math.max(clamp.min, Math.min(clamp.max, Math.round(predicted * 10) / 10))

  const slopePerHour = Math.round(slope * 60 * 10) / 10
  let trend = 'estavel'
  if (Math.abs(slopePerHour) > (clamp.max - clamp.min) * 0.01) {
    trend = slopePerHour > 0 ? 'subida' : 'descida'
  }

  return { predicted, trend, slopePerHour, current: ordered[ordered.length - 1].y }
}
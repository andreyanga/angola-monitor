/**
 * Índice de Risco Ambiental (IRA)
 * Baseado nas faixas e pesos definidos no documento de ajustes
 */

// Classifica cada variável em 0 (baixo), 1 (moderado), 2 (alto)
function classifyVariable(variable, value) {
  switch (variable) {
    case 'temperature':
      if (value > 32) return 2
      if (value >= 28) return 1
      return 0

    case 'humidity':
      if (value > 85) return 2
      if (value >= 70) return 1
      return 0

    case 'rain': // probabilidade de chuva em %
      if (value > 70) return 2
      if (value >= 40) return 1
      return 0

    case 'wind': // m/s
      if (value > 10) return 2
      if (value >= 5) return 1
      return 0

    case 'mq135': // ADC
      if (value > 2500) return 2
      if (value > 1200) return 1
      return 0

    case 'sw420': // 0=sem vibração, 1=ocasional, 2=contínua
      if (value >= 2) return 2
      if (value >= 1) return 1
      return 0

    default:
      return 0
  }
}

// Pesos de cada variável (total = 100%)
const WEIGHTS = {
  rain: 0.30,
  humidity: 0.20,
  wind: 0.20,
  temperature: 0.15,
  sw420: 0.10,
  mq135: 0.05,
}

/**
 * Calcula o IRA (0-100)
 * @param {object} data - { temperature, humidity, rain, wind, mq135, sw420 }
 * @returns {object} - { score, level, label, breakdown }
 */
export function calculateIRA(data) {
  const {
    temperature = 25,
    humidity = 60,
    rain = 0,
    wind = 0,
    mq135 = 0,
    sw420 = 0,
  } = data

  const classifications = {
    temperature: classifyVariable('temperature', temperature),
    humidity: classifyVariable('humidity', humidity),
    rain: classifyVariable('rain', rain),
    wind: classifyVariable('wind', wind),
    mq135: classifyVariable('mq135', mq135),
    sw420: classifyVariable('sw420', sw420),
  }

  // IRA = soma ponderada normalizada para 0-100
  // Cada variável tem valor 0, 1 ou 2 → máximo ponderado = 2.0
  let weighted = 0
  for (const [variable, weight] of Object.entries(WEIGHTS)) {
    weighted += classifications[variable] * weight
  }

  // Normalizar para 0-100 (máximo possível é 2.0)
  const score = Math.round((weighted / 2.0) * 100)

  // Nível de risco
  let level, label, color
  if (score >= 60) {
    level = 'alerta'
    label = 'ALTO'
    color = '#ef4444'
  } else if (score >= 30) {
    level = 'atencao'
    label = 'MODERADO'
    color = '#eab308'
  } else {
    level = 'normal'
    label = 'BAIXO'
    color = '#22c55e'
  }

  return {
    score,
    level,
    label,
    color,
    breakdown: classifications,
  }
}
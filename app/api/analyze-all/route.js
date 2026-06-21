import { supabase } from '@/lib/supabase'

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY

  // Buscar todas as províncias
  const { data: provinces } = await supabase
    .from('provinces')
    .select('id, name')

  if (!provinces) {
    return Response.json({ error: 'Não foi possível obter as províncias' }, { status: 500 })
  }

  const results = []

  for (const province of provinces) {
    try {
      // Buscar o dado meteorológico mais recente desta província
      const { data: weatherRows } = await supabase
        .from('weather_data')
        .select('*')
        .eq('province_id', province.id)
        .order('recorded_at', { ascending: false })
        .limit(1)

      const weather = weatherRows?.[0]
      if (!weather) {
        results.push({ province: province.name, skipped: true, reason: 'sem dados meteorológicos' })
        continue
      }

      const prompt = `Você é um analista ambiental angolano. Com base nos dados meteorológicos abaixo da província de ${province.name}, escreva um relatório técnico curto (máximo 4 frases) em português de Angola, destacando riscos preventivos e recomendações práticas.

Temperatura: ${weather.temperature}°C
Humidade: ${weather.humidity}%
Vento: ${weather.wind_speed} m/s
Condição: ${weather.description}

Responda apenas com o relatório, sem introduções.`

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 300,
        }),
      })

      const data = await res.json()

      if (data.error) {
        results.push({ province: province.name, error: data.error.message })
        continue
      }

      const reportText = data.choices[0].message.content

      // Calcular risk_score
      let riskScore = 20
      if (weather.humidity > 85) riskScore += 25
      if (weather.temperature > 28) riskScore += 25
      if (weather.wind_speed > 5) riskScore += 15
      if (riskScore > 100) riskScore = 100

      await supabase.from('reports').insert({
        province_id: province.id,
        content: reportText,
        summary: reportText.slice(0, 150),
        risk_score: riskScore,
      })

      results.push({ province: province.name, risk_score: riskScore, success: true })

      // Pequena pausa para não saturar o rate limit do Groq
      await new Promise((resolve) => setTimeout(resolve, 2500))
    } catch (err) {
      results.push({ province: province.name, error: err.message })
    }
  }

  return Response.json({ success: true, total: results.length, results })
}
import { supabase } from '@/lib/supabase'
import { calculateIRA } from '@/lib/ira'

export async function POST(request) {
  const { provinceId, provinceName, temperature, humidity, windSpeed, description } = await request.json()

  const apiKey = process.env.GROQ_API_KEY

  try {
    // Buscar probabilidade de chuva mais recente (não vem no body do request)
    const { data: weatherRows } = await supabase
      .from('weather_data')
      .select('rain_probability')
      .eq('province_id', provinceId)
      .order('recorded_at', { ascending: false })
      .limit(1)

    const rainProb = weatherRows?.[0]?.rain_probability || 0

    // Buscar últimas leituras de sensores da província
    const { data: sensorReadings } = await supabase
      .from('sensor_readings')
      .select('*, sensors(sensor_type)')
      .eq('province_id', provinceId)
      .order('recorded_at', { ascending: false })
      .limit(10)

    let mq135Value = 0
    let sw420Value = 0
    sensorReadings?.forEach((r) => {
      const type = r.sensors?.sensor_type || r.sensor_type || ''
      if (type.includes('MQ') || type.includes('mq')) mq135Value = r.value
      if (type.includes('SW') || type.includes('sw')) sw420Value = r.value
    })

    // Calcular IRA com as mesmas faixas e pesos usados no resto do sistema
    const ira = calculateIRA({
      temperature,
      humidity,
      rain: rainProb,
      wind: windSpeed,
      mq135: mq135Value,
      sw420: sw420Value,
    })

    const prompt = `Você é um analista ambiental angolano. Com base nos dados abaixo da província de ${provinceName}, escreva um relatório técnico curto (máximo 4 frases) em português de Angola, destacando riscos preventivos e recomendações práticas baseados APENAS nos dados fornecidos.

Temperatura: ${temperature}°C
Humidade: ${humidity}%
Vento: ${windSpeed} m/s
Probabilidade de Chuva: ${rainProb}%
Qualidade do Ar MQ135: ${mq135Value}%
Vibração SW420: ${sw420Value}%
Condição: ${description}
IRA calculado: ${ira.score}/100 (${ira.label})

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
      return Response.json({ error: data.error.message }, { status: 500 })
    }

    const report = data.choices[0].message.content

    // Gravar no Supabase com o risk_score consistente com o resto do sistema
    const { data: saved, error: saveError } = await supabase
      .from('reports')
      .insert({
        province_id: provinceId,
        content: report,
        summary: report.slice(0, 150),
        risk_score: ira.score,
      })
      .select()
      .single()

    if (saveError) {
      return Response.json({ error: saveError.message }, { status: 500 })
    }

    return Response.json({ success: true, report: saved, ira_level: ira.level, ira_label: ira.label })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
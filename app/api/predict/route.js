import { supabase } from '@/lib/supabase'
import { predictTrend } from '@/lib/predict'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const provinceId = searchParams.get('province_id')
  const apiKey = process.env.GROQ_API_KEY

  if (!provinceId) {
    return Response.json({ error: 'province_id obrigatório' }, { status: 400 })
  }

  try {
    const { data: province } = await supabase
      .from('provinces')
      .select('name')
      .eq('id', provinceId)
      .single()

    // Histórico de meteorologia (últimas 20 leituras)
    const { data: weatherRows } = await supabase
      .from('weather_data')
      .select('temperature, humidity, wind_speed, rain_probability, recorded_at')
      .eq('province_id', provinceId)
      .order('recorded_at', { ascending: false })
      .limit(20)

    // Histórico de sensores (últimas 20 leituras de cada tipo)
    const { data: sensorRows } = await supabase
      .from('sensor_readings')
      .select('value, sensor_type, recorded_at')
      .eq('province_id', provinceId)
      .order('recorded_at', { ascending: false })
      .limit(40)

    const mq135Readings = sensorRows?.filter(r => r.sensor_type === 'MQ-135')
      .map(r => ({ value: r.value, recorded_at: r.recorded_at })) || []
    const sw420Readings = sensorRows?.filter(r => r.sensor_type === 'SW-420')
      .map(r => ({ value: r.value, recorded_at: r.recorded_at })) || []

    const tempReadings = weatherRows?.map(r => ({ value: r.temperature, recorded_at: r.recorded_at })) || []
    const humidityReadings = weatherRows?.map(r => ({ value: r.humidity, recorded_at: r.recorded_at })) || []
    const windReadings = weatherRows?.map(r => ({ value: r.wind_speed, recorded_at: r.recorded_at })) || []
    const rainReadings = weatherRows?.map(r => ({ value: r.rain_probability || 0, recorded_at: r.recorded_at })) || []

    // Tendências calculadas (regressão linear) — cada uma com o seu limite realista
    const predictions = {
      temperature: predictTrend(tempReadings, 3, { min: 10, max: 45 }),
      humidity: predictTrend(humidityReadings, 3, { min: 0, max: 100 }),
      wind: predictTrend(windReadings, 3, { min: 0, max: 40 }),
      rain: predictTrend(rainReadings, 3, { min: 0, max: 100 }),
      mq135: predictTrend(mq135Readings, 3, { min: 0, max: 100 }),
      sw420: predictTrend(sw420Readings, 3, { min: 0, max: 100 }),
    }

    // Verificar se há dados suficientes para pedir à IA
    const temDados = Object.values(predictions).some(p => p !== null)
    if (!temDados) {
      return Response.json({ error: 'Dados históricos insuficientes para previsão' }, { status: 400 })
    }

   const prompt = `Você é um analista ambiental angolano especializado em previsão de curto prazo. Com base nas TENDÊNCIAS calculadas abaixo (extrapolação estatística das últimas leituras) para a província de ${province?.name}, responda APENAS com um objecto JSON válido (sem markdown, sem texto antes ou depois):

{
  "previsao_texto": "previsão curta em português de Angola, máximo 3 frases, sobre o que esperar nas próximas 3 horas",
  "risco_previsto": "Baixo, Moderado ou Alto — nível de risco esperado nas próximas 3 horas",
  "alerta_preventivo": "recomendação prática se o risco previsto for Moderado ou Alto, ou null se Baixo"
}

IMPORTANTE — escalas dos sensores (0-100%, quanto MAIOR o valor, PIOR/mais perigoso é):
- MQ135 (qualidade do ar): 0-39% Boa | 40-59% Moderada | 60-79% Má | 80-100% Perigosa (valores altos = ar poluído, NÃO "boa qualidade")
- SW420 (vibração/risco estrutural): 0-29% Normal | 30-59% Ocasional | 60-100% Intensa (valores altos = vibração perigosa)

Tendências calculadas (extrapolação linear, não é garantido):
${predictions.temperature ? `Temperatura: actual ${predictions.temperature.current}°C → previsto ${predictions.temperature.predicted}°C (${predictions.temperature.trend})` : 'Temperatura: sem dados suficientes'}
${predictions.humidity ? `Humidade: actual ${predictions.humidity.current}% → previsto ${predictions.humidity.predicted}% (${predictions.humidity.trend})` : 'Humidade: sem dados suficientes'}
${predictions.wind ? `Vento: actual ${predictions.wind.current} m/s → previsto ${predictions.wind.predicted} m/s (${predictions.wind.trend})` : 'Vento: sem dados suficientes'}
${predictions.rain ? `Prob. Chuva: actual ${predictions.rain.current}% → previsto ${predictions.rain.predicted}% (${predictions.rain.trend})` : 'Chuva: sem dados suficientes'}
${predictions.mq135 ? `Índice de Poluição do Ar MQ135: actual ${predictions.mq135.current}% → previsto ${predictions.mq135.predicted}% (${predictions.mq135.trend})` : 'MQ135: sem dados suficientes'}
${predictions.sw420 ? `Índice de Vibração SW420: actual ${predictions.sw420.current}% → previsto ${predictions.sw420.predicted}% (${predictions.sw420.trend})` : 'SW420: sem dados suficientes'}

REGRA: baseie-se APENAS nos números fornecidos. Não invente dados que não estão aqui. Lembre-se: valores altos de MQ135 e SW420 indicam MAIOR risco, não menor.`

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 350,
        response_format: { type: 'json_object' },
      }),
    })

    const data = await res.json()
    if (data.error) {
      return Response.json({ error: data.error.message }, { status: 500 })
    }

    const parsed = JSON.parse(data.choices[0].message.content)

    return Response.json({
      success: true,
      province: province?.name,
      predictions,
      ia: parsed,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
import { supabase } from '@/lib/supabase'
import { calculateIRA } from '@/lib/ira'

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY

  const { data: provinces } = await supabase
    .from('provinces')
    .select('id, name')

  if (!provinces) {
    return Response.json({ error: 'Não foi possível obter as províncias' }, { status: 500 })
  }

  const results = []

  for (const province of provinces) {
    try {
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

      // Buscar última leitura de sensores para esta província (se existir)
      const { data: sensorReadings } = await supabase
        .from('sensor_readings')
        .select('*, sensors(sensor_type)')
        .eq('province_id', province.id)
        .order('recorded_at', { ascending: false })
        .limit(10)

      // Extrair valores dos sensores
      let mq135Value = 0
      let sw420Value = 0
      sensorReadings?.forEach((r) => {
        const type = r.sensors?.sensor_type || r.sensor_type || ''
        if (type.includes('MQ') || type.includes('mq')) mq135Value = r.value
        if (type.includes('SW') || type.includes('sw')) sw420Value = r.value
      })

      // Calcular IRA com as faixas e pesos correctos
      const ira = calculateIRA({
        temperature: weather.temperature,
        humidity: weather.humidity,
        rain: weather.rain_probability || 0,
        wind: weather.wind_speed,
        mq135: mq135Value,
        sw420: sw420Value,
      })

      const rainProb = weather.rain_probability || 0

      const prompt = `Você é um analista ambiental angolano. Com base nos dados abaixo da província de ${province.name}, responda APENAS com um objecto JSON válido (sem markdown, sem texto antes ou depois):

{
  "relatorio": "relatório técnico curto em português de Angola, máximo 4 frases, destacando riscos preventivos e recomendações práticas baseados APENAS nos dados fornecidos",
  "tipo_perigo": "baseado APENAS nos dados fornecidos (não inventes): Chuva Intensa (APENAS se prob_chuva > 40%), Calor Extremo (APENAS se temp > 28°C), Vento Forte (APENAS se vento > 5 m/s), Humidade Elevada (APENAS se humidade > 85%), Seca (APENAS se humidade < 40%), Poluição do Ar (APENAS se MQ135 > 1200), ou Nenhum",
  "nivel_risco": "${ira.level}",
  "mitigacao": "uma frase curta e prática com a principal recomendação de mitigação baseada no perigo identificado"
}

Dados reais da província:
Temperatura: ${weather.temperature}°C ${weather.temperature > 32 ? '→ ALTO' : weather.temperature >= 28 ? '→ MODERADO' : '→ BAIXO'}
Humidade: ${weather.humidity}% ${weather.humidity > 85 ? '→ ALTO' : weather.humidity >= 70 ? '→ MODERADO' : '→ BAIXO'}
Vento: ${weather.wind_speed} m/s ${weather.wind_speed > 10 ? '→ ALTO' : weather.wind_speed >= 5 ? '→ MODERADO' : '→ BAIXO'}
Probabilidade de Chuva (próximas 24h): ${rainProb}% ${rainProb > 70 ? '→ ALTO' : rainProb >= 40 ? '→ MODERADO' : '→ BAIXO'}
Qualidade do Ar MQ135: ${mq135Value} ADC ${mq135Value > 2500 ? '→ ALTO' : mq135Value > 1200 ? '→ MODERADO' : '→ BAIXO'}
Condição actual: ${weather.description}
IRA calculado: ${ira.score}/100 (${ira.label})

REGRA IMPORTANTE: O tipo_perigo deve ser "Nenhum" se nenhuma variável atingir o limiar indicado acima. NÃO classifiques como Chuva Intensa se prob_chuva for ${rainProb}%.`

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
          max_tokens: 400,
          response_format: { type: 'json_object' },
        }),
      })

      const data = await res.json()

      if (data.error) {
        results.push({ province: province.name, error: data.error.message })
        await new Promise((r) => setTimeout(r, 2500))
        continue
      }

      let parsed
      try {
        parsed = JSON.parse(data.choices[0].message.content)
      } catch (e) {
        results.push({ province: province.name, error: 'Resposta da IA não é JSON válido' })
        await new Promise((r) => setTimeout(r, 2500))
        continue
      }

      // Gravar relatório com IRA correcto
      await supabase.from('reports').insert({
        province_id: province.id,
        content: parsed.relatorio,
        summary: parsed.relatorio.slice(0, 150),
        risk_score: ira.score,
      })

      // Gravar alerta se necessário
      if (ira.level !== 'normal' && parsed.tipo_perigo && parsed.tipo_perigo !== 'Nenhum') {
        await supabase
          .from('alerts')
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq('province_id', province.id)
          .eq('is_active', true)

        await supabase.from('alerts').insert({
          province_id: province.id,
          type: parsed.tipo_perigo,
          severity: ira.level,
          title: `${parsed.tipo_perigo} — ${province.name}`,
          description: parsed.mitigacao,
          is_active: true,
        })
      } else {
        await supabase
          .from('alerts')
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq('province_id', province.id)
          .eq('is_active', true)
      }

      results.push({
        province: province.name,
        ira_score: ira.score,
        ira_label: ira.label,
        ira_level: ira.level,
        rain_prob: rainProb,
        tipo_perigo: parsed.tipo_perigo,
        success: true
      })

      await new Promise((r) => setTimeout(r, 2500))
    } catch (err) {
      results.push({ province: province.name, error: err.message })
    }
  }

  return Response.json({ success: true, total: results.length, results })
}
import { supabase } from '@/lib/supabase'

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

      const prompt = `Você é um analista ambiental angolano. Com base nos dados meteorológicos abaixo da província de ${province.name}, responda APENAS com um objecto JSON válido (sem markdown, sem texto antes ou depois), no seguinte formato exacto:

{
  "relatorio": "relatório técnico curto em português de Angola, máximo 4 frases, com riscos preventivos e recomendações práticas",
  "tipo_perigo": "uma palavra ou expressão curta: Chuva Intensa, Calor Extremo, Vento Forte, Poluição do Ar, Seca, ou Nenhum",
  "nivel_risco": "normal, atencao ou alerta",
  "mitigacao": "uma frase curta e prática com a principal recomendação de mitigação"
}

Dados meteorológicos:
Temperatura: ${weather.temperature}°C
Humidade: ${weather.humidity}%
Vento: ${weather.wind_speed} m/s
Condição: ${weather.description}`

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 400,
          response_format: { type: 'json_object' },
        }),
      })

      const data = await res.json()

      if (data.error) {
        results.push({ province: province.name, error: data.error.message })
        await new Promise((resolve) => setTimeout(resolve, 2500))
        continue
      }

      let parsed
      try {
        parsed = JSON.parse(data.choices[0].message.content)
      } catch (e) {
        results.push({ province: province.name, error: 'Resposta da IA não é JSON válido' })
        await new Promise((resolve) => setTimeout(resolve, 2500))
        continue
      }

      // Calcular risk_score numérico (mantemos a lógica numérica como suporte)
      let riskScore = 20
      if (weather.humidity > 85) riskScore += 25
      if (weather.temperature > 28) riskScore += 25
      if (weather.wind_speed > 5) riskScore += 15
      if (riskScore > 100) riskScore = 100

      // Gravar relatório
      await supabase.from('reports').insert({
        province_id: province.id,
        content: parsed.relatorio,
        summary: parsed.relatorio.slice(0, 150),
        risk_score: riskScore,
      })

      // Se o nível de risco indicado pela IA (ou pelo score) for atencao/alerta, gravar um alerta
      const nivel = parsed.nivel_risco === 'alerta' || riskScore >= 60
        ? 'alerta'
        : (parsed.nivel_risco === 'atencao' || riskScore >= 30)
          ? 'atencao'
          : 'normal'

      if (nivel !== 'normal' && parsed.tipo_perigo && parsed.tipo_perigo !== 'Nenhum') {
        // Desactivar alertas antigos desta província antes de criar um novo
        await supabase
          .from('alerts')
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq('province_id', province.id)
          .eq('is_active', true)

        await supabase.from('alerts').insert({
          province_id: province.id,
          type: parsed.tipo_perigo,
          severity: nivel,
          title: `${parsed.tipo_perigo} — ${province.name}`,
          description: parsed.mitigacao,
          is_active: true,
        })
      } else {
        // Se voltou ao normal, desactivar alertas antigos
        await supabase
          .from('alerts')
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq('province_id', province.id)
          .eq('is_active', true)
      }

      results.push({ province: province.name, risk_score: riskScore, nivel, tipo_perigo: parsed.tipo_perigo, success: true })

      await new Promise((resolve) => setTimeout(resolve, 2500))
    } catch (err) {
      results.push({ province: province.name, error: err.message })
    }
  }

  return Response.json({ success: true, total: results.length, results })
}
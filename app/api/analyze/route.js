import { supabase } from '@/lib/supabase'

export async function POST(request) {
  const { provinceId, provinceName, temperature, humidity, windSpeed, description } = await request.json()

  const apiKey = process.env.GROQ_API_KEY

  const prompt = `Você é um analista ambiental angolano. Com base nos dados meteorológicos abaixo da província de ${provinceName}, escreva um relatório técnico curto (máximo 4 frases) em português de Angola, destacando riscos preventivos e recomendações práticas.

Temperatura: ${temperature}°C
Humidade: ${humidity}%
Vento: ${windSpeed} m/s
Condição: ${description}

Responda apenas com o relatório, sem introduções.`

  try {
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

    // Calcular um risk_score simples com base na humidade e temperatura
    let riskScore = 20
    if (humidity > 85) riskScore += 25
    if (temperature > 28) riskScore += 25
    if (windSpeed > 5) riskScore += 15
    if (riskScore > 100) riskScore = 100

    // Gravar no Supabase
    const { data: saved, error: saveError } = await supabase
      .from('reports')
      .insert({
        province_id: provinceId,
        content: report,
        summary: report.slice(0, 150),
        risk_score: riskScore,
      })
      .select()
      .single()

    if (saveError) {
      return Response.json({ error: saveError.message }, { status: 500 })
    }

    return Response.json({ success: true, report: saved })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
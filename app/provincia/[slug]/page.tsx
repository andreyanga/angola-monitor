'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

const ProvinceMap = dynamic(() => import('@/components/ProvinceMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      A carregar mapa...
    </div>
  ),
})

interface Province {
  id: number
  name: string
  capital: string
  area_km2: number
  num_municipios: number
  languages: string
  founded: string
  latitude: number
  longitude: number
}

interface WeatherData {
  temperature: number
  humidity: number
  wind_speed: number
  wind_direction: string
  pressure: number
  description: string
  recorded_at: string
  rain_probability?: number
  forecast_json?: string
}

interface ForecastPoint {
  dt_txt: string
  temp: number
  humidity: number
  wind_speed: number
  rain_prob: number
  description: string
}

interface Municipality {
  id: number
  name: string
  slug: string
  zones: Zone[]
}

interface Zone {
  id: number
  name: string
  slug: string
  latitude: number
  longitude: number
  sensors: Sensor[]
}

interface Sensor {
  id: number
  name: string
  sensor_type: string
  is_active: boolean
  last_reading?: SensorReading
}

interface SensorReading {
  value: number
  unit: string
  sensor_type: string
  status: string
  recorded_at: string
}

interface Report {
  id: number
  content: string
  risk_score: number
  generated_at: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 0.3rem 0' }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, fontSize: '0.75rem', margin: '0.1rem 0', fontWeight: '600' }}>
            {p.name}: {p.value}{p.name === 'Temp' ? '°C' : p.name === 'Vento' ? ' m/s' : '%'}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function ProvinciaPage() {
  const { slug } = useParams()
  const [province, setProvince] = useState<Province | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [history, setHistory] = useState<WeatherData[]>([])
  const [forecast, setForecast] = useState<ForecastPoint[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<Report | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [activeChart, setActiveChart] = useState<'temperatura' | 'vento' | 'chuva'>('temperatura')

  useEffect(() => {
    async function fetchData() {
      const slugStr = Array.isArray(slug) ? slug[0] : slug

      const { data: prov } = await supabase
        .from('provinces')
        .select('*')
        .eq('slug', slugStr)
        .single()

      if (!prov) { setLoading(false); return }
      setProvince(prov)

      const { data: weatherData } = await supabase
        .from('weather_data')
        .select('*')
        .eq('province_id', prov.id)
        .order('recorded_at', { ascending: false })
        .limit(24)

      if (weatherData && weatherData.length > 0) {
        setWeather(weatherData[0])
        setHistory(weatherData)

        // Parsear forecast_json
        if (weatherData[0].forecast_json) {
          try {
            const parsed: ForecastPoint[] = JSON.parse(weatherData[0].forecast_json)
            setForecast(parsed)
          } catch (e) {
            console.error('Erro ao parsear forecast_json')
          }
        }
      }

      const { data: munData } = await supabase
        .from('municipalities')
        .select(`
          id, name, slug,
          zones (
            id, name, slug, latitude, longitude,
            sensors (
              id, name, sensor_type, is_active
            )
          )
        `)
        .eq('province_id', prov.id)

      if (munData) {
        const munWithReadings = await Promise.all(
          munData.map(async (mun: Municipality) => ({
            ...mun,
            zones: await Promise.all(
              mun.zones.map(async (zone: Zone) => ({
                ...zone,
                sensors: await Promise.all(
                  zone.sensors.map(async (sensor: Sensor) => {
                    const { data: reading } = await supabase
                      .from('sensor_readings')
                      .select('*')
                      .eq('sensor_id', sensor.id)
                      .order('recorded_at', { ascending: false })
                      .limit(1)
                      .single()
                    return { ...sensor, last_reading: reading || null }
                  })
                )
              }))
            )
          }))
        )
        setMunicipalities(munWithReadings)
      }

      const { data: lastReport } = await supabase
        .from('reports')
        .select('*')
        .eq('province_id', prov.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastReport) setReport(lastReport)
      setLoading(false)
    }
    fetchData()
  }, [slug])

  async function gerarRelatorio() {
    if (!province || !weather) return
    setGeneratingReport(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provinceId: province.id,
          provinceName: province.name,
          temperature: weather.temperature,
          humidity: weather.humidity,
          windSpeed: weather.wind_speed,
          description: weather.description,
        }),
      })
      const data = await res.json()
      if (data.success) setReport(data.report)
    } catch (err) {
      console.error(err)
    }
    setGeneratingReport(false)
  }

  if (loading) return (
    <div style={{ background: '#060f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>A carregar...</p>
    </div>
  )

  if (!province) return (
    <div style={{ background: '#060f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>Província não encontrada.</p>
    </div>
  )

  const getWindDirection = (deg: string) => {
    const d = parseInt(deg)
    if (d >= 337 || d < 23) return 'Norte'
    if (d < 68) return 'Nordeste'
    if (d < 113) return 'Leste'
    if (d < 158) return 'Sudeste'
    if (d < 203) return 'Sul'
    if (d < 248) return 'Sudoeste'
    if (d < 293) return 'Oeste'
    return 'Noroeste'
  }

  const getRiskColor = (score: number) => {
    if (score >= 60) return '#ef4444'
    if (score >= 30) return '#eab308'
    return '#22c55e'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 60) return 'Alto'
    if (score >= 30) return 'Moderado'
    return 'Baixo'
  }

  // Formatar dados do forecast para o gráfico
  const chartData = forecast.map((f) => ({
    hora: f.dt_txt.slice(5, 16).replace(' ', ' ').replace('-', '/'),
    Temp: f.temp,
    Humidade: f.humidity,
    Vento: f.wind_speed,
    Chuva: f.rain_prob,
  }))

  // Resumo da previsão por dia
  const forecastByDay: Record<string, ForecastPoint[]> = {}
  forecast.forEach((f) => {
    const day = f.dt_txt.slice(0, 10)
    if (!forecastByDay[day]) forecastByDay[day] = []
    forecastByDay[day].push(f)
  })

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <main style={{ background: '#060f1e', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <header style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 100%)',
        borderBottom: '1px solid #1e3a5f',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>{province.name}</h1>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>Capital: {province.capital}</p>
          </div>
        </div>
        <div style={{ background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: '20px', padding: '0.3rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: '600' }}>Dados em Tempo Real</span>
        </div>
      </header>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* INFO CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Capital', value: province.capital, icon: '🏛️', color: '#3b82f6' },
            { label: 'Área', value: province.area_km2 ? `${province.area_km2.toLocaleString()} km²` : 'N/D', icon: '📐', color: '#8b5cf6' },
            { label: 'Municípios', value: province.num_municipios || 'N/D', icon: '🏘️', color: '#f59e0b' },
            { label: 'Sensores Activos', value: municipalities.reduce((acc, m) => acc + m.zones.reduce((a, z) => a + z.sensors.filter(s => s.is_active).length, 0), 0), icon: '📡', color: '#22c55e' },
          ].map((card) => (
            <div key={card.label} style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              border: `1px solid ${card.color}33`,
              borderRadius: '12px', padding: '1.2rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
              <div style={{ background: `${card.color}22`, borderRadius: '10px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                {card.icon}
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0 0 0.2rem 0', textTransform: 'uppercase' }}>{card.label}</p>
                <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* MAPA + METEOROLOGIA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>🗺️ Mapa da Província</h2>
            <ProvinceMap
              provinceName={province.name}
              latitude={province.latitude}
              longitude={province.longitude}
              municipalities={municipalities}
            />
          </div>

          {weather && (
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
              <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>Condições Meteorológicas Actuais</h2>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Temperatura</p>
                <p style={{ color: '#f59e0b', fontSize: '4rem', fontWeight: '800', margin: 0 }}>{weather.temperature}°C</p>
                <p style={{ color: '#94a3b8', fontSize: '1rem', margin: '0.5rem 0 0 0', textTransform: 'capitalize' }}>{weather.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Humidade', value: `${weather.humidity}%`, icon: '💧', color: '#06b6d4' },
                  { label: 'Vento', value: `${weather.wind_speed} m/s`, icon: '💨', color: '#8b5cf6' },
                  { label: 'Direcção', value: getWindDirection(weather.wind_direction), icon: '🧭', color: '#f59e0b' },
                  { label: 'Pressão', value: `${weather.pressure} hPa`, icon: '📊', color: '#22c55e' },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#0f172a', borderRadius: '10px', padding: '1rem', textAlign: 'center', border: `1px solid ${item.color}22` }}>
                    <p style={{ fontSize: '1.5rem', margin: '0 0 0.3rem 0' }}>{item.icon}</p>
                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '1rem', margin: '0 0 0.2rem 0' }}>{item.value}</p>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PREVISÃO 48H */}
        {forecast.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid #1e3a5f',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                📈 Previsão para as Próximas 48h
              </h2>
              {/* Tabs para trocar variável */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[
                  { key: 'temperatura', label: '🌡️ Temp' },
                  { key: 'vento', label: '💨 Vento' },
                  { key: 'chuva', label: '🌧️ Chuva' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveChart(tab.key as any)}
                    style={{
                      background: activeChart === tab.key ? '#22c55e22' : '#0f172a',
                      border: `1px solid ${activeChart === tab.key ? '#22c55e55' : '#334155'}`,
                      color: activeChart === tab.key ? '#22c55e' : '#64748b',
                      padding: '0.3rem 0.7rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo por dia */}
            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.2rem', overflowX: 'auto' }}>
              {Object.entries(forecastByDay).map(([day, points]) => {
                const maxTemp = Math.max(...points.map(p => p.temp))
                const minTemp = Math.min(...points.map(p => p.temp))
                const maxWind = Math.max(...points.map(p => p.wind_speed))
                const maxRain = Math.max(...points.map(p => p.rain_prob))
                const date = new Date(day)
                const dayName = dayNames[date.getDay()]
                return (
                  <div key={day} style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    padding: '0.8rem',
                    minWidth: '90px',
                    textAlign: 'center',
                    border: '1px solid #1e3a5f',
                    flexShrink: 0
                  }}>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0 0 0.3rem 0', fontWeight: '600' }}>{dayName}</p>
                    <p style={{ color: '#475569', fontSize: '0.65rem', margin: '0 0 0.5rem 0' }}>{day.slice(5)}</p>
                    <p style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.2rem 0' }}>
                      {maxTemp.toFixed(0)}° / {minTemp.toFixed(0)}°
                    </p>
                    <p style={{ color: '#8b5cf6', fontSize: '0.75rem', margin: '0 0 0.2rem 0' }}>
                      💨 {maxWind.toFixed(1)} m/s
                    </p>
                    <p style={{ color: maxRain > 40 ? '#ef4444' : '#3b82f6', fontSize: '0.75rem', margin: 0 }}>
                      🌧️ {maxRain}%
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Gráfico */}
            <ResponsiveContainer width="100%" height={220}>
              {activeChart === 'temperatura' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="Temp" stroke="#f59e0b" strokeWidth={2} dot={false} name="Temp" />
                  <Line type="monotone" dataKey="Humidade" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Humidade" strokeDasharray="4 2" />
                </LineChart>
              ) : activeChart === 'vento' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="Vento" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Vento" />
                  {/* Linha de referência de risco */}
                  <Line type="monotone" data={chartData.map(d => ({ ...d, Limite: 5 }))} dataKey="Limite" stroke="#eab308" strokeWidth={1} dot={false} strokeDasharray="6 3" name="Limite Moderado" />
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                  <Bar dataKey="Chuva" fill="#3b82f6" opacity={0.8} name="Chuva" radius={[2, 2, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* RELATÓRIO DE IA */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          border: '1px solid #3b82f644',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>🤖 Relatório Inteligente (IA)</h2>
            <button
              onClick={gerarRelatorio}
              disabled={generatingReport || !weather}
              style={{
                background: generatingReport ? '#334155' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none',
                fontWeight: '600', fontSize: '0.8rem', cursor: generatingReport ? 'default' : 'pointer',
              }}
            >
              {generatingReport ? 'A gerar análise...' : report ? 'Gerar Novo Relatório' : 'Gerar Relatório'}
            </button>
          </div>
          {report ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                <div style={{ background: `${getRiskColor(report.risk_score)}22`, border: `1px solid ${getRiskColor(report.risk_score)}55`, borderRadius: '20px', padding: '0.3rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getRiskColor(report.risk_score) }} />
                  <span style={{ color: getRiskColor(report.risk_score), fontSize: '0.75rem', fontWeight: '700' }}>
                    {getRiskLabel(report.risk_score)} ({report.risk_score}/100)
                  </span>
                </div>
                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                  Gerado em {new Date(report.generated_at).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>{report.content}</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#475569' }}>
              <p style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>🤖</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Ainda não foi gerado nenhum relatório de IA para esta província.</p>
            </div>
          )}
        </div>

        {/* HISTÓRICO 24H */}
        {history.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.2rem 0' }}>
              🕐 Histórico das Últimas 24h
            </h2>

            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={[...history].reverse().map((h) => ({
                  hora: new Date(h.recorded_at).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                  Temp: h.temperature,
                  Humidade: h.humidity,
                  Vento: h.wind_speed,
                }))}
                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="Temp" stroke="#f59e0b" strokeWidth={2} dot={false} name="Temp" />
                <Line type="monotone" dataKey="Humidade" stroke="#06b6d4" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Humidade" />
                <Line type="monotone" dataKey="Vento" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="2 2" name="Vento" />
              </LineChart>
            </ResponsiveContainer>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.8rem',
                  background: i === 0 ? '#22c55e11' : '#0f172a',
                  borderRadius: '8px',
                  border: i === 0 ? '1px solid #22c55e33' : '1px solid transparent'
                }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                    {new Date(h.recorded_at).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.8rem' }}>{h.temperature}°C</span>
                  <span style={{ color: '#06b6d4', fontSize: '0.8rem' }}>{h.humidity}%</span>
                  <span style={{ color: '#8b5cf6', fontSize: '0.8rem' }}>{h.wind_speed} m/s</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'capitalize' }}>{h.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MUNICÍPIOS E SENSORES */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>📡 Municípios com Sensores IoT</h2>
          {municipalities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
              <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>📡</p>
              <p style={{ margin: 0 }}>Nenhum sensor instalado nesta província ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {municipalities.map((mun) => (
                <div key={mun.id} style={{ background: '#0f172a', borderRadius: '12px', padding: '1.2rem', border: '1px solid #1e3a5f' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>🏘️ {mun.name}</h3>
                    <button
                      onClick={() => window.location.href = `/municipio/${mun.slug}`}
                      style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Ver município
                    </button>
                  </div>
                  {mun.zones.map((zone) => (
                    <div key={zone.id} style={{ marginLeft: '1rem', marginBottom: '0.8rem' }}>
                      <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>
                        📍 Zona: <span style={{ color: '#94a3b8' }}>{zone.name}</span>
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem', marginLeft: '1rem' }}>
                        {zone.sensors.map((sensor) => (
                          <div key={sensor.id} style={{
                            background: '#1e293b', borderRadius: '8px', padding: '0.8rem 1rem',
                            border: `1px solid ${sensor.is_active ? '#22c55e33' : '#ef444433'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                          }}>
                            <div>
                              <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600', margin: '0 0 0.2rem 0' }}>{sensor.name}</p>
                              <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{sensor.sensor_type}</p>
                              {sensor.last_reading ? (
                                <p style={{ color: '#22c55e', fontSize: '0.75rem', margin: '0.3rem 0 0 0' }}>
                                  Última leitura: {sensor.last_reading.value} {sensor.last_reading.unit}
                                </p>
                              ) : (
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0.3rem 0 0 0' }}>Sem leituras ainda</p>
                              )}
                            </div>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: sensor.is_active ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INFO PROVINCIA */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Informações da Província</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.3rem 0', textTransform: 'uppercase' }}>Línguas</p>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>{province.languages || 'N/D'}</p>
            </div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.3rem 0', textTransform: 'uppercase' }}>Número de Municípios</p>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>{province.num_municipios || 'N/D'}</p>
            </div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.3rem 0', textTransform: 'uppercase' }}>Área Total</p>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>{province.area_km2 ? `${province.area_km2.toLocaleString()} km²` : 'N/D'}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
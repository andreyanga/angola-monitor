'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Sensor {
  id: number
  name: string
  is_active: boolean
  is_online: boolean
  last_seen: string
  sensor_type: string
  mac_address: string
  installed_at: string
  zones: { name: string; latitude: number; longitude: number }
  municipalities: { name: string }
  provinces: { id: number; name: string; slug: string }
  mq135_last?: { value: number; unit: string; status: string; recorded_at: string } | null
  sw420_last?: { value: number; unit: string; status: string; recorded_at: string } | null
}

interface SensorReading {
  id: number
  value: number
  unit: string
  sensor_type: string
  status: string
  recorded_at: string
}

interface WeatherData {
  temperature: number
  humidity: number
  wind_speed: number
  description: string
  rain_probability: number
  recorded_at: string
}

// Formata uma data vinda da BD garantindo o fuso horário de Angola (Africa/Luanda),
// mesmo que a string não venha com indicação explícita de timezone (Z / +00:00).
function formatAO(dateStr: string | null | undefined, opts: Intl.DateTimeFormatOptions) {
  if (!dateStr) return '—'
  const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr)
  const isoUTC = hasTZ ? dateStr : `${dateStr}Z`
  return new Date(isoUTC).toLocaleString('pt-AO', { ...opts, timeZone: 'Africa/Luanda' })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0 0 0.3rem 0' }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, fontSize: '0.75rem', margin: '0.1rem 0', fontWeight: '600' }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function CentralPage() {
  const { id } = useParams()
  const [sensor, setSensor] = useState<Sensor | null>(null)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const sensorId = Array.isArray(id) ? id[0] : id

      // Buscar dados da central
      const { data: rawSensorData } = await supabase
          .from('sensors')
          .select(`
              id, name, is_active, is_online, last_seen, sensor_type, mac_address, installed_at,
              zones (name, latitude, longitude),
              municipalities (name),
              provinces (id, name, slug)
          `)
          .eq('id', sensorId)
          .single()

            if (!rawSensorData) { setLoading(false); return }
            const sensorData = rawSensorData as unknown as Sensor
            setSensor(sensorData)

      // Buscar leituras do sensor
      const { data: readingData } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('sensor_id', sensorId)
        .order('recorded_at', { ascending: false })
        .limit(50)

      setReadings(readingData || [])

      // Buscar dados meteorológicos da província
      const { data: weatherData } = await supabase
        .from('weather_data')
        .select('*')
        .eq('province_id', sensorData.provinces?.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      if (weatherData) setWeather(weatherData)

      setLoading(false)
    }
    fetchData()

    const interval = setInterval(fetchData, 30 * 1000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) return (
    <div style={{ background: '#060f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>A carregar...</p>
    </div>
  )

  if (!sensor) return (
    <div style={{ background: '#060f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>Central não encontrada.</p>
    </div>
  )

  // Separar leituras por tipo de sensor
  const mq135Readings = readings.filter(r =>
    r.sensor_type?.includes('MQ') || r.sensor_type?.includes('mq') || r.sensor_type?.includes('135')
  )
  const sw420Readings = readings.filter(r =>
    r.sensor_type?.includes('SW') || r.sensor_type?.includes('sw') || r.sensor_type?.includes('420')
  )

  const lastMQ135 = mq135Readings[0]
  const lastSW420 = sw420Readings[0]

  // Dados para gráfico de histórico
  const chartData = [...readings].reverse().slice(-24).map((r) => ({
    hora: formatAO(r.recorded_at, { hour: '2-digit', minute: '2-digit' }),
    Valor: r.value,
    tipo: r.sensor_type,
  }))

  const getStatusColor = () => {
  if (!sensor.is_active) return '#64748b'
  if (!sensor.is_online) return '#ef4444'
  return '#22c55e'
}

  const getMQ135Status = (value: number) => {
    if (value > 2500) return { label: 'ALTO', color: '#ef4444' }
    if (value > 1200) return { label: 'MODERADO', color: '#eab308' }
    return { label: 'BAIXO', color: '#22c55e' }
  }

  const getSW420Status = (value: number) => {
    if (value >= 2) return { label: 'Vibração Intensa', color: '#ef4444' }
    if (value >= 1) return { label: 'Vibração Ocasional', color: '#eab308' }
    return { label: 'Sem Vibração', color: '#22c55e' }
  }

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
            onClick={() => window.history.back()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
              📡 {sensor.name}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
              {sensor.zones?.name} — {sensor.municipalities?.name} — {sensor.provinces?.name}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getStatusColor(), animation: sensor.is_active ? 'pulse 2s infinite' : 'none' }} />
          <span style={{ color: getStatusColor(), fontSize: '0.85rem', fontWeight: '600' }}>
           {!sensor.is_active ? 'Central Inactiva' : sensor.is_online ? 'Central Activa' : 'Central Offline'}
</span>
        </div>
      </header>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* INFO CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Localização', value: sensor.zones?.name, icon: '📍', color: '#3b82f6' },
            { label: 'Município', value: sensor.municipalities?.name, icon: '🏘️', color: '#8b5cf6' },
            { label: 'Província', value: sensor.provinces?.name, icon: '🏛️', color: '#f59e0b' },
            { label: 'Tipo de Sensor', value: sensor.sensor_type, icon: '🔬', color: '#22c55e' },
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
                <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* LEITURAS ACTUAIS + METEOROLOGIA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* LEITURAS DOS SENSORES */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>
               Leituras dos Sensores
            </h2>

            {!sensor.is_online && readings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>⚫</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Central offline — sem dados disponíveis.</p>
              </div>
            ) : readings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>📡</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Aguardando primeiras leituras do sensor...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* MQ-135 */}
                <div style={{
                  background: '#0f172a', borderRadius: '12px', padding: '1.2rem',
                  border: `1px solid ${lastMQ135 ? getMQ135Status(lastMQ135.value).color + '44' : '#1e3a5f'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 0.2rem 0', fontWeight: '600' }}>MQ-135</p>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>Qualidade do Ar</p>
                    </div>
                    {lastMQ135 && (
                      <span style={{
                        color: getMQ135Status(lastMQ135.value).color,
                        fontSize: '0.65rem', fontWeight: '700',
                        background: `${getMQ135Status(lastMQ135.value).color}22`,
                        padding: '0.15rem 0.5rem', borderRadius: '4px'
                      }}>
                        {getMQ135Status(lastMQ135.value).label}
                      </span>
                    )}
                  </div>
                  <p style={{ color: lastMQ135 ? getMQ135Status(lastMQ135.value).color : '#475569', fontSize: '2rem', fontWeight: '800', margin: '0 0 0.2rem 0' }}>
                    {lastMQ135 ? `${lastMQ135.value} ADC` : '— ADC'}
                  </p>
                  <p style={{ color: '#475569', fontSize: '0.65rem', margin: 0 }}>
                    Faixas: 0–1200 Baixo · 1201–2500 Moderado · &gt;2500 Alto
                  </p>
                  {lastMQ135 && (
                    <p style={{ color: '#334155', fontSize: '0.65rem', margin: '0.3rem 0 0 0' }}>
                      Última leitura: {formatAO(lastMQ135.recorded_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* SW-420 */}
                <div style={{
                  background: '#0f172a', borderRadius: '12px', padding: '1.2rem',
                  border: `1px solid ${lastSW420 ? getSW420Status(lastSW420.value).color + '44' : '#1e3a5f'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 0.2rem 0', fontWeight: '600' }}>SW-420</p>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>Vibração</p>
                    </div>
                    {lastSW420 && (
                      <span style={{
                        color: getSW420Status(lastSW420.value).color,
                        fontSize: '0.65rem', fontWeight: '700',
                        background: `${getSW420Status(lastSW420.value).color}22`,
                        padding: '0.15rem 0.5rem', borderRadius: '4px'
                      }}>
                        {getSW420Status(lastSW420.value).label}
                      </span>
                    )}
                  </div>
                  <p style={{ color: lastSW420 ? getSW420Status(lastSW420.value).color : '#475569', fontSize: '2rem', fontWeight: '800', margin: '0 0 0.2rem 0' }}>
                    {lastSW420 ? getSW420Status(lastSW420.value).label : '— Sem dados'}
                  </p>
                  <p style={{ color: '#475569', fontSize: '0.65rem', margin: 0 }}>
                    Faixas: 0 Sem vibração · 1 Ocasional · 2+ Intensa
                  </p>
                  {lastSW420 && (
                    <p style={{ color: '#334155', fontSize: '0.65rem', margin: '0.3rem 0 0 0' }}>
                      Última leitura: {formatAO(lastSW420.recorded_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* METEOROLOGIA LOCAL */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>
              🌤️ Condições Meteorológicas Locais
            </h2>
            {weather ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.3rem 0', textTransform: 'uppercase' }}>Temperatura</p>
                  <p style={{ color: '#f59e0b', fontSize: '3.5rem', fontWeight: '800', margin: 0 }}>{weather.temperature}°C</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.3rem 0 0 0', textTransform: 'capitalize' }}>{weather.description}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem' }}>
                  {[
                    { label: 'Prob. Chuva', value: `${weather.rain_probability ?? 0}%`, icon: '🌧️', color: '#3b82f6' },
                    { label: 'Vento', value: `${weather.wind_speed} m/s`, icon: '💨', color: '#8b5cf6' },
                    { label: 'Humidade', value: `${weather.humidity}%`, icon: '💧', color: '#06b6d4' },
                    { label: 'Actualizado', value: formatAO(weather.recorded_at, { hour: '2-digit', minute: '2-digit' }), icon: '🕐', color: '#22c55e' },
                  ].map((item) => (
                    <div key={item.label} style={{ background: '#0f172a', borderRadius: '10px', padding: '0.8rem', textAlign: 'center', border: `1px solid ${item.color}22` }}>
                      <p style={{ fontSize: '1.2rem', margin: '0 0 0.2rem 0' }}>{item.icon}</p>
                      <p style={{ color: '#fff', fontWeight: '700', fontSize: '0.95rem', margin: '0 0 0.1rem 0' }}>{item.value}</p>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                <p style={{ margin: 0 }}>Sem dados meteorológicos disponíveis.</p>
              </div>
            )}
          </div>
        </div>

        {/* HISTÓRICO DE LEITURAS */}
        {readings.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.2rem 0' }}>
               Histórico de Leituras
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="Valor" stroke="#22c55e" strokeWidth={2} dot={false} name="Valor" />
              </LineChart>
            </ResponsiveContainer>

            {/* Tabela de leituras recentes */}
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
              {readings.slice(0, 20).map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.8rem',
                  background: i === 0 ? '#22c55e11' : '#0f172a',
                  borderRadius: '8px',
                  border: i === 0 ? '1px solid #22c55e33' : '1px solid transparent'
                }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                    {formatAO(r.recorded_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{r.sensor_type}</span>
                  <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '0.8rem' }}>{r.value} {r.unit}</span>
                  <span style={{
                    color: r.status === 'alerta' ? '#ef4444' : r.status === 'atencao' ? '#eab308' : '#22c55e',
                    fontSize: '0.65rem', fontWeight: '700',
                    background: r.status === 'alerta' ? '#ef444422' : r.status === 'atencao' ? '#eab30822' : '#22c55e22',
                    padding: '0.1rem 0.4rem', borderRadius: '4px'
                  }}>
                    {r.status?.toUpperCase() || 'NORMAL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INFO TÉCNICA */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>
             Informações Técnicas
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Endereço MAC', value: sensor.mac_address || 'N/D' },
              { label: 'Data de Instalação', value: sensor.installed_at ? formatAO(sensor.installed_at, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/D' },
              { label: 'Total de Leituras', value: readings.length.toString() },
            ].map((item) => (
              <div key={item.label}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.3rem 0', textTransform: 'uppercase' }}>{item.label}</p>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0, fontFamily: 'monospace' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </main>
  )
}
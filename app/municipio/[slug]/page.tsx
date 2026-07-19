'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

// Formata uma data vinda da BD garantindo o fuso horário de Angola (Africa/Luanda),
// mesmo que a string não venha com indicação explícita de timezone (Z / +00:00).
function formatAO(dateStr: string | null | undefined, opts: Intl.DateTimeFormatOptions) {
  if (!dateStr) return '—'
  const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr)
  const isoUTC = hasTZ ? dateStr : `${dateStr}Z`
  return new Date(isoUTC).toLocaleString('pt-AO', { ...opts, timeZone: 'Africa/Luanda' })
}

interface Municipality {
  id: number
  name: string
  slug: string
  latitude: number
  longitude: number
  province_id: number
  provinces?: { name: string; slug: string }
}

interface Zone {
  id: number
  name: string
  latitude: number
  longitude: number
  sensors: Sensor[]
}

interface Sensor {
  id: number
  name: string
  sensor_type: string
  is_active: boolean
  is_online: boolean
  last_seen: string
  mac_address: string
  last_reading?: SensorReading
}

interface SensorReading {
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

export default function MunicipioPage() {
  const { slug } = useParams()
  const [municipality, setMunicipality] = useState<Municipality | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const slugStr = Array.isArray(slug) ? slug[0] : slug

      const { data: mun } = await supabase
        .from('municipalities')
        .select('*, provinces(name, slug)')
        .eq('slug', slugStr)
        .single()

      if (!mun) { setLoading(false); return }
      setMunicipality(mun)

      // Buscar zonas e sensores
      const { data: zonesData } = await supabase
        .from('zones')
        .select(`
          id, name, latitude, longitude,
          sensors (
            id, name, sensor_type, is_active, is_online, last_seen, mac_address
          )
        `)
        .eq('municipality_id', mun.id)

      if (zonesData) {
        const zonesWithReadings = await Promise.all(
          zonesData.map(async (zone: Zone) => ({
            ...zone,
            sensors: await Promise.all(
              zone.sensors.map(async (sensor: Sensor) => {
                const { data: reading } = await supabase
                  .from('sensor_readings')
                  .select('*')
                  .eq('sensor_id', sensor.id)
                  .order('recorded_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()
                return { ...sensor, last_reading: reading || null }
              })
            )
          }))
        )
        setZones(zonesWithReadings)
      }

      // Meteorologia da província
      const { data: weatherData } = await supabase
        .from('weather_data')
        .select('*')
        .eq('province_id', mun.province_id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (weatherData) setWeather(weatherData)
      setLoading(false)
    }
    fetchData()
  }, [slug])

  if (loading) return (
    <div style={{ background: '#060f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>A carregar...</p>
    </div>
  )

  if (!municipality) return (
    <div style={{ background: '#060f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>Município não encontrado.</p>
    </div>
  )

  const allSensors = zones.flatMap(z => z.sensors)
  const activeSensors = allSensors.filter(s => s.is_active)
  const onlineSensors = allSensors.filter(s => s.is_online)

  const getStatusColor = (sensor: Sensor) => {
    if (!sensor.is_active) return '#64748b'
    if (!sensor.is_online) return '#ef4444'
    return '#22c55e'
  }

  const getStatusLabel = (sensor: Sensor) => {
    if (!sensor.is_active) return 'Inactivo'
    if (!sensor.is_online) return 'Offline'
    return 'Online'
  }

  const getMQ135Status = (value: number) => {
    if (value > 3500) return { label: 'PERIGOSO', color: '#7f1d1d' }
    if (value > 2500) return { label: 'MÁ', color: '#ef4444' }
    if (value > 1200) return { label: 'MODERADA', color: '#eab308' }
    return { label: 'BOA', color: '#22c55e' }
  }

  const getSW420Status = (value: number) => {
    if (value >= 2) return { label: 'INTENSA', color: '#ef4444' }
    if (value >= 1) return { label: 'OCASIONAL', color: '#eab308' }
    return { label: 'NORMAL', color: '#22c55e' }
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
               {municipality.name}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
              Município · Província de {municipality.provinces?.name}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const slug = municipality.provinces?.slug
            if (slug) window.location.href = `/provincia/${slug}`
          }}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Ver Província →
        </button>
      </header>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* CARDS DE RESUMO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total de Zonas', value: zones.length, icon: '📍', color: '#3b82f6' },
            { label: 'Centrais Instaladas', value: allSensors.length, icon: '📡', color: '#8b5cf6' },
            { label: 'Centrais Activas', value: activeSensors.length, icon: '🟢', color: '#22c55e' },
            { label: 'Online Agora', value: onlineSensors.length, icon: '📶', color: '#f59e0b' },
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
                <p style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* METEOROLOGIA + ZONAS */}
        <div style={{ display: 'grid', gridTemplateColumns: weather ? '1fr 2fr' : '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* METEOROLOGIA */}
          {weather && (
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
              <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>
                🌤️ Meteorologia Local
              </h2>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <p style={{ color: '#f59e0b', fontSize: '3rem', fontWeight: '800', margin: 0 }}>{weather.temperature}°C</p>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.3rem 0 0 0', textTransform: 'capitalize' }}>{weather.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                {[
                  { label: 'Chuva', value: `${weather.rain_probability ?? 0}%`, icon: '🌧️', color: '#3b82f6' },
                  { label: 'Vento', value: `${weather.wind_speed} m/s`, icon: '💨', color: '#8b5cf6' },
                  { label: 'Humidade', value: `${weather.humidity}%`, icon: '💧', color: '#06b6d4' },
                  { label: 'Hora', value: formatAO(weather.recorded_at, { hour: '2-digit', minute: '2-digit' }), icon: '🕐', color: '#22c55e' },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '0.7rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.1rem', margin: '0 0 0.2rem 0' }}>{item.icon}</p>
                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem', margin: '0 0 0.1rem 0' }}>{item.value}</p>
                    <p style={{ color: '#64748b', fontSize: '0.65rem', margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONAS E SENSORES */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>
              📡 Zonas e Centrais de Monitoramento
            </h2>

            {zones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>📡</p>
                <p style={{ margin: 0 }}>Nenhuma central instalada neste município.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {zones.map((zone) => (
                  <div key={zone.id} style={{ background: '#0f172a', borderRadius: '12px', padding: '1.2rem', border: '1px solid #1e3a5f' }}>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.8rem 0' }}>
                      📍 <span style={{ color: '#94a3b8' }}>{zone.name}</span>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {zone.sensors.map((sensor) => (
                        <div key={sensor.id} style={{
                          background: '#1e293b',
                          borderRadius: '10px',
                          padding: '1rem',
                          border: `1px solid ${getStatusColor(sensor)}33`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <div>
                              <p style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem', margin: '0 0 0.2rem 0' }}>{sensor.name}</p>
                              <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{sensor.sensor_type} · {sensor.mac_address}</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(sensor), animation: sensor.is_online ? 'pulse 2s infinite' : 'none' }} />
                                <span style={{ color: getStatusColor(sensor), fontSize: '0.72rem', fontWeight: '600' }}>
                                  {getStatusLabel(sensor)}
                                </span>
                              </div>
                              {sensor.last_seen && (
                                <span style={{ color: '#334155', fontSize: '0.62rem' }}>
                                  Visto: {formatAO(sensor.last_seen, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Leituras */}
                          {sensor.last_reading ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <div style={{ background: '#0f172a', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                <p style={{ color: '#64748b', fontSize: '0.62rem', margin: '0 0 0.2rem 0' }}>MQ-135</p>
                                <p style={{ color: getMQ135Status(sensor.last_reading.value).color, fontWeight: '700', fontSize: '0.9rem', margin: '0 0 0.1rem 0' }}>
                                  {sensor.last_reading.value} ADC
                                </p>
                                <p style={{ color: getMQ135Status(sensor.last_reading.value).color, fontSize: '0.62rem', margin: 0 }}>
                                  {getMQ135Status(sensor.last_reading.value).label}
                                </p>
                              </div>
                              <div style={{ background: '#0f172a', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                <p style={{ color: '#64748b', fontSize: '0.62rem', margin: '0 0 0.2rem 0' }}>SW-420</p>
                                <p style={{ color: getSW420Status(sensor.last_reading.value).color, fontWeight: '700', fontSize: '0.9rem', margin: '0 0 0.1rem 0' }}>
                                  {getSW420Status(sensor.last_reading.value).label}
                                </p>
                                <p style={{ color: '#64748b', fontSize: '0.62rem', margin: 0 }}>Vibração</p>
                              </div>
                            </div>
                          ) : (
                            <p style={{ color: '#475569', fontSize: '0.75rem', margin: 0, textAlign: 'center' }}>
                              {sensor.is_active ? 'Aguardando primeiras leituras...' : 'Central inactiva'}
                            </p>
                          )}

                          <button
                            onClick={() => window.location.href = `/central/${sensor.id}`}
                            style={{
                              width: '100%', marginTop: '0.8rem',
                              background: sensor.is_active ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e293b',
                              border: sensor.is_active ? 'none' : '1px solid #334155',
                              color: sensor.is_active ? '#fff' : '#64748b',
                              padding: '0.4rem', borderRadius: '8px',
                              fontSize: '0.75rem', cursor: sensor.is_active ? 'pointer' : 'default',
                              fontWeight: '600'
                            }}
                          >
                            Ver Central Completa →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </main>
  )
}
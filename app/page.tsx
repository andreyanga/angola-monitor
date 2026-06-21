'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const AngolaMap = dynamic(() => import('@/components/AngolaMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '600px', color: '#94a3b8' }}>
      A carregar mapa...
    </div>
  ),
})

interface WeatherData {
  province_id: number
  temperature: number
  humidity: number
  wind_speed: number
  description: string
  recorded_at: string
  provinces?: { name: string }
}

interface RiskData {
  province_id: number
  risk_score: number
  generated_at: string
}

const normalize = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')

function getRiskLevel(score: number | null) {
  if (score === null) return 'normal'
  if (score >= 60) return 'alerta'
  if (score >= 30) return 'atencao'
  return 'normal'
}

export default function Home() {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [weatherData, setWeatherData] = useState<WeatherData[]>([])
  const [riskData, setRiskData] = useState<RiskData[]>([])
  const [currentTime, setCurrentTime] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [showCuandoCubangoChoice, setShowCuandoCubangoChoice] = useState(false)

  useEffect(() => {
    function updateClock() {
      setCurrentTime(new Date().toLocaleString('pt-AO', { dateStyle: 'full', timeStyle: 'medium' }))
    }
    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function fetchWeather() {
      const { data } = await supabase
        .from('weather_data')
        .select('*, provinces(name)')
        .order('recorded_at', { ascending: false })

      const latest: Record<number, WeatherData> = {}
      data?.forEach((item: WeatherData) => {
        if (!latest[item.province_id]) latest[item.province_id] = item
      })
      const latestArray = Object.values(latest)
      setWeatherData(latestArray)

      if (data && data.length > 0) {
        setLastUpdate(new Date(data[0].recorded_at))
      }
    }

    async function fetchRisk() {
      const { data } = await supabase
        .from('reports')
        .select('province_id, risk_score, generated_at')
        .order('generated_at', { ascending: false })

      const latest: Record<number, RiskData> = {}
      data?.forEach((item: RiskData) => {
        if (!latest[item.province_id]) latest[item.province_id] = item
      })
      setRiskData(Object.values(latest))
    }

    fetchWeather()
    fetchRisk()

    const interval = setInterval(() => {
      fetchWeather()
      fetchRisk()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getProvinceWeather = (name: string) => {
    return weatherData.find((w) => w.provinces?.name && normalize(w.provinces.name) === normalize(name))
  }

  const getProvinceRisk = (provinceId: number) => {
    const r = riskData.find((rd) => rd.province_id === provinceId)
    return r ? r.risk_score : null
  }

  function handleProvinceClick(name: string) {
    if (name === '__CUANDO_CUBANGO_CHOICE__') {
      setShowCuandoCubangoChoice(true)
      return
    }
    setSelectedProvince(name)
  }

  function chooseCuandoCubango(provinceName: string) {
    setSelectedProvince(provinceName)
    setShowCuandoCubangoChoice(false)
  }

  const w = selectedProvince ? getProvinceWeather(selectedProvince) : null
  const selectedRisk = w ? getProvinceRisk(w.province_id) : null

  const getApiStatus = () => {
    if (!lastUpdate) return { color: '#64748b', label: 'A verificar...', dot: '#64748b' }
    const minutesAgo = (Date.now() - lastUpdate.getTime()) / 1000 / 60
    if (minutesAgo <= 90) return { color: '#22c55e', label: 'Sistema Activo', dot: '#22c55e' }
    if (minutesAgo <= 180) return { color: '#eab308', label: 'Dados Desactualizados', dot: '#eab308' }
    return { color: '#ef4444', label: 'API Indisponível', dot: '#ef4444' }
  }

  const apiStatus = getApiStatus()

  // Construir mapa de risco por nome de província normalizado, para passar ao AngolaMap
  const riskByProvinceName: Record<string, string> = {}
  weatherData.forEach((wd) => {
    if (!wd.provinces?.name) return
    const score = getProvinceRisk(wd.province_id)
    riskByProvinceName[normalize(wd.provinces.name)] = getRiskLevel(score)
  })

  const getRiskColor = (score: number) => {
    if (score >= 60) return '#ef4444'
    if (score >= 30) return '#eab308'
    return '#22c55e'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 60) return 'Risco — Alerta'
    if (score >= 30) return 'Risco — Atenção'
    return 'Risco — Normal'
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
          <div style={{
            background: '#0f2318',
            border: '2px solid #22c55e44',
            borderRadius: '12px',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            flexShrink: 0,
            position: 'relative'
          }}>
            🌍
            <div style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: apiStatus.dot,
              border: '2px solid #060f1e'
            }}/>
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: 0, lineHeight: '1.3' }}>
              Plataforma Inteligente de Monitoramento
              <span style={{ color: '#22c55e' }}> Preventivo Ambiental com IoT e IA</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>
              Sistema Inteligente de Monitoramento Preventivo — Angola
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            background: `${apiStatus.color}22`,
            border: `1px solid ${apiStatus.color}44`,
            borderRadius: '20px',
            padding: '0.3rem 0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.3rem'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: apiStatus.dot, animation: 'pulse 2s infinite' }} />
            <span style={{ color: apiStatus.color, fontSize: '0.75rem', fontWeight: '600' }}>{apiStatus.label}</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{currentTime}</p>
        </div>
      </header>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* MAPA + PAINEL LATERAL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>

          {/* MAPA */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid #1e3a5f',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #1e3a5f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>
                  Mapa de Angola
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
                  Clica numa província para ver os dados
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { label: 'Normal', color: '#22c55e' },
                  { label: 'Atenção', color: '#eab308' },
                  { label: 'Alerta', color: '#ef4444' },
                ].map((l) => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <AngolaMap onProvinceClick={handleProvinceClick} weatherData={weatherData} riskByProvinceName={riskByProvinceName} />

            {/* MODAL DE ESCOLHA CUANDO/CUBANGO */}
            {showCuandoCubangoChoice && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(6,15,30,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                  border: '1px solid #1e3a5f',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  width: '320px',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#fff', fontWeight: '600', fontSize: '0.95rem', margin: '0 0 0.3rem 0' }}>
                    Esta região foi dividida em 2025
                  </p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 1.2rem 0' }}>
                    Qual província pretende consultar?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <button
                      onClick={() => chooseCuandoCubango('Cuando')}
                      style={{
                        background: '#22c55e22',
                        border: '1px solid #22c55e55',
                        color: '#22c55e',
                        padding: '0.7rem',
                        borderRadius: '10px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Cuando (Mavinga)
                    </button>
                    <button
                      onClick={() => chooseCuandoCubango('Cubango')}
                      style={{
                        background: '#3b82f622',
                        border: '1px solid #3b82f655',
                        color: '#60a5fa',
                        padding: '0.7rem',
                        borderRadius: '10px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Cubango (Menongue)
                    </button>
                    <button
                      onClick={() => setShowCuandoCubangoChoice(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        padding: '0.4rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PAINEL LATERAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {selectedProvince && w ? (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: '1px solid #22c55e44',
                borderRadius: '16px',
                padding: '1.5rem',
                color: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0 0 0.2rem 0', textTransform: 'uppercase' }}>Província</p>
                    <h3 style={{ color: '#22c55e', fontSize: '1.3rem', fontWeight: '700', margin: 0 }}>{w.provinces?.name || selectedProvince}</h3>
                  </div>
                  {selectedRisk !== null && (
                    <div style={{
                      background: `${getRiskColor(selectedRisk)}22`,
                      border: `1px solid ${getRiskColor(selectedRisk)}55`,
                      borderRadius: '20px',
                      padding: '0.25rem 0.7rem',
                    }}>
                      <span style={{ color: getRiskColor(selectedRisk), fontSize: '0.7rem', fontWeight: '700' }}>
                        {getRiskLabel(selectedRisk)}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{
                  background: '#0f172a',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0 0 0.3rem 0' }}>TEMPERATURA</p>
                  <p style={{ color: '#f59e0b', fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>{w.temperature}°C</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.3rem 0 0 0', textTransform: 'capitalize' }}>{w.description}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Humidade', value: `${w.humidity}%`, icon: '💧' },
                    { label: 'Vento', value: `${w.wind_speed} m/s`, icon: '💨' },
                  ].map((item) => (
                    <div key={item.label} style={{
                      background: '#0f172a',
                      borderRadius: '10px',
                      padding: '0.8rem',
                      textAlign: 'center'
                    }}>
                      <p style={{ fontSize: '1.2rem', margin: '0 0 0.2rem 0' }}>{item.icon}</p>
                      <p style={{ color: '#fff', fontWeight: '700', fontSize: '1rem', margin: '0 0 0.1rem 0' }}>{item.value}</p>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{item.label}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const realName = w.provinces?.name || selectedProvince
                    const slug = realName!
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/ /g, '-')
                    window.location.href = `/provincia/${slug}`
                  }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#000',
                    padding: '0.8rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Ver Detalhes Completos
                </button>
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: '1px solid #1e3a5f',
                borderRadius: '16px',
                padding: '2rem',
                color: '#fff',
                textAlign: 'center',
                flex: 1
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
                <h3 style={{ color: '#94a3b8', fontWeight: '600', fontSize: '0.95rem', margin: '0 0 0.5rem 0' }}>
                  Nenhuma Província Seleccionada
                </h3>
                <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0 }}>
                  Clica numa província no mapa para ver os dados meteorológicos em tempo real
                </p>
              </div>
            )}

            {/* LISTA RAPIDA */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              border: '1px solid #1e3a5f',
              borderRadius: '16px',
              padding: '1rem',
              flex: 1,
              overflow: 'hidden'
            }}>
              <p style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', margin: '0 0 0.8rem 0', letterSpacing: '0.05em' }}>
                Temperaturas por Província
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                {weatherData
                  .sort((a, b) => b.temperature - a.temperature)
                  .map((item) => (
                    <div
                      key={item.province_id}
                      onClick={() => setSelectedProvince(item.provinces?.name || '')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.8rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: selectedProvince && normalize(selectedProvince) === normalize(item.provinces?.name || '') ? '#22c55e22' : '#0f172a',
                        border: selectedProvince && normalize(selectedProvince) === normalize(item.provinces?.name || '') ? '1px solid #22c55e44' : '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{item.provinces?.name}</span>
                      <span style={{
                        color: item.temperature > 25 ? '#ef4444' : item.temperature > 20 ? '#f59e0b' : '#22c55e',
                        fontWeight: '700',
                        fontSize: '0.85rem'
                      }}>
                        {item.temperature}°C
                      </span>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </main>
  )
}
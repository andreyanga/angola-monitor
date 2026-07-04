'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const AngolaMap = dynamic(() => import('@/components/AngolaMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '500px', color: '#94a3b8' }}>
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

interface Alert {
  id: number
  province_id: number
  type: string
  severity: string
  title: string
  description: string
  is_active: boolean
  created_at: string
  provinces?: { name: string }
}

interface Sensor {
  id: number
  name: string
  is_active: boolean
  sensor_type: string
  latitude: number
  longitude: number
  zona: string
  municipio: string
  provincia: string
  has_alert?: boolean
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
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null)
  const [currentTime, setCurrentTime] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [showCuandoCubangoChoice, setShowCuandoCubangoChoice] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [recentLogs, setRecentLogs] = useState<any[]>([])

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
      setWeatherData(Object.values(latest))
      if (data && data.length > 0) setLastUpdate(new Date(data[0].recorded_at))
    }

    async function fetchRecentLogs() {
      const { data } = await supabase
        .from('logs')
        .select('*, provinces(name)')
        .order('created_at', { ascending: false })
        .limit(15)
      setRecentLogs(data || [])
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

    async function fetchAlerts() {
      const { data } = await supabase
        .from('alerts')
        .select('*, provinces(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setAlerts(data || [])
    }

  async function fetchStatus() {
  try {
    const res = await fetch('/api/status')
    const data = await res.json()
    setSystemStatus(data)
  } catch {
    setSystemStatus(null)
  }
}

    async function fetchSensors() {
      const { data } = await supabase
        .from('sensors')
        .select(`
          id, name, is_active, sensor_type,
          zones (name, latitude, longitude),
          municipalities (name),
          provinces (name)
        `)

      const alertProvinces = alerts.map((a) => a.provinces?.name)

      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        is_active: s.is_active,
        sensor_type: s.sensor_type,
        latitude: s.zones?.latitude,
        longitude: s.zones?.longitude,
        zona: s.zones?.name,
        municipio: s.municipalities?.name,
        provincia: s.provinces?.name,
        has_alert: alertProvinces.includes(s.provinces?.name),
      }))

      setSensors(mapped.filter((s: Sensor) => s.latitude && s.longitude))
    }

    fetchWeather()
    fetchRisk()
    fetchAlerts()
    fetchStatus()
    fetchSensors()
    fetchRecentLogs()

    const interval = setInterval(() => {
      fetchWeather()
      fetchRisk()
      fetchAlerts()
      fetchStatus()
      fetchSensors()
      fetchRecentLogs()

    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getProvinceWeather = (name: string) =>
    weatherData.find((w) => w.provinces?.name && normalize(w.provinces.name) === normalize(name))

  const getProvinceRisk = (provinceId: number) => {
    const r = riskData.find((rd) => rd.province_id === provinceId)
    return r ? r.risk_score : null
  }

  function handleProvinceClick(name: string) {
    if (name === '__CUANDO_CUBANGO_CHOICE__') { setShowCuandoCubangoChoice(true); return }
    setSelectedSensor(null)
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

  const riskByProvinceName: Record<string, string> = {}
  weatherData.forEach((wd) => {
    if (!wd.provinces?.name) return
    const score = getProvinceRisk(wd.province_id)
    riskByProvinceName[normalize(wd.provinces.name)] = getRiskLevel(score)
  })

  const getRiskColor = (score: number) => score >= 60 ? '#ef4444' : score >= 30 ? '#eab308' : '#22c55e'
  const getIraLabel = (score: number) => score >= 60 ? 'ALTO' : score >= 30 ? 'MODERADO' : 'BAIXO'
  const getIraColor = (score: number) => score >= 60 ? '#ef4444' : score >= 30 ? '#eab308' : '#22c55e'
  const getIraBg = (score: number) => score >= 60 ? '#7f1d1d' : score >= 30 ? '#78350f' : '#14532d'
  const severityColor = (s: string) => s === 'alerta' ? '#ef4444' : '#eab308'
  const severityLabel = (s: string) => s === 'alerta' ? 'ALERTA' : 'ATENÇÃO'

  const criticalAlerts = alerts.filter((a) => a.severity === 'alerta')
  const attentionAlerts = alerts.filter((a) => a.severity === 'atencao')

  const scores = riskData.map((r) => r.risk_score)
  const iraMedia = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const iraMax = scores.length > 0 ? Math.max(...scores) : null
  const iraMaxProvince = iraMax !== null
    ? weatherData.find((wd) => getProvinceRisk(wd.province_id) === iraMax)?.provinces?.name
    : null

  const activeSensors = sensors.filter((s) => s.is_active)
  const inactiveSensors = sensors.filter((s) => !s.is_active)

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
          <button
              onClick={() => window.location.href = '/logs'}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '0.3rem 0.8rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                marginRight: '0.5rem'
              }}>
              Logs
        </button>

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

      {/* BANNER DE ALERTAS */}
      {alerts.length > 0 && !bannerDismissed && (
        <div style={{
          background: criticalAlerts.length > 0
            ? 'linear-gradient(90deg, #7f1d1d, #991b1b)'
            : 'linear-gradient(90deg, #78350f, #92400e)',
          borderBottom: `2px solid ${criticalAlerts.length > 0 ? '#ef4444' : '#eab308'}`,
          padding: '0.8rem 2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flex: 1 }}>
              <span style={{ fontSize: '1.4rem', animation: 'shake 1.5s infinite' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: '700', fontSize: '0.85rem', margin: '0 0 0.4rem 0' }}>
                  {criticalAlerts.length > 0
                    ? `${criticalAlerts.length} província(s) em ALERTA — ${attentionAlerts.length} em atenção`
                    : `${attentionAlerts.length} província(s) em Atenção`}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {alerts.map((alert) => (
                    <div key={alert.id} onClick={() => setSelectedProvince(alert.provinces?.name || '')} style={{
                      background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '0.3rem 0.7rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: severityColor(alert.severity) }} />
                      <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: '600' }}>{alert.provinces?.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>{alert.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setBannerDismissed(true)} style={{
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
              fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1
            }}>×</button>
          </div>
        </div>
      )}

      {/* IRA */}
      {iraMedia !== null && (
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1a2744)',
          borderBottom: '1px solid #1e3a5f',
          padding: '0.8rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.2rem 0' }}>IRA — Angola</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                <span style={{ color: getIraColor(iraMedia), fontSize: '2rem', fontWeight: '800', lineHeight: 1 }}>{iraMedia}%</span>
                <span style={{ background: getIraBg(iraMedia), color: getIraColor(iraMedia), fontSize: '0.7rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '6px', border: `1px solid ${getIraColor(iraMedia)}55` }}>
                  {getIraLabel(iraMedia)}
                </span>
              </div>
            </div>
            <div style={{ width: '180px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>BAIXO</span>
                <span style={{ color: '#eab308', fontSize: '0.6rem' }}>MODERADO</span>
                <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>ALTO</span>
              </div>
              <div style={{ background: '#1e293b', borderRadius: '6px', height: '8px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)', opacity: 0.3 }} />
                <div style={{ width: `${iraMedia}%`, height: '100%', background: getIraColor(iraMedia), borderRadius: '6px', transition: 'width 0.5s ease', position: 'relative', zIndex: 1 }} />
              </div>
            </div>
          </div>

          <div style={{ width: '1px', height: '40px', background: '#1e3a5f' }} />

          {iraMax !== null && iraMax > 0 && (
            <div>
              <p style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.2rem 0' }}>Maior Risco</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>{iraMaxProvince}</span>
                <span style={{ background: getIraBg(iraMax), color: getIraColor(iraMax), fontSize: '0.65rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '6px', border: `1px solid ${getIraColor(iraMax)}55` }}>
                  {iraMax}% — {getIraLabel(iraMax)}
                </span>
              </div>
            </div>
          )}

          <div style={{ width: '1px', height: '40px', background: '#1e3a5f' }} />

          <div style={{ display: 'flex', gap: '1.2rem' }}>
            {[
              { label: 'Normal', color: '#22c55e', count: riskData.filter(r => r.risk_score < 30).length },
              { label: 'Moderado', color: '#eab308', count: riskData.filter(r => r.risk_score >= 30 && r.risk_score < 60).length },
              { label: 'Alto', color: '#ef4444', count: riskData.filter(r => r.risk_score >= 60).length },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <p style={{ color: item.color, fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>{item.count}</p>
                <p style={{ color: '#64748b', fontSize: '0.65rem', margin: 0 }}>{item.label}</p>
              </div>
            ))}
          </div>

          <div style={{ width: '1px', height: '40px', background: '#1e3a5f' }} />

          {/* Contagem de centrais */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>Centrais</p>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: '700' }}>{activeSensors.length} Activas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }} />
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{inactiveSensors.length} Inactivas</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <p style={{ color: '#475569', fontSize: '0.65rem', margin: 0 }}>
              Baseado em: Chuva (30%) · Humidade (20%) · Vento (20%) · Temperatura (15%) · Vibração (10%) · Ar (5%)
            </p>
          </div>
        </div>
      )}

      

      <div style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>

         {/* MAPA */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              border: '1px solid #1e3a5f',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #1e3a5f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>Mapa de Angola</h2>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>Clica numa província ou central para ver os dados</p>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                {[
                  { label: 'Baixa Vulnerabilidade', color: '#22c55e' },
                  { label: 'Vulnerabilidade Moderada', color: '#eab308' },
                  { label: 'Alta Vulnerabilidade', color: '#ef4444' },
                ].map((l) => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{l.label}</span>
                  </div>
                ))}
                <div style={{ width: '1px', height: '16px', background: '#1e3a5f' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>CML Activa</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#64748b', border: '2px solid #fff' }} />
                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>CML Inactiva</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: '500px', position: 'relative' }}>
              <AngolaMap
                onProvinceClick={handleProvinceClick}
                weatherData={weatherData}
                riskByProvinceName={riskByProvinceName}
                sensors={sensors}
                onSensorClick={(sensor: Sensor) => {
                  setSelectedSensor(sensor)
                  setSelectedProvince(null)
                }}
              />
            </div>

            {showCuandoCubangoChoice && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(6,15,30,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                  border: '1px solid #1e3a5f',
                  borderRadius: '16px', padding: '1.5rem', width: '320px', textAlign: 'center'
                }}>
                  <p style={{ color: '#fff', fontWeight: '600', fontSize: '0.95rem', margin: '0 0 0.3rem 0' }}>Esta região foi dividida em 2025</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 1.2rem 0' }}>Qual província pretende consultar?</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <button onClick={() => chooseCuandoCubango('Cuando')} style={{ background: '#22c55e22', border: '1px solid #22c55e55', color: '#22c55e', padding: '0.7rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                      Cuando (Mavinga)
                    </button>
                    <button onClick={() => chooseCuandoCubango('Cubango')} style={{ background: '#3b82f622', border: '1px solid #3b82f655', color: '#60a5fa', padding: '0.7rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                      Cubango (Menongue)
                    </button>
                    <button onClick={() => setShowCuandoCubangoChoice(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', padding: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PAINEL LATERAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* PAINEL DA CENTRAL SELECCIONADA */}
            {selectedSensor && (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: `1px solid ${selectedSensor.has_alert ? '#ef444444' : selectedSensor.is_active ? '#22c55e44' : '#33415544'}`,
                borderRadius: '16px',
                padding: '1.2rem',
                color: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>Central de Monitoramento</p>
                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>{selectedSensor.name}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedSensor.has_alert ? '#ef4444' : selectedSensor.is_active ? '#22c55e' : '#64748b', animation: selectedSensor.is_active ? 'pulse 2s infinite' : 'none' }} />
                    <span style={{ color: selectedSensor.has_alert ? '#ef4444' : selectedSensor.is_active ? '#22c55e' : '#64748b', fontSize: '0.7rem', fontWeight: '600' }}>
                      {selectedSensor.has_alert ? 'Em Alerta' : selectedSensor.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.8rem' }}>
                  {[
                    { label: 'Zona', value: selectedSensor.zona },
                    { label: 'Município', value: selectedSensor.municipio },
                    { label: 'Província', value: selectedSensor.provincia },
                    { label: 'Sensores', value: selectedSensor.sensor_type },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{item.label}</span>
                      <span style={{ color: '#cbd5e1', fontSize: '0.72rem', fontWeight: '600' }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Painel de sensores */}
                <div style={{ background: '#060f1e', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.8rem' }}>
                  <p style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Leituras dos Sensores</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { sensor: 'MQ-135', label: 'Qualidade do Ar', value: selectedSensor.is_active ? 'Sem dados' : '—', unit: 'ADC' },
                      { sensor: 'SW-420', label: 'Vibração', value: selectedSensor.is_active ? 'Sem vibração' : '—', unit: '' },
                    ].map((s) => (
                      <div key={s.sensor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: '600' }}>{s.sensor}</span>
                          <span style={{ color: '#475569', fontSize: '0.65rem', marginLeft: '0.3rem' }}>{s.label}</span>
                        </div>
                        <span style={{ color: selectedSensor.is_active ? '#22c55e' : '#475569', fontSize: '0.72rem', fontWeight: '600' }}>
                          {s.value} {s.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => window.location.href = `/central/${selectedSensor.id}`}
                    style={{
                      flex: 1, background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      border: 'none', color: '#fff', padding: '0.4rem', borderRadius: '8px',
                      fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600'
                    }}
                  >
                    Ver Central Completa
                  </button>
                  <button
                    onClick={() => setSelectedProvince(selectedSensor.provincia)}
                    style={{
                      background: '#1e293b', border: '1px solid #334155',
                      color: '#94a3b8', padding: '0.4rem 0.6rem', borderRadius: '8px',
                      fontSize: '0.72rem', cursor: 'pointer'
                    }}
                  >
                    Província
                  </button>
                  <button
                    onClick={() => setSelectedSensor(null)}
                    style={{
                      background: '#1e293b', border: '1px solid #334155',
                      color: '#64748b', padding: '0.4rem 0.6rem', borderRadius: '8px',
                      fontSize: '0.72rem', cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
                
              </div>
            )}

            {/* PAINEL DA PROVÍNCIA SELECCIONADA */}
            {selectedProvince && w && !selectedSensor ? (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: '1px solid #22c55e44',
                borderRadius: '16px', padding: '1.5rem', color: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0 0 0.2rem 0', textTransform: 'uppercase' }}>Província</p>
                    <h3 style={{ color: '#22c55e', fontSize: '1.3rem', fontWeight: '700', margin: 0 }}>{w.provinces?.name || selectedProvince}</h3>
                  </div>
                  {selectedRisk !== null && (
                    <div style={{ background: `${getRiskColor(selectedRisk)}22`, border: `1px solid ${getRiskColor(selectedRisk)}55`, borderRadius: '20px', padding: '0.25rem 0.7rem' }}>
                      <span style={{ color: getRiskColor(selectedRisk), fontSize: '0.7rem', fontWeight: '700' }}>
                        IRA: {selectedRisk}% — {getIraLabel(selectedRisk)}
                      </span>
                    </div>
                  )}
                </div>

               {/* CHUVA E VENTO — variáveis principais (peso 30% e 20%) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                  <div style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    padding: '0.8rem',
                    textAlign: 'center',
                    border: `1px solid ${(w as any).rain_probability > 70 ? '#ef444455' : (w as any).rain_probability >= 40 ? '#eab30855' : '#3b82f622'}`
                  }}>
                    <p style={{ color: '#64748b', fontSize: '0.6rem', textTransform: 'uppercase', margin: '0 0 0.2rem 0', letterSpacing: '0.05em' }}>
                      🌧️ Prob. Chuva <span style={{ color: '#475569' }}>(30%)</span>
                    </p>
                    <p style={{
                      color: (w as any).rain_probability > 70 ? '#ef4444' : (w as any).rain_probability >= 40 ? '#eab308' : '#3b82f6',
                      fontSize: '1.6rem', fontWeight: '800', margin: '0 0 0.1rem 0'
                    }}>
                      {(w as any).rain_probability ?? 0}%
                    </p>
                    <p style={{
                      color: (w as any).rain_probability > 70 ? '#ef4444' : (w as any).rain_probability >= 40 ? '#eab308' : '#22c55e',
                      fontSize: '0.65rem', fontWeight: '600', margin: 0
                    }}>
                      {(w as any).rain_probability > 70 ? 'ALTO' : (w as any).rain_probability >= 40 ? 'MODERADO' : 'BAIXO'}
                    </p>
                  </div>

                  <div style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    padding: '0.8rem',
                    textAlign: 'center',
                    border: `1px solid ${w.wind_speed > 10 ? '#ef444455' : w.wind_speed >= 5 ? '#eab30855' : '#22c55e22'}`
                  }}>
                    <p style={{ color: '#64748b', fontSize: '0.6rem', textTransform: 'uppercase', margin: '0 0 0.2rem 0', letterSpacing: '0.05em' }}>
                      💨 Vento <span style={{ color: '#475569' }}>(20%)</span>
                    </p>
                    <p style={{
                      color: w.wind_speed > 10 ? '#ef4444' : w.wind_speed >= 5 ? '#eab308' : '#22c55e',
                      fontSize: '1.6rem', fontWeight: '800', margin: '0 0 0.1rem 0'
                    }}>
                      {w.wind_speed}
                      <span style={{ fontSize: '0.8rem', fontWeight: '400' }}> m/s</span>
                    </p>
                    <p style={{
                      color: w.wind_speed > 10 ? '#ef4444' : w.wind_speed >= 5 ? '#eab308' : '#22c55e',
                      fontSize: '0.65rem', fontWeight: '600', margin: 0
                    }}>
                      {w.wind_speed > 10 ? 'ALTO' : w.wind_speed >= 5 ? 'MODERADO' : 'BAIXO'}
                    </p>
                  </div>
                </div>

                {/* HUMIDADE E TEMPERATURA — variáveis secundárias */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.8rem' }}>
                  <div style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    padding: '0.7rem',
                    textAlign: 'center',
                    border: `1px solid ${w.humidity > 85 ? '#ef444433' : w.humidity >= 70 ? '#eab30833' : '#1e3a5f'}`
                  }}>
                    <p style={{ color: '#64748b', fontSize: '0.6rem', textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>
                      💧 Humidade <span style={{ color: '#475569' }}>(20%)</span>
                    </p>
                    <p style={{
                      color: w.humidity > 85 ? '#ef4444' : w.humidity >= 70 ? '#eab308' : '#06b6d4',
                      fontSize: '1.3rem', fontWeight: '700', margin: 0
                    }}>
                      {w.humidity}%
                    </p>
                  </div>

                  <div style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    padding: '0.7rem',
                    textAlign: 'center',
                    border: `1px solid ${w.temperature > 32 ? '#ef444433' : w.temperature >= 28 ? '#eab30833' : '#1e3a5f'}`
                  }}>
                    <p style={{ color: '#64748b', fontSize: '0.6rem', textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>
                      🌡️ Temperatura <span style={{ color: '#475569' }}>(15%)</span>
                    </p>
                    <p style={{
                      color: w.temperature > 32 ? '#ef4444' : w.temperature >= 28 ? '#eab308' : '#f59e0b',
                      fontSize: '1.3rem', fontWeight: '700', margin: 0
                    }}>
                      {w.temperature}°C
                    </p>
                  </div>
                </div>

                {/* CONDIÇÃO ACTUAL */}
                <div style={{
                  background: '#0f172a', borderRadius: '8px', padding: '0.5rem 0.8rem',
                  textAlign: 'center', marginBottom: '0.8rem'
                }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, textTransform: 'capitalize' }}>
                    {w.description}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const realName = w.provinces?.name || selectedProvince
                    const slug = realName!.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-')
                    window.location.href = `/provincia/${slug}`
                  }}
                  style={{
                    width: '100%', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#000', padding: '0.8rem', borderRadius: '10px',
                    border: 'none', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                  }}
                >
                  Ver Detalhes Completos
                </button>
              </div>
            ) : !selectedSensor && (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: '1px solid #1e3a5f', borderRadius: '16px',
                padding: '2rem', color: '#fff', textAlign: 'center', flex: 1
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
                <h3 style={{ color: '#94a3b8', fontWeight: '600', fontSize: '0.95rem', margin: '0 0 0.5rem 0' }}>Nenhuma Província Seleccionada</h3>
                <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0 }}>Clica numa província ou central no mapa para ver os dados</p>
              </div>
            )}

            {/* PAINEL FIXO DE ALERTAS */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              border: `1px solid ${alerts.length > 0 ? '#ef444444' : '#1e3a5f'}`,
              borderRadius: '16px', padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: alerts.length > 0 ? '0.8rem' : 0 }}>
                <span>🚨</span>
                <p style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600', margin: 0 }}>Alertas Activos ({alerts.length})</p>
              </div>
              {alerts.length === 0 ? (
                <p style={{ color: '#475569', fontSize: '0.75rem', margin: 0 }}>Nenhum alerta activo. Todas as províncias em condição normal.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {alerts.map((alert) => (
                    <div key={alert.id} onClick={() => setSelectedProvince(alert.provinces?.name || '')} style={{
                      background: '#0f172a', border: `1px solid ${severityColor(alert.severity)}44`,
                      borderRadius: '10px', padding: '0.6rem 0.8rem', cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.78rem' }}>{alert.provinces?.name}</span>
                        <span style={{ color: severityColor(alert.severity), fontSize: '0.65rem', fontWeight: '700', background: `${severityColor(alert.severity)}22`, padding: '0.1rem 0.5rem', borderRadius: '10px' }}>
                          {severityLabel(alert.severity)}
                        </span>
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.72rem', margin: '0 0 0.2rem 0' }}>⚠️ {alert.type}</p>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, lineHeight: '1.4' }}>{alert.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* IRA POR PROVÍNCIA */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              border: '1px solid #1e3a5f', borderRadius: '16px', padding: '1rem', flex: 1, overflow: 'hidden'
            }}>
              <p style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', margin: '0 0 0.8rem 0', letterSpacing: '0.05em' }}>IRA por Província</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '250px', overflowY: 'auto' }}>
                {riskData.sort((a, b) => b.risk_score - a.risk_score).map((item) => {
                  const provinceName = weatherData.find(w => w.province_id === item.province_id)?.provinces?.name
                  return (
                    <div key={item.province_id} onClick={() => provinceName && setSelectedProvince(provinceName)} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                      background: selectedProvince && provinceName && normalize(selectedProvince) === normalize(provinceName) ? '#22c55e22' : '#0f172a',
                      border: selectedProvince && provinceName && normalize(selectedProvince) === normalize(provinceName) ? '1px solid #22c55e44' : '1px solid transparent',
                      transition: 'all 0.2s'
                    }}>
                      <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{provinceName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: getIraColor(item.risk_score), fontWeight: '700', fontSize: '0.85rem' }}>{item.risk_score}%</span>
                        <span style={{ color: getIraColor(item.risk_score), fontSize: '0.65rem', fontWeight: '600' }}>{getIraLabel(item.risk_score)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
          </div>

         {/* ESTADO DA COMUNICAÇÃO */}
          {systemStatus && (
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid #1e3a5f',
            borderRadius: '16px',
            padding: '1rem 1.5rem',
            marginTop: '1.5rem'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '0.9rem' }}>📡</span>
            <p style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600', margin: 0 }}>
              Estado da Comunicação
            </p>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: systemStatus.overall === 'online' ? '#22c55e' : '#eab308',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{
                color: systemStatus.overall === 'online' ? '#22c55e' : '#eab308',
                fontSize: '0.65rem', fontWeight: '600'
              }}>
                {systemStatus.overall === 'online' ? 'Todos os sistemas operacionais' : 'Atenção'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {Object.values(systemStatus.services).map((s: any) => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.4rem 0.6rem',
                background: '#0f172a',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: s.status === 'online' ? '#22c55e' : s.status === 'degraded' ? '#eab308' : '#ef4444'
                  }} />
                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{s.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  {s.details && (
                    <span style={{ color: '#475569', fontSize: '0.65rem' }}>{s.details}</span>
                  )}
                  {s.latency !== null && (
                    <span style={{ color: '#475569', fontSize: '0.65rem' }}>{s.latency}ms</span>
                  )}
                  <span style={{
                    color: s.status === 'online' ? '#22c55e' : s.status === 'degraded' ? '#eab308' : '#ef4444',
                    fontSize: '0.65rem', fontWeight: '700',
                    background: s.status === 'online' ? '#22c55e22' : s.status === 'degraded' ? '#eab30822' : '#ef444422',
                    padding: '0.1rem 0.4rem', borderRadius: '4px'
                  }}>
                    {s.status === 'online' ? 'ONLINE' : s.status === 'degraded' ? 'DEGRADADO' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ color: '#334155', fontSize: '0.6rem', margin: '0.5rem 0 0 0', textAlign: 'right' }}>
            Verificado às {systemStatus.checked_at ? new Date(systemStatus.checked_at).toLocaleTimeString('pt-AO') : '--'}
          </p>
      
          </div>
          )}

          {/* LINHA TEMPORAL DE EVENTOS */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          border: '1px solid #1e3a5f',
          borderRadius: '16px',
          padding: '1rem 1.5rem',
          marginTop: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span></span>
              <p style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600', margin: 0 }}>
                Linha Temporal de Eventos
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/logs'}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#64748b', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.7rem' }}
            >
              Ver todos os logs →
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.75rem', margin: 0, textAlign: 'center', padding: '1rem' }}>
              Nenhum evento registado ainda.
            </p>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Linha vertical da timeline */}
              <div style={{
                position: 'absolute', left: '11px', top: '8px', bottom: '8px',
                width: '2px', background: '#1e3a5f'
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentLogs.map((log, i) => {
                  const eventColors: Record<string, string> = {
                    alert_generated: '#ef4444',
                    ia_report: '#3b82f6',
                    weather_update: '#22c55e',
                    sensor_reading: '#8b5cf6',
                    api_error: '#ef4444',
                  }
                  const eventIcons: Record<string, string> = {
                    alert_generated: '🚨',
                    ia_report: '🤖',
                    weather_update: '🌤️',
                    sensor_reading: '📡',
                    api_error: '❌',
                  }
                  const color = eventColors[log.event_type] || '#64748b'
                  const icon = eventIcons[log.event_type] || '📌'

                  return (
                    <div key={log.id} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                      {/* Dot da timeline */}
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: `${color}22`, border: `2px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', flexShrink: 0, zIndex: 1,
                        marginTop: '0.1rem'
                      }}>
                        {icon}
                      </div>

                      {/* Conteúdo */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: '600' }}>
                            {log.title}
                          </span>
                          {log.provinces?.name && (
                            <span style={{ color: '#475569', fontSize: '0.65rem' }}>
                              — {log.provinces.name}
                            </span>
                          )}
                        </div>
                        {log.description && (
                          <p style={{ color: '#475569', fontSize: '0.68rem', margin: '0 0 0.1rem 0', lineHeight: '1.3' }}>
                            {log.description}
                          </p>
                        )}
                        <span style={{ color: '#334155', fontSize: '0.62rem' }}>
                          {new Date(log.created_at).toLocaleString('pt-AO', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Badge de severidade */}
                      <span style={{
                        color: log.severity === 'critical' ? '#ef4444' : log.severity === 'warning' ? '#eab308' : '#3b82f6',
                        fontSize: '0.6rem', fontWeight: '700',
                        background: log.severity === 'critical' ? '#ef444422' : log.severity === 'warning' ? '#eab30822' : '#3b82f622',
                        padding: '0.1rem 0.4rem', borderRadius: '4px',
                        flexShrink: 0, marginTop: '0.2rem'
                      }}>
                        {log.severity === 'critical' ? 'CRÍTICO' : log.severity === 'warning' ? 'ATENÇÃO' : 'INFO'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(-10deg); }
          20% { transform: rotate(10deg); }
          30% { transform: rotate(-6deg); }
          40% { transform: rotate(6deg); }
          50% { transform: rotate(0deg); }
        }
      `}</style>
    </main>
  )
}
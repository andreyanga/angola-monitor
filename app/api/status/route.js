import { supabase } from '@/lib/supabase'

export async function GET() {
  const results = {
    dashboard: { status: 'online', label: 'Dashboard', latency: 0 },
    supabase: { status: 'offline', label: 'Supabase', latency: null },
    openweather: { status: 'offline', label: 'OpenWeather API', latency: null },
    central_local: { status: 'offline', label: 'Central Local', latency: null, details: '' },
  }

  // Verificar Supabase
  try {
    const start = Date.now()
    const { error } = await supabase.from('provinces').select('id').limit(1)
    const latency = Date.now() - start
    results.supabase = {
      status: error ? 'offline' : 'online',
      label: 'Supabase',
      latency,
    }
  } catch {
    results.supabase.status = 'offline'
  }

  // Verificar OpenWeather
  try {
    const start = Date.now()
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=-8.8&lon=13.2&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`,
      { signal: AbortSignal.timeout(8000) }
    )
    const latency = Date.now() - start
    results.openweather = {
      status: res.ok ? 'online' : 'degraded',
      label: 'OpenWeather API',
      latency,
    }
  } catch {
    results.openweather.status = 'offline'
  }

  // Verificar Central Local (última leitura de sensor)
  try {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('recorded_at, sensors(name)')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      const minutesAgo = (Date.now() - new Date(data.recorded_at).getTime()) / 1000 / 60
      results.central_local = {
        status: minutesAgo <= 120 ? 'online' : 'degraded',
        label: 'Central Local',
        latency: null,
        details: minutesAgo <= 120
          ? `Última leitura há ${Math.round(minutesAgo)} min`
          : `Sem dados há ${Math.round(minutesAgo / 60)}h`,
      }
    } else {
      results.central_local = {
        status: 'offline',
        label: 'Central Local',
        latency: null,
        details: 'Sem leituras registadas',
      }
    }
  } catch {
    results.central_local.status = 'offline'
  }

  const allOnline = Object.values(results).every(r => r.status === 'online')
  const anyOffline = Object.values(results).some(r => r.status === 'offline')

  return Response.json({
    overall: anyOffline ? 'degraded' : allOnline ? 'online' : 'degraded',
    services: results,
    checked_at: new Date().toISOString(),
  })
}
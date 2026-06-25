import { supabase } from '@/lib/supabase'

const provinces = [
  { id: 1,  name: 'Bengo',         capital: 'Dande',        lat: -8.4590,  lon: 13.5490 },
  { id: 2,  name: 'Benguela',      capital: 'Benguela',     lat: -12.5763, lon: 13.4055 },
  { id: 3,  name: 'Bié',           capital: 'Cuito',        lat: -12.3833, lon: 16.9333 },
  { id: 4,  name: 'Cabinda',       capital: 'Cabinda',      lat: -5.5500,  lon: 12.2000 },
  { id: 5,  name: 'Cuando',        capital: 'Mavinga',      lat: -17.3833, lon: 20.3500 },
  { id: 6,  name: 'Cuanza Norte',  capital: 'Cazengo',      lat: -9.3000,  lon: 14.6500 },
  { id: 7,  name: 'Cuanza Sul',    capital: 'Sumbe',        lat: -11.2000, lon: 13.8500 },
  { id: 8,  name: 'Cubango',       capital: 'Menongue',     lat: -14.6500, lon: 17.6833 },
  { id: 9,  name: 'Cunene',        capital: 'Cuanhama',     lat: -17.0833, lon: 15.6833 },
  { id: 10, name: 'Huambo',        capital: 'Huambo',       lat: -12.7761, lon: 15.7394 },
  { id: 11, name: 'Huíla',         capital: 'Lubango',      lat: -14.9177, lon: 13.4920 },
  { id: 12, name: 'Icolo e Bengo', capital: 'Catete',       lat: -9.0833,  lon: 13.7167 },
  { id: 13, name: 'Luanda',        capital: 'Luanda',       lat: -8.8368,  lon: 13.2343 },
  { id: 14, name: 'Lunda Norte',   capital: 'Dundo',        lat: -7.3833,  lon: 20.8333 },
  { id: 15, name: 'Lunda Sul',     capital: 'Saurimo',      lat: -9.6606,  lon: 20.3997 },
  { id: 16, name: 'Malanje',       capital: 'Malanje',      lat: -9.5400,  lon: 16.3400 },
  { id: 17, name: 'Moxico',        capital: 'Luena',        lat: -11.7833, lon: 19.9167 },
  { id: 18, name: 'Moxico Leste',  capital: 'Cazombo',      lat: -11.8833, lon: 22.9167 },
  { id: 19, name: 'Namibe',        capital: 'Moçâmedes',    lat: -15.1961, lon: 12.1522 },
  { id: 20, name: 'Uíge',          capital: 'Uíge',         lat: -7.6167,  lon: 15.0500 },
  { id: 21, name: 'Zaire',         capital: 'Mbanza Kongo', lat: -6.2667,  lon: 14.2333 },
]

export async function GET() {
  const apiKey = process.env.OPENWEATHER_API_KEY
  const results = []

  for (const province of provinces) {
    try {
      // Condições actuais
      const currentRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${province.lat}&lon=${province.lon}&appid=${apiKey}&units=metric&lang=pt`
      )
      const current = await currentRes.json()

      // Previsão 5 dias / 3 horas (inclui probabilidade de chuva)
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${province.lat}&lon=${province.lon}&appid=${apiKey}&units=metric&lang=pt&cnt=16`
      )
      const forecast = await forecastRes.json()

      // Probabilidade de chuva máxima nas próximas 24h
      const next24h = forecast.list?.slice(0, 8) || []
      const maxRainProb = next24h.length > 0
        ? Math.round(Math.max(...next24h.map((f) => (f.pop || 0) * 100)))
        : 0

      // Previsão simplificada para as próximas 48h (por período de 3h)
      const forecastSimple = (forecast.list || []).slice(0, 16).map((f) => ({
        dt: f.dt,
        dt_txt: f.dt_txt,
        temp: f.main?.temp,
        humidity: f.main?.humidity,
        wind_speed: f.wind?.speed,
        rain_prob: Math.round((f.pop || 0) * 100),
        description: f.weather?.[0]?.description,
        icon: f.weather?.[0]?.icon,
      }))

      const weatherRecord = {
        province_id: province.id,
        temperature: current.main?.temp,
        humidity: current.main?.humidity,
        wind_speed: current.wind?.speed,
        wind_direction: String(current.wind?.deg || 0),
        pressure: current.main?.pressure,
        description: current.weather?.[0]?.description,
        icon: current.weather?.[0]?.icon,
        rain_probability: maxRainProb,
        forecast_json: JSON.stringify(forecastSimple),
      }

      await supabase.from('weather_data').insert(weatherRecord)

      results.push({
        province: province.name,
        temperature: weatherRecord.temperature,
        rain_probability: maxRainProb,
        success: true
      })
    } catch (err) {
      results.push({ province: province.name, error: err.message })
    }
  }

  return Response.json({ success: true, total: results.length, data: results })
}
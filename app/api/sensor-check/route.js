import { supabase } from '@/lib/supabase'
import { log } from '@/lib/logger'

export async function GET() {
  const TIMEOUT_MINUTES = 2 // se não chegar dados em 3 min → offline
  const now = new Date()
  const results = []

  const { data: sensors } = await supabase
    .from('sensors')
    .select('id, name, province_id, is_online, last_seen, is_active')
    .eq('is_active', true)

  for (const sensor of sensors || []) {
    if (!sensor.last_seen) continue

    const lastSeen = new Date(sensor.last_seen)
    const minutesAgo = (now.getTime() - lastSeen.getTime()) / 1000 / 60

    if (minutesAgo > TIMEOUT_MINUTES && sensor.is_online) {
      // Sensor ficou offline
      await supabase
        .from('sensors')
        .update({ is_online: false })
        .eq('id', sensor.id)

      await log({
        event_type: 'sensor_offline',
        title: `Central desligada — ${sensor.name}`,
        description: `Sem dados há ${Math.round(minutesAgo)} minutos. Última leitura: ${lastSeen.toLocaleString('pt-AO')}`,
        province_id: sensor.province_id,
        sensor_id: sensor.id,
        severity: 'critical',
      })

      // Gerar alerta de central offline
      await supabase
        .from('alerts')
        .update({ is_active: false, resolved_at: now.toISOString() })
        .eq('province_id', sensor.province_id)
        .eq('type', 'Central Offline')
        .eq('is_active', true)

      await supabase.from('alerts').insert({
        province_id: sensor.province_id,
        type: 'Central Offline',
        severity: 'alerta',
        title: `Central Offline — ${sensor.name}`,
        description: `A central não envia dados há ${Math.round(minutesAgo)} minutos. Verificar alimentação e ligação Wi-Fi.`,
        is_active: true,
      })

      results.push({ sensor: sensor.name, status: 'went_offline', minutes_ago: Math.round(minutesAgo) })

    } else if (minutesAgo <= TIMEOUT_MINUTES) {
      results.push({ sensor: sensor.name, status: 'online', minutes_ago: Math.round(minutesAgo) })
    }
  }

  return Response.json({ success: true, checked: sensors?.length || 0, results, checked_at: now.toISOString() })
}
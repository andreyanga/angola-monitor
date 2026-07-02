import { supabase } from '@/lib/supabase'

export async function log({ event_type, title, description = '', province_id = null, sensor_id = null, severity = 'info' }) {
  try {
    await supabase.from('logs').insert({
      event_type,
      title,
      description,
      province_id,
      sensor_id,
      severity,
    })
  } catch (err) {
    console.error('Erro ao registar log:', err)
  }
}
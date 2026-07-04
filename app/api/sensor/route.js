import { supabase } from '@/lib/supabase'
import { log } from '@/lib/logger'

export async function POST(request) {
  try {
    const body = await request.json()
    const { mac_address, mq135, sw420 } = body

    if (!mac_address) {
      return Response.json({ error: 'mac_address obrigatório' }, { status: 400 })
    }

    // Buscar sensor pelo MAC address
    const { data: sensor, error: sensorError } = await supabase
      .from('sensors')
      .select('id, name, province_id, municipality_id, zone_id, is_online')
      .eq('mac_address', mac_address)
      .single()

    if (sensorError || !sensor) {
      return Response.json({ error: 'Sensor não encontrado' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const wasOffline = !sensor.is_online

    // Actualizar last_seen e is_online
    await supabase
      .from('sensors')
      .update({ last_seen: now, is_online: true, is_active: true })
      .eq('id', sensor.id)

    // Se estava offline e voltou → log de reconexão
    if (wasOffline) {
      await log({
        event_type: 'sensor_online',
        title: `Central reconectada — ${sensor.name}`,
        description: 'A central voltou a enviar dados após período offline.',
        province_id: sensor.province_id,
        sensor_id: sensor.id,
        severity: 'success',
      })

      // Desactivar alerta de offline se existir
      await supabase
        .from('alerts')
        .update({ is_active: false, resolved_at: now })
        .eq('province_id', sensor.province_id)
        .eq('type', 'Central Offline')
        .eq('is_active', true)
    }

    // Calcular status do MQ135
    const mq135Status = mq135 > 2500 ? 'alerta' : mq135 > 1200 ? 'atencao' : 'normal'
    const sw420Status = sw420 >= 2 ? 'alerta' : sw420 >= 1 ? 'atencao' : 'normal'

    // Guardar leituras
    if (mq135 !== undefined) {
      await supabase.from('sensor_readings').insert({
        sensor_id: sensor.id,
        province_id: sensor.province_id,
        municipality_id: sensor.municipality_id,
        zone_id: sensor.zone_id,
        sensor_type: 'MQ-135',
        value: mq135,
        unit: 'ADC',
        status: mq135Status,
      })
    }

    if (sw420 !== undefined) {
      await supabase.from('sensor_readings').insert({
        sensor_id: sensor.id,
        province_id: sensor.province_id,
        municipality_id: sensor.municipality_id,
        zone_id: sensor.zone_id,
        sensor_type: 'SW-420',
        value: sw420,
        unit: '',
        status: sw420Status,
      })
    }

    // Log de leitura
    await log({
      event_type: 'sensor_reading',
      title: `Leitura recebida — ${sensor.name}`,
      description: `MQ-135: ${mq135} ADC (${mq135Status}) | SW-420: ${sw420} (${sw420Status})`,
      province_id: sensor.province_id,
      sensor_id: sensor.id,
      severity: mq135Status === 'alerta' || sw420Status === 'alerta' ? 'critical'
        : mq135Status === 'atencao' || sw420Status === 'atencao' ? 'warning' : 'info',
    })

    // Se algum sensor está em alerta → gerar alerta
    if (mq135Status === 'alerta' || sw420Status === 'alerta') {
      const tipoPerigo = mq135Status === 'alerta' ? 'Poluição do Ar' : 'Vibração Intensa'

      await supabase
        .from('alerts')
        .update({ is_active: false, resolved_at: now })
        .eq('province_id', sensor.province_id)
        .eq('is_active', true)

      await supabase.from('alerts').insert({
        province_id: sensor.province_id,
        type: tipoPerigo,
        severity: 'alerta',
        title: `${tipoPerigo} — ${sensor.name}`,
        description: `MQ-135: ${mq135} ADC | SW-420: ${sw420}. Verificar imediatamente.`,
        is_active: true,
      })
    }

    return Response.json({
      success: true,
      sensor: sensor.name,
      mq135_status: mq135Status,
      sw420_status: sw420Status,
      timestamp: now,
    })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
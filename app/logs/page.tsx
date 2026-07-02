'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Log {
  id: number
  event_type: string
  title: string
  description: string
  severity: string
  created_at: string
  provinces?: { name: string }
}

const eventIcons: Record<string, string> = {
  weather_update: '🌤️',
  ia_report: '🤖',
  alert_generated: '🚨',
  sensor_reading: '📡',
  sensor_offline: '⚫',
  api_error: '❌',
}

const severityColor: Record<string, string> = {
  info: '#3b82f6',
  warning: '#eab308',
  critical: '#ef4444',
  success: '#22c55e',
}

const severityLabel: Record<string, string> = {
  info: 'INFO',
  warning: 'ATENÇÃO',
  critical: 'CRÍTICO',
  success: 'OK',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  useEffect(() => {
    fetchLogs()
  }, [filter, page])

  async function fetchLogs() {
    setLoading(true)
    let query = supabase
      .from('logs')
      .select('*, provinces(name)')
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (filter !== 'all') {
      query = query.eq('event_type', filter)
    }

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
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
            onClick={() => window.location.href = '/'}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
               Logs do Sistema
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
              Histórico de ocorrências e eventos
            </p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          🔄 Actualizar
        </button>
      </header>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'Todos' },
            { key: 'alert_generated', label: ' Alertas' },
            { key: 'ia_report', label: ' Relatórios IA' },
            { key: 'weather_update', label: ' Meteorologia' },
            { key: 'sensor_reading', label: ' Sensores' },
            { key: 'api_error', label: '❌ Erros' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(0) }}
              style={{
                background: filter === f.key ? '#22c55e22' : '#1e293b',
                border: `1px solid ${filter === f.key ? '#22c55e55' : '#334155'}`,
                color: filter === f.key ? '#22c55e' : '#94a3b8',
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: filter === f.key ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* LISTA DE LOGS */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          border: '1px solid #1e3a5f',
          borderRadius: '16px',
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>A carregar...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>📋</p>
              <p style={{ margin: 0 }}>Nenhum log encontrado.</p>
            </div>
          ) : (
            <div>
              {/* Header da tabela */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 120px 100px',
                padding: '0.7rem 1.2rem',
                borderBottom: '1px solid #1e3a5f',
                background: '#0f172a',
              }}>
                {['Data/Hora', 'Evento', 'Província', 'Nível'].map((h) => (
                  <span key={h} style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>

              {/* Linhas */}
              {logs.map((log, i) => (
                <div
                  key={log.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr 120px 100px',
                    padding: '0.8rem 1.2rem',
                    borderBottom: i < logs.length - 1 ? '1px solid #0f172a' : 'none',
                    background: i % 2 === 0 ? 'transparent' : '#0f172a44',
                    alignItems: 'start',
                  }}
                >
                  <span style={{ color: '#475569', fontSize: '0.72rem' }}>
                    {new Date(log.created_at).toLocaleString('pt-AO', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                  <div>
                    <p style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: '600', margin: '0 0 0.2rem 0' }}>
                      {eventIcons[log.event_type] || '📌'} {log.title}
                    </p>
                    {log.description && (
                      <p style={{ color: '#475569', fontSize: '0.72rem', margin: 0 }}>{log.description}</p>
                    )}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {log.provinces?.name || '—'}
                  </span>
                  <span style={{
                    color: severityColor[log.severity] || '#64748b',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    background: `${severityColor[log.severity] || '#64748b'}22`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-block',
                  }}>
                    {severityLabel[log.severity] || log.severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAGINAÇÃO */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              background: '#1e293b', border: '1px solid #334155', color: page === 0 ? '#334155' : '#94a3b8',
              padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: page === 0 ? 'default' : 'pointer', fontSize: '0.8rem'
            }}
          >
            ← Anterior
          </button>
          <span style={{ color: '#64748b', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            Página {page + 1}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={logs.length < PER_PAGE}
            style={{
              background: '#1e293b', border: '1px solid #334155', color: logs.length < PER_PAGE ? '#334155' : '#94a3b8',
              padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: logs.length < PER_PAGE ? 'default' : 'pointer', fontSize: '0.8rem'
            }}
          >
            Próxima →
          </button>
        </div>

      </div>
    </main>
  )
}
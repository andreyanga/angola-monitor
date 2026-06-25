'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const riskColors = {
  normal: '#22c55e',
  atencao: '#eab308',
  alerta: '#ef4444',
}

const normalize = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')

export default function AngolaMap({ onProvinceClick, weatherData, riskByProvinceName, sensors, onSensorClick }) {
  const [geoData, setGeoData] = useState(null)

  useEffect(() => {
    fetch('/data/angola-provinces.json')
      .then((res) => res.json())
      .then((data) => setGeoData(data))
  }, [])

  const styleFeature = (feature) => {
    const name = feature.properties.NAME_1
    const risk = riskByProvinceName?.[normalize(name)] || 'normal'
    return {
      fillColor: riskColors[risk],
      weight: 1.5,
      opacity: 1,
      color: '#fff',
      fillOpacity: 0.7,
    }
  }

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.NAME_1

    layer.bindTooltip(name, {
      permanent: true,
      direction: 'center',
      className: 'province-label',
    })

    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 1, weight: 2.5 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.7, weight: 1.5 }),
      click: () => {
        if (name === 'CuandoCubango' || name === 'Cuando Cubango') {
          if (onProvinceClick) onProvinceClick('__CUANDO_CUBANGO_CHOICE__')
          return
        }
        if (onProvinceClick) onProvinceClick(name)
      },
    })
  }

  const getSensorColor = (sensor) => {
    if (!sensor.is_active) return '#64748b'
    if (sensor.has_alert) return '#ef4444'
    return '#22c55e'
  }

  return (
    <MapContainer
      center={[-11.2, 17.8]}
      zoom={5}
      style={{ height: '600px', width: '100%', borderRadius: '12px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      {geoData && (
        <GeoJSON
          key={JSON.stringify(riskByProvinceName)}
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}

      {/* MARCADORES DAS CENTRAIS */}
      {sensors?.map((sensor) => {
        const color = getSensorColor(sensor)
        return (
          <CircleMarker
            key={sensor.id}
            center={[sensor.latitude, sensor.longitude]}
            radius={sensor.is_active ? 8 : 6}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.9,
              color: '#fff',
              weight: sensor.is_active ? 2 : 1,
              opacity: sensor.is_active ? 1 : 0.5,
            }}
            eventHandlers={{
              click: () => {
                if (sensor.is_active && onSensorClick) {
                  onSensorClick(sensor)
                }
              },
              mouseover: (e) => {
                e.target.setStyle({ radius: sensor.is_active ? 11 : 8 })
              },
              mouseout: (e) => {
                e.target.setStyle({ radius: sensor.is_active ? 8 : 6 })
              },
            }}
          >
            <Popup>
              <div style={{ color: '#000', minWidth: '160px' }}>
                <p style={{ fontWeight: '700', margin: '0 0 0.3rem 0', fontSize: '0.85rem' }}>
                  {sensor.name}
                </p>
                <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem' }}>
                  📍 {sensor.zona} — {sensor.municipio}
                </p>
                <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem' }}>
                  🏛️ {sensor.provincia}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: sensor.is_active ? '#16a34a' : '#64748b' }}>
                  {sensor.is_active ? '🟢 Activa' : '⚫ Inactiva'}
                </p>
                {sensor.is_active && (
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.7rem', color: '#2563eb', cursor: 'pointer' }}>
                    Clica para ver dados
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
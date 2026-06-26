'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const riskColors = {
  normal: '#22c55e',
  atencao: '#eab308',
  alerta: '#ef4444',
}

const normalize = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')

function createSensorIcon(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 36px;
        cursor: pointer;
      ">
        <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" width="28" height="36">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
        </svg>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

function createInactiveIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; width: 22px; height: 28px; cursor: default; opacity: 0.6;">
        <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" width="22" height="28">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
            fill="#64748b" stroke="white" stroke-width="2"/>
          <circle cx="14" cy="14" r="6" fill="white" opacity="0.6"/>
        </svg>
      </div>
    `,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -28],
  })
}

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

      {/* GeoJSON das províncias — z-index baixo */}
      {geoData && (
        <GeoJSON
          key={JSON.stringify(riskByProvinceName)}
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}

      {/* Marcadores das centrais — renderizados por cima do GeoJSON */}
      {sensors?.map((sensor) => {
        if (!sensor.latitude || !sensor.longitude) return null

        const icon = sensor.is_active
          ? createSensorIcon(sensor.has_alert ? '#ef4444' : '#22c55e')
          : createInactiveIcon()

        return (
          <Marker
            key={sensor.id}
            position={[sensor.latitude, sensor.longitude]}
            icon={icon}
            zIndexOffset={sensor.is_active ? 1000 : 500}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation()
                if (sensor.is_active && onSensorClick) {
                  onSensorClick(sensor)
                }
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
                  {sensor.is_active ? '🟢 Activa — clica para ver dados' : '⚫ Inactiva'}
                </p>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
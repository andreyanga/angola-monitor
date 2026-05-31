'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix ícone do marker no Next.js
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function ProvinceMap({ provinceName, latitude, longitude, municipalities }) {
  const [geoData, setGeoData] = useState(null)
  const [provinceGeo, setProvinceGeo] = useState(null)

  useEffect(() => {
    fetch('/data/angola-provinces.json')
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data)
        // Filtrar só a província actual
        const feature = data.features.find(
          (f) => f.properties.NAME_1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
            provinceName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        )
        if (feature) {
          setProvinceGeo({ type: 'FeatureCollection', features: [feature] })
        }
      })
  }, [provinceName])

  const style = () => ({
    fillColor: '#22c55e',
    weight: 2,
    opacity: 1,
    color: '#16a34a',
    fillOpacity: 0.3,
  })

  if (!latitude || !longitude) return null

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={7}
      style={{ height: '350px', width: '100%', borderRadius: '12px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      {provinceGeo && (
        <GeoJSON data={provinceGeo} style={style} />
      )}
      {municipalities?.map((mun) =>
        mun.zones?.map((zone) =>
          zone.sensors?.map((sensor) => (
            <Marker key={sensor.id} position={[zone.latitude || latitude, zone.longitude || longitude]}>
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>{sensor.name}</strong><br />
                  Zona: {zone.name}<br />
                  Município: {mun.name}<br />
                  Tipo: {sensor.sensor_type}<br />
                  Estado: {sensor.is_active ? '🟢 Activo' : '🔴 Inactivo'}
                </div>
              </Popup>
            </Marker>
          ))
        )
      )}
    </MapContainer>
  )
}
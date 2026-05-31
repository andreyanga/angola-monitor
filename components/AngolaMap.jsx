'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'


const riskColors = {
  normal: '#22c55e',
  atencao: '#eab308',
  alerta: '#ef4444',
}

export default function AngolaMap({ onProvinceClick, weatherData }) {
  const [geoData, setGeoData] = useState(null)

  useEffect(() => {
    fetch('/data/angola-provinces.json')
      .then((res) => res.json())
      .then((data) => setGeoData(data))
  }, [])

  const styleFeature = () => ({
    fillColor: riskColors.normal,
    weight: 1.5,
    opacity: 1,
    color: '#fff',
    fillOpacity: 0.7,
  })

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.NAME_1

    layer.bindTooltip(name, {
      permanent: true,
      direction: 'center',
      className: 'province-label',
    })

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ fillOpacity: 1, weight: 2.5 })
      },
      mouseout: (e) => {
        e.target.setStyle({ fillOpacity: 0.7, weight: 1.5 })
      },
      click: () => {
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
      {geoData && (
        <GeoJSON
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  )
}
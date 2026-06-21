'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'


const riskColors = {
  normal: '#22c55e',
  atencao: '#eab308',
  alerta: '#ef4444',
}

const normalize = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')

export default function AngolaMap({ onProvinceClick, weatherData, riskByProvinceName }) {
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
      mouseover: (e) => {
        e.target.setStyle({ fillOpacity: 1, weight: 2.5 })
      },
      mouseout: (e) => {
        e.target.setStyle({ fillOpacity: 0.7, weight: 1.5 })
      },
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
      {geoData && (
        <GeoJSON
          key={JSON.stringify(riskByProvinceName)}
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  )
}
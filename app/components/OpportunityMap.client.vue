<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import type { LatLngExpression, Map as LeafletMap } from 'leaflet'
import type { OpportunityLocation } from '~/types/opportunity'

const props = defineProps<{ location: OpportunityLocation }>()
const config = useRuntimeConfig()
const mapElement = ref<HTMLElement | null>(null)
let map: LeafletMap | undefined

onMounted(async () => {
  const element = mapElement.value
  if (!element) return

  const L = await import('leaflet')

  if (!element.isConnected || mapElement.value !== element) return

  const australiaCentre: LatLngExpression = [-25.2744, 133.7751]

  map = L.map(element, {
    center: australiaCentre,
    zoom: 4,
    scrollWheelZoom: false,
    zoomControl: true
  })

  L.tileLayer(config.public.mapTileUrl, {
    attribution: config.public.mapAttribution,
    maxZoom: 19
  }).addTo(map)

  if (props.location.geometry.type === 'Point') {
    const [longitude, latitude] = props.location.geometry.coordinates
    const markerIcon = L.divIcon({
      className: 'echo-map-marker-wrapper',
      html: '<span class="echo-map-marker"><span></span></span>',
      iconAnchor: [17, 36],
      popupAnchor: [0, -33],
      iconSize: [34, 38]
    })
    const popupLabel = document.createElement('span')
    popupLabel.textContent = props.location.label
    L.marker([latitude, longitude], { icon: markerIcon })
      .addTo(map)
      .bindPopup(popupLabel)
    map.setView([latitude, longitude], 10)
  } else {
    const area = L.geoJSON(props.location.geometry, {
      style: {
        color: '#12634e',
        weight: 2,
        opacity: 0.9,
        fillColor: '#25a675',
        fillOpacity: 0.2
      }
    }).addTo(map)
    const bounds = area.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 })
    }
  }

  requestAnimationFrame(() => map?.invalidateSize())
})

onBeforeUnmount(() => {
  map?.remove()
  map = undefined
})
</script>

<template>
  <div
    ref="mapElement"
    class="opportunity-map"
    role="region"
    :aria-label="`Map showing ${props.location.label}`"
  />
</template>

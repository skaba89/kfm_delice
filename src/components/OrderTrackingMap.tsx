"use client";

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

// Fix Leaflet default icons in Next.js
const driverIcon = L.divIcon({
  html: '🛵',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  className: "",
});

const restaurantIcon = L.divIcon({
  html: '🏪',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: "",
});

const destinationIcon = L.divIcon({
  html: '📍',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: "",
});

export function OrderTrackingMap({
  driverLat,
  driverLng,
  restaurantLat,
  restaurantLng,
}: {
  driverLat: number;
  driverLng: number;
  restaurantLat: number;
  restaurantLng: number;
}) {
  // Calculate center between driver and restaurant
  const centerLat = (driverLat + restaurantLat) / 2;
  const centerLng = (driverLng + restaurantLng) / 2;

  // Calculate zoom based on distance
  const distance = Math.sqrt(
    Math.pow(driverLat - restaurantLat, 2) + Math.pow(driverLng - restaurantLng, 2)
  );
  const zoom = distance > 0.05 ? 13 : 15;

  return (
    <div style={{ height: "300px", width: "100%" }}>
      <MapContainer
        center={[centerLat || 9.5092, centerLng || -13.7122]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        {/* Restaurant marker */}
        <Marker
          position={[restaurantLat || 9.5092, restaurantLng || -13.7122]}
          icon={restaurantIcon}
        />

        {/* Driver marker */}
        <Marker
          position={[driverLat, driverLng]}
          icon={driverIcon}
        />

        {/* Route line */}
        <Polyline
          positions={[
            [driverLat, driverLng],
            [restaurantLat || 9.5092, restaurantLng || -13.7122],
          ]}
          pathOptions={{ color: "#ea580c", weight: 3, dashArray: "10,10" }}
        />
      </MapContainer>
    </div>
  );
}

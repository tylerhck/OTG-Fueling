"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ServiceArea {
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  name: string;
}

interface MapProps {
  serviceAreas: ServiceArea[];
  height?: string;
  markerPos?: { lat: number; lng: number } | null;
}

export default function Map({ serviceAreas, height = "400px", markerPos }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const center: [number, number] =
      serviceAreas.length > 0
        ? [serviceAreas[0].centerLat, serviceAreas[0].centerLng]
        : [32.7555, -97.3308];

    const map = L.map(mapRef.current).setView(center, 11);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    serviceAreas.forEach((area) => {
      const radiusMeters = area.radiusMiles * 1609.34;
      L.circle([area.centerLat, area.centerLng], {
        radius: radiusMeters,
        color: "#ea580c",
        fillColor: "#fed7aa",
        fillOpacity: 0.3,
        weight: 2,
      })
        .addTo(map)
        .bindPopup(`<b>${area.name}</b><br>${area.radiusMiles} mile radius`);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [serviceAreas]);

  // Update the address pin whenever markerPos changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (!markerPos) return;

    const icon = L.divIcon({
      html: `<div style="
        width:20px;height:20px;
        background:#ef4444;border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      "></div>`,
      className: "",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker([markerPos.lat, markerPos.lng], { icon })
      .addTo(map)
      .bindPopup("Your address")
      .openPopup();

    markerRef.current = marker;
    map.setView([markerPos.lat, markerPos.lng], 13, { animate: true });
  }, [markerPos]);

  return <div ref={mapRef} style={{ height, width: "100%" }} className="rounded-xl z-0" />;
}

"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ServiceAreaMapProps {
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  onCenterChange?: (lat: number, lng: number) => void;
  height?: string;
}

export default function ServiceAreaMap({
  centerLat,
  centerLng,
  radiusMiles,
  onCenterChange,
  height = "350px",
}: ServiceAreaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 10);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Click handler to reposition center
    if (onCenterChange) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onCenterChange(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update circle + marker when center/radius changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    const radiusMeters = radiusMiles * 1609.34;

    circleRef.current = L.circle([centerLat, centerLng], {
      radius: radiusMeters,
      color: "#ea580c",
      fillColor: "#fed7aa",
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(map);

    // Small dot for center
    markerRef.current = L.circleMarker([centerLat, centerLng], {
      radius: 6,
      color: "#ea580c",
      fillColor: "#ea580c",
      fillOpacity: 1,
      weight: 2,
    }).addTo(map);

    // Fit map to the circle bounds
    map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
  }, [centerLat, centerLng, radiusMiles]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: "100%" }}
      className="rounded-xl z-0 border border-slate-200"
    />
  );
}

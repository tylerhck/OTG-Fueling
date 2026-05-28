"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = () =>
  L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#ea580c"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
  });

interface PinMapProps {
  center: { lat: number; lng: number };
  onChange?: (lat: number, lng: number) => void;
  height?: string;
}

export default function PinMap({ center, onChange, height = "200px" }: PinMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([center.lat, center.lng], 17);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], {
      draggable: !!onChange,
      icon: pinIcon(),
    }).addTo(map);
    markerRef.current = marker;

    if (onChange) {
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onChange(lat, lng);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([center.lat, center.lng]);
    map.setView([center.lat, center.lng], 17);
  }, [center.lat, center.lng]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: "100%" }}
      className="rounded-xl z-0 border border-slate-200"
    />
  );
}

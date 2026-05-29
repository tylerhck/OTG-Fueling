"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ExistingArea {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  polygon: [number, number][] | null;
}

interface ServiceAreaMapProps {
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  onCenterChange?: (lat: number, lng: number) => void;
  height?: string;
  existingAreas?: ExistingArea[];
  editingAreaId?: string | null;
}

export default function ServiceAreaMap({
  centerLat,
  centerLng,
  radiusMiles,
  onCenterChange,
  height = "700px",
  existingAreas = [],
  editingAreaId = null,
}: ServiceAreaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const existingLayersRef = useRef<L.Layer[]>([]);

  const drawExistingAreas = useCallback((map: L.Map, areas: ExistingArea[], skipId: string | null) => {
    existingLayersRef.current.forEach((l) => l.remove());
    existingLayersRef.current = [];

    areas.forEach((area) => {
      if (skipId && area.id === skipId) return;

      if (area.polygon && Array.isArray(area.polygon) && area.polygon.length >= 3) {
        const poly = L.polygon(
          area.polygon.map((p) => [p[0], p[1]] as L.LatLngTuple),
          {
            color: "#6b7280",
            fillColor: "#d1d5db",
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "5, 5",
          }
        ).addTo(map);
        poly.bindTooltip(area.name, { sticky: true, className: "existing-area-label" });
        existingLayersRef.current.push(poly);
      } else {
        const radiusMeters = area.radiusMiles * 1609.34;
        const circle = L.circle([area.centerLat, area.centerLng], {
          radius: radiusMeters,
          color: "#6b7280",
          fillColor: "#d1d5db",
          fillOpacity: 0.15,
          weight: 2,
          dashArray: "5, 5",
        }).addTo(map);
        circle.bindTooltip(area.name, { sticky: true, className: "existing-area-label" });
        existingLayersRef.current.push(circle);
      }
    });
  }, []);

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

    if (onCenterChange) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onCenterChange(e.latlng.lat, e.latlng.lng);
      });
    }

    drawExistingAreas(map, existingAreas, editingAreaId);

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

    markerRef.current = L.circleMarker([centerLat, centerLng], {
      radius: 6,
      color: "#ea580c",
      fillColor: "#ea580c",
      fillOpacity: 1,
      weight: 2,
    }).addTo(map);

    map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
  }, [centerLat, centerLng, radiusMiles]);

  // Redraw existing areas when they change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    drawExistingAreas(map, existingAreas, editingAreaId);
  }, [existingAreas, editingAreaId, drawExistingAreas]);

  return (
    <>
      <div
        ref={mapRef}
        style={{ height, width: "100%" }}
        className="rounded-xl z-0 border border-slate-200"
      />
      <style jsx global>{`
        .existing-area-label {
          background: #374151 !important;
          border: none !important;
          color: white !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 2px 8px !important;
          border-radius: 6px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
        }
        .existing-area-label::before {
          display: none !important;
        }
      `}</style>
    </>
  );
}

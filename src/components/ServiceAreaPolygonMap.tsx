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

interface ServiceAreaPolygonMapProps {
  polygon: [number, number][];
  onPolygonChange?: (polygon: [number, number][]) => void;
  centerLat?: number;
  centerLng?: number;
  height?: string;
  readOnly?: boolean;
  existingAreas?: ExistingArea[];
  editingAreaId?: string | null;
}

export default function ServiceAreaPolygonMap({
  polygon,
  onPolygonChange,
  centerLat = 32.7555,
  centerLng = -97.3308,
  height = "700px",
  readOnly = false,
  existingAreas = [],
  editingAreaId = null,
}: ServiceAreaPolygonMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const existingLayersRef = useRef<L.Layer[]>([]);
  const polygonRef = useRef<[number, number][]>(polygon);

  useEffect(() => {
    polygonRef.current = polygon;
  }, [polygon]);

  const drawExistingAreas = useCallback((map: L.Map, areas: ExistingArea[], skipId: string | null) => {
    // Remove old existing area layers
    existingLayersRef.current.forEach((l) => l.remove());
    existingLayersRef.current = [];

    areas.forEach((area) => {
      if (skipId && area.id === skipId) return; // Don't draw the one being edited

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

  const drawPolygon = useCallback((map: L.Map, points: [number, number][]) => {
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (points.length < 2) {
      points.forEach((p) => {
        const marker = L.circleMarker([p[0], p[1]], {
          radius: 7,
          color: "#dc2626",
          fillColor: "#dc2626",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        markersRef.current.push(marker);
      });
      return;
    }

    polygonLayerRef.current = L.polygon(
      points.map((p) => [p[0], p[1]] as L.LatLngTuple),
      {
        color: "#dc2626",
        fillColor: "#fecaca",
        fillOpacity: 0.25,
        weight: 2,
      }
    ).addTo(map);

    points.forEach((p, idx) => {
      const marker = L.circleMarker([p[0], p[1]], {
        radius: 6,
        color: "#dc2626",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      marker.bindTooltip(`${idx + 1}`, { permanent: true, direction: "center", className: "polygon-vertex-label" });
      markersRef.current.push(marker);
    });

    if (points.length >= 3) {
      map.fitBounds(polygonLayerRef.current.getBounds(), { padding: [30, 30] });
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 11);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    if (!readOnly && onPolygonChange) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const newPolygon: [number, number][] = [...polygonRef.current, [e.latlng.lat, e.latlng.lng]];
        onPolygonChange(newPolygon);
      });
    }

    // Draw existing saved areas as background
    drawExistingAreas(map, existingAreas, editingAreaId);

    if (polygon.length > 0) {
      drawPolygon(map, polygon);
      if (polygon.length >= 3) {
        const bounds = L.latLngBounds(polygon.map((p) => [p[0], p[1]] as L.LatLngTuple));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    drawPolygon(map, polygon);
  }, [polygon, drawPolygon]);

  // Redraw existing areas when they change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    drawExistingAreas(map, existingAreas, editingAreaId);
  }, [existingAreas, editingAreaId, drawExistingAreas]);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ height, width: "100%" }}
        className="rounded-xl z-0 border border-slate-200"
      />
      <style jsx global>{`
        .polygon-vertex-label {
          background: #dc2626 !important;
          border: none !important;
          color: white !important;
          font-size: 10px !important;
          font-weight: bold !important;
          padding: 1px 4px !important;
          border-radius: 50% !important;
          box-shadow: none !important;
        }
        .polygon-vertex-label::before {
          display: none !important;
        }
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
    </div>
  );
}

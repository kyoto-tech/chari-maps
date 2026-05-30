import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";

const POLL_INTERVAL_MS = 2000;
const OVERPASS_RADIUS_M = 50;
const REFETCH_THRESHOLD_M = 30;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Visually distinct colors for road ways
const WAY_COLORS = [
  "#e11d48", "#d97706", "#16a34a", "#0284c7", "#7c3aed",
  "#db2777", "#ea580c", "#65a30d", "#0891b2", "#9333ea",
  "#dc2626", "#ca8a04", "#15803d", "#1d4ed8", "#6d28d9",
];

function wayColor(wayId: number, colorMap: Map<number, string>): string {
  if (!colorMap.has(wayId)) {
    colorMap.set(wayId, WAY_COLORS[colorMap.size % WAY_COLORS.length]);
  }
  return colorMap.get(wayId)!;
}

type OsmNode = { lat: number; lon: number };
type OsmWay = { id: number; geometry: OsmNode[]; tags?: Record<string, string> };

async function fetchNearbySegments(lat: number, lon: number): Promise<OsmWay[]> {
  const query = `[out:json];way(around:${OVERPASS_RADIUS_M},${lat},${lon})["highway"];out geom;`;
  const res = await fetch(OVERPASS_URL, { method: "POST", body: query });
  const data = await res.json();
  return data.elements as OsmWay[];
}

function findNearestSegment(userLat: number, userLon: number, ways: OsmWay[]) {
  const userPoint = turf.point([userLon, userLat]);
  let nearest: {
    way: OsmWay;
    segmentIndex: number;
    segment: ReturnType<typeof turf.lineString>;
    snapped: ReturnType<typeof turf.nearestPointOnLine>;
    dist: number;
  } | null = null;
  let minDist = Infinity;

  for (const way of ways) {
    const nodes = way.geometry;
    for (let i = 0; i < nodes.length - 1; i++) {
      const segment = turf.lineString([
        [nodes[i].lon, nodes[i].lat],
        [nodes[i + 1].lon, nodes[i + 1].lat],
      ]);
      const snapped = turf.nearestPointOnLine(segment, userPoint, { units: "meters" });
      const dist = snapped.properties.dist ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        nearest = { way, segmentIndex: i, segment, snapped, dist };
      }
    }
  }
  return nearest;
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  // Layers drawn each tick — cleared and redrawn on every update
  const wayLayersRef = useRef<L.Polyline[]>([]);
  const nearestLayerRef = useRef<L.Polyline | null>(null);
  const snappedMarkerRef = useRef<L.CircleMarker | null>(null);
  // Stable way-id → color mapping so colors don't shuffle between ticks
  const colorMapRef = useRef<Map<number, string>>(new Map());

  const lastFetchPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const waysRef = useRef<OsmWay[]>([]);
  const [status, setStatus] = useState("Waiting for location…");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([51.505, -0.09], 17);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    userMarkerRef.current = L.circleMarker([51.505, -0.09], {
      radius: 8,
      color: "#2563eb",
      fillColor: "#60a5fa",
      fillOpacity: 1,
      weight: 2,
    }).addTo(map);

    async function tick() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lon } = pos.coords;

          // Move user marker and pan map
          userMarkerRef.current?.setLatLng([lat, lon]);
          mapRef.current?.setView([lat, lon], mapRef.current.getZoom(), { animate: true });

          // Decide whether to refetch OSM data
          const last = lastFetchPosRef.current;
          const movedFar =
            !last ||
            turf.distance(turf.point([lon, lat]), turf.point([last.lon, last.lat]), {
              units: "meters",
            }) > REFETCH_THRESHOLD_M;

          if (movedFar) {
            setStatus("Fetching road data…");
            try {
              waysRef.current = await fetchNearbySegments(lat, lon);
              lastFetchPosRef.current = { lat, lon };
            } catch {
              setStatus("Overpass fetch failed");
              return;
            }
          }

          // Clear previous layers
          wayLayersRef.current.forEach((l) => l.remove());
          wayLayersRef.current = [];
          nearestLayerRef.current?.remove();
          snappedMarkerRef.current?.remove();

          const map = mapRef.current!;
          const colorMap = colorMapRef.current;

          // Draw every way in its assigned color
          for (const way of waysRef.current) {
            const color = wayColor(way.id, colorMap);
            const latLngs = way.geometry.map((n) => [n.lat, n.lon] as L.LatLngTuple);
            const layer = L.polyline(latLngs, { color, weight: 4, opacity: 0.75 })
              .addTo(map)
              .bindPopup(way.tags?.name ?? "Unnamed road");
            wayLayersRef.current.push(layer);
          }

          // Overdraw the nearest segment highlighted
          const result = findNearestSegment(lat, lon, waysRef.current);
          if (result) {
            const coords = result.segment.geometry.coordinates.map(
              ([lng, lt]) => [lt, lng] as L.LatLngTuple
            );
            const baseColor = wayColor(result.way.id, colorMap);
            // White halo then colored stroke on top to make it pop
            const halo = L.polyline(coords, { color: "#fff", weight: 9, opacity: 1 }).addTo(map);
            wayLayersRef.current.push(halo);
            nearestLayerRef.current = L.polyline(coords, { color: baseColor, weight: 6, opacity: 1 })
              .addTo(map)
              .bindPopup(`${result.way.tags?.name ?? "Unnamed road"} — ${result.dist.toFixed(1)} m`);
            wayLayersRef.current.push(nearestLayerRef.current);

            const [sLon, sLat] = result.snapped.geometry.coordinates;
            snappedMarkerRef.current = L.circleMarker([sLat, sLon], {
              radius: 6,
              color: "#fff",
              fillColor: baseColor,
              fillOpacity: 1,
              weight: 2,
            })
              .addTo(map)
              .bindPopup("Nearest point on road");

            setStatus(
              `${result.way.tags?.name ?? "Unnamed"} · ${result.dist.toFixed(1)} m away`
            );
          } else {
            setStatus("No road found nearby");
          }
        },
        () => setStatus("Location access denied"),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      wayLayersRef.current.forEach((l) => l.remove());
      wayLayersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium shadow-md backdrop-blur">
        {status}
      </div>
    </div>
  );
}

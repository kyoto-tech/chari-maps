import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import StreetSelection, { type OsmWay, type OsmWayWithDist } from "./StreetSelection";

const POLL_INTERVAL_MS = 2000;
const OVERPASS_RADIUS_M = 50;
const REFETCH_THRESHOLD_M = 30;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

async function fetchNearbyWays(lat: number, lon: number): Promise<OsmWay[]> {
  const query = `[out:json];way(around:${OVERPASS_RADIUS_M},${lat},${lon})["highway"];out geom;`;
  const res = await fetch(OVERPASS_URL, { method: "POST", body: query });
  const data = await res.json();
  return data.elements as OsmWay[];
}

function nearestDistForWay(userLat: number, userLon: number, way: OsmWay): number {
  const userPoint = turf.point([userLon, userLat]);
  let minDist = Infinity;
  const nodes = way.geometry;
  for (let i = 0; i < nodes.length - 1; i++) {
    const segment = turf.lineString([
      [nodes[i].lon, nodes[i].lat],
      [nodes[i + 1].lon, nodes[i + 1].lat],
    ]);
    const dist =
      turf.nearestPointOnLine(segment, userPoint, { units: "meters" }).properties.dist ?? Infinity;
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  // Follow mode: pan to user on each tick. Disabled by manual map interaction.
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  // Set to true before programmatic setView so the movestart listener ignores it.
  const programmaticMoveRef = useRef(false);
  // Last known position, used for the "center on me" button.
  const lastPosRef = useRef<{ lat: number; lon: number } | null>(null);

  const lastFetchPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const waysRef = useRef<OsmWay[]>([]);
  const [sortedWays, setSortedWays] = useState<OsmWayWithDist[]>([]);
  const [status, setStatus] = useState("Waiting for location…");

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapInstance) return;

    const map = L.map(containerRef.current).setView([51.505, -0.09], 17);

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

    // Detect manual pan/zoom — ignore moves we triggered ourselves
    map.on("movestart", () => {
      if (!programmaticMoveRef.current) {
        followingRef.current = false;
        setFollowing(false);
      }
    });

    setMapInstance(map);
    return () => {
      map.remove();
      setMapInstance(null);
    };
  }, []);

  // Geolocation polling
  useEffect(() => {
    if (!mapInstance) return;

    async function tick() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lon } = pos.coords;
          lastPosRef.current = { lat, lon };

          userMarkerRef.current?.setLatLng([lat, lon]);

          if (followingRef.current) {
            programmaticMoveRef.current = true;
            mapInstance.setView([lat, lon], mapInstance.getZoom(), { animate: true });
            programmaticMoveRef.current = false;
          }

          const last = lastFetchPosRef.current;
          const movedFar =
            !last ||
            turf.distance(turf.point([lon, lat]), turf.point([last.lon, last.lat]), {
              units: "meters",
            }) > REFETCH_THRESHOLD_M;

          if (movedFar) {
            setStatus("Fetching road data…");
            try {
              waysRef.current = await fetchNearbyWays(lat, lon);
              lastFetchPosRef.current = { lat, lon };
            } catch {
              setStatus("Overpass fetch failed");
              return;
            }

            const withDist: OsmWayWithDist[] = waysRef.current
              .filter((w) => {
                const nodes = w.geometry;
                if (nodes.length < 2) return false;
                const line = turf.lineString(nodes.map((n) => [n.lon, n.lat]));
                return turf.length(line, { units: "meters" }) >= 5;
              })
              .map((w) => ({ ...w, dist: nearestDistForWay(lat, lon, w) }))
              .sort((a, b) => a.dist - b.dist);

            setSortedWays(withDist);
            setStatus(
              withDist.length
                ? `${withDist[0].tags?.name ?? "Unnamed"} · ${withDist[0].dist.toFixed(0)} m`
                : "No roads found nearby"
            );
          }
        },
        () => setStatus("Location access denied"),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mapInstance]);

  function centerOnMe() {
    if (!mapInstance) return;
    followingRef.current = true;
    setFollowing(true);
    if (lastPosRef.current) {
      const { lat, lon } = lastPosRef.current;
      programmaticMoveRef.current = true;
      mapInstance.setView([lat, lon], mapInstance.getZoom(), { animate: true });
      programmaticMoveRef.current = false;
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Locate button — top right, always visible */}
      <button
        onClick={centerOnMe}
        title="Center on me"
        className={`absolute right-4 top-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors ${
          following
            ? "bg-blue-500 text-white"
            : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" strokeDasharray="2 2" strokeOpacity={0.4} />
        </svg>
      </button>

      <StreetSelection map={mapInstance} ways={sortedWays} />
    </div>
  );
}

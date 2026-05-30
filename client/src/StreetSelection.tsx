import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import StreetForm from "./StreetForm";

export type OsmNode = { lat: number; lon: number };
export type OsmWay = { id: number; geometry: OsmNode[]; tags?: Record<string, string> };
export type OsmWayWithDist = OsmWay & { dist: number };

interface Props {
  map: L.Map | null;
  ways: OsmWayWithDist[];
}

export default function StreetSelection({ map, ways }: Props) {
  // Track selection by way ID so it survives list refreshes
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const layersRef = useRef<L.Polyline[]>([]);

  // Derive index: find the selected way in the current list, fall back to 0
  const selectedIdx = selectedId !== null
    ? Math.max(0, ways.findIndex((w) => w.id === selectedId))
    : 0;

  const select = (idx: number) => setSelectedId(ways[idx]?.id ?? null);

  useEffect(() => {
    if (!map) return;

    layersRef.current.forEach((l) => l.remove());
    layersRef.current = [];

    for (let i = 0; i < ways.length; i++) {
      const way = ways[i];
      const active = i === selectedIdx;
      const latLngs = way.geometry.map((n) => [n.lat, n.lon] as L.LatLngTuple);

      if (active) {
        const halo = L.polyline(latLngs, { color: "#fff", weight: 10, opacity: 1 }).addTo(map);
        const line = L.polyline(latLngs, { color: "#ef4444", weight: 7, opacity: 1 })
          .addTo(map)
          .bindPopup(way.tags?.name ?? "Unnamed road");
        layersRef.current.push(halo, line);
      } else {
        const line = L.polyline(latLngs, { color: "#000", weight: 5, opacity: 0.35 })
          .addTo(map)
          .bindPopup(way.tags?.name ?? "Unnamed road");
        layersRef.current.push(line);
      }
    }

    return () => {
      layersRef.current.forEach((l) => l.remove());
      layersRef.current = [];
    };
  }, [map, ways, selectedIdx]);

  const selected = ways[selectedIdx];

  return (
    <>
      {sheetOpen && selected && (
        <StreetForm way={selected} onClose={() => setSheetOpen(false)} />
      )}

    <div className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-col items-center gap-3 p-4">
      {selected && (
        <button
          onClick={() => setSheetOpen(true)}
          className="rounded-full bg-white/90 px-6 py-3 text-base font-semibold shadow-lg backdrop-blur transition-transform active:scale-95"
        >
          {selected.tags?.name ?? "Unnamed road"}
          <span className="ml-2 font-normal text-gray-500">{selected.dist.toFixed(0)} m</span>
        </button>
      )}

      <div className="flex w-full gap-3">
        <button
          onClick={() => select(Math.max(0, selectedIdx - 1))}
          disabled={selectedIdx === 0}
          className="flex-1 rounded-2xl bg-white py-5 text-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-30"
        >
          ← Prev
          {selectedIdx > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">{selectedIdx}</span>
          )}
        </button>
        <button
          onClick={() => select(Math.min(ways.length - 1, selectedIdx + 1))}
          disabled={selectedIdx === ways.length - 1}
          className="flex-1 rounded-2xl bg-white py-5 text-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-30"
        >
          {ways.length - 1 - selectedIdx > 0 && (
            <span className="mr-2 text-sm font-normal text-gray-400">{ways.length - 1 - selectedIdx}</span>
          )}
          Next →
        </button>
      </div>
    </div>
    </>
  );
}

import { useEffect, useState } from "react";
import type { OsmWayWithDist } from "./StreetSelection";

interface Props {
  way: OsmWayWithDist;
  onClose: () => void;
}

function computeAabb(way: OsmWayWithDist) {
  const lats = way.geometry.map((n) => n.lat);
  const lons = way.geometry.map((n) => n.lon);
  return {
    min: { lat: Math.min(...lats), lng: Math.min(...lons) },
    max: { lat: Math.max(...lats), lng: Math.max(...lons) },
  };
}

const SAFETY_LABELS = ["", "Dangerous", "Risky", "Okay", "Safe", "Very Safe"];
const QUALITY_LABELS = ["", "Very Poor", "Poor", "Fair", "Good", "Excellent"];

function RatingSlider({
  label,
  description,
  value,
  onChange,
  sublabels,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  sublabels: string[];
}) {
  const pct = ((value - 1) / 4) * 100;
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-lg font-bold text-gray-900">{label}</span>
        <span className="text-sm font-semibold text-red-500">{sublabels[value]}</span>
      </div>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="street-slider"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
      <div className="flex justify-between mt-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 w-10 rounded-full text-sm font-bold transition-all active:scale-90 ${
              value === n
                ? "bg-red-500 text-white shadow-md"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function RainSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Rain Cover</p>
          <p className="text-sm text-gray-400 mt-0.5">Is this road sheltered from rain?</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none ${
            value ? "bg-red-500" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
              value ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export default function StreetForm({ way, onClose }: Props) {
  const [safety, setSafety] = useState(3);
  const [quality, setQuality] = useState(3);
  const [covered, setCovered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const name = way.tags?.name ?? "Unnamed road";
  const highway = way.tags?.highway ?? "";

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE ?? "";
      const res = await fetch(`${base}/api/maps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          osm_segment: String(way.id),
          data: { safety, road_quality: quality, covered },
          aabb: computeAabb(way),
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[2000] flex flex-col justify-end">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative flex flex-col rounded-t-3xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-2 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {way.dist.toFixed(0)} m away{highway ? ` · ${highway}` : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
          <RatingSlider
            label="Safety"
            description="How safe do you feel cycling here?"
            value={safety}
            onChange={setSafety}
            sublabels={SAFETY_LABELS}
          />

          <div className="h-px bg-gray-100 mb-8" />

          <RatingSlider
            label="Road Quality"
            description="How smooth and well-maintained is the surface?"
            value={quality}
            onChange={setQuality}
            sublabels={QUALITY_LABELS}
          />

          <div className="h-px bg-gray-100 mb-8" />

          <RainSwitch value={covered} onChange={setCovered} />
        </div>

        {/* Save button */}
        <div className="px-6 pb-10 pt-2 flex-shrink-0">
          {error && (
            <p className="mb-3 text-center text-sm text-red-500">{error}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-2xl bg-red-500 py-5 text-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}

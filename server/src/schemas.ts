import { z } from 'zod';

const Point = z.object({
  lat: z.number(),
  lng: z.number(),
});

// Input for storing a map segment. `data` is a free-form JSON payload;
// tighten this schema once the shape is known.
export const MapSegmentInput = z.object({
  osm_segment: z.string().min(1),
  data: z.record(z.unknown()),
  aabb: z.object({ min: Point, max: Point }),
});

export const BoundingBoxQuery = z.object({
  min_lat: z.coerce.number(),
  min_lng: z.coerce.number(),
  max_lat: z.coerce.number(),
  max_lng: z.coerce.number(),
});

export type MapSegmentInput = z.infer<typeof MapSegmentInput>;
export type BoundingBoxQuery = z.infer<typeof BoundingBoxQuery>;

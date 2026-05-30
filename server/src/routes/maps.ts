import { Router, Request, Response } from 'express';
import { db } from '../db';
import { MapSegmentInput, BoundingBoxQuery } from '../schemas';

const router = Router();

async function insertSegment(row: Record<string, unknown>): Promise<number> {
  const client = (db.client as { config: { client: string } }).config.client;
  const isPostgres = client === 'pg' || client === 'postgresql';
  if (isPostgres) {
    const [{ id }] = await db('map_segments').insert(row).returning('id');
    return id as number;
  }
  const [id] = await db('map_segments').insert(row);
  return id as number;
}

router.post('/', async (req: Request, res: Response) => {
  const parsed = MapSegmentInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten() });
  }

  const { osm_segment, data, aabb } = parsed.data;

  try {
    const id = await insertSegment({
      osm_segment,
      data: JSON.stringify(data),
      aabb_min_lat: aabb.min.lat,
      aabb_min_lng: aabb.min.lng,
      aabb_max_lat: aabb.max.lat,
      aabb_max_lng: aabb.max.lng,
    });
    return res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /maps/query?min_lat=…&min_lng=…&max_lat=…&max_lng=…
// Returns all segments whose AABB overlaps the query box.
router.get('/query', async (req: Request, res: Response) => {
  const parsed = BoundingBoxQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten() });
  }

  const { min_lat, min_lng, max_lat, max_lng } = parsed.data;

  try {
    const rows = await db('map_segments')
      // AABB overlap: stored.min <= query.max AND stored.max >= query.min (both axes)
      .where('aabb_min_lat', '<=', max_lat)
      .where('aabb_max_lat', '>=', min_lat)
      .where('aabb_min_lng', '<=', max_lng)
      .where('aabb_max_lng', '>=', min_lng)
      .select('id', 'osm_segment', 'data', 'aabb_min_lat', 'aabb_min_lng', 'aabb_max_lat', 'aabb_max_lng', 'created_at');

    const result = rows.map((r) => ({
      id: r.id,
      osm_segment: r.osm_segment,
      data: JSON.parse(r.data as string),
      aabb: {
        min: { lat: r.aabb_min_lat, lng: r.aabb_min_lng },
        max: { lat: r.aabb_max_lat, lng: r.aabb_max_lng },
      },
      created_at: r.created_at,
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

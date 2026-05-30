import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('map_segments', (t) => {
    t.increments('id').primary();
    t.text('osm_segment').notNullable();
    t.text('data').notNullable();
    t.float('aabb_min_lat').notNullable();
    t.float('aabb_min_lng').notNullable();
    t.float('aabb_max_lat').notNullable();
    t.float('aabb_max_lng').notNullable();
    t.timestamps(true, true);

    // Composite indexes let the DB prune by one axis before evaluating the other.
    t.index(['aabb_min_lat', 'aabb_max_lat'], 'idx_aabb_lat');
    t.index(['aabb_min_lng', 'aabb_max_lng'], 'idx_aabb_lng');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('map_segments');
}

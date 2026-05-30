import type { Knex } from 'knex';

const config: Record<string, Knex.Config> = {
  development: {
    client: 'sqlite3',
    connection: { filename: './dev.sqlite3' },
    useNullAsDefault: true,
    migrations: { directory: './migrations', extension: 'ts' },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: { directory: './migrations', extension: 'js' },
  },
};

export default config;

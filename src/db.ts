/**
 * Database client for HR Platform shared package
 *
 * Uses the same Supabase PostgreSQL instance as Integriverse.
 * Global singleton pattern to prevent HMR connection resets in Next.js dev mode.
 *
 * IMPORTANT: Both apps (Integriverse + HR) connect to the SAME database.
 * Connection pooling is handled by Supabase Supavisor (port 6543).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const CONNECTION_OPTIONS = {
  prepare: false,           // Required for Supabase Supavisor transaction pooler
  max: process.env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 0,          // Let Supabase pooler manage idle connections
  connect_timeout: 3,       // Fail fast if connection takes >3s
  max_lifetime: 0,          // Let Supabase pooler manage connection lifecycle
  fetch_types: false,       // Faster startup
  connection: {
    application_name: 'hr-platform',
    search_path: 'public',
  },
};

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error('POSTGRES_URL environment variable is required');
}

declare global {
  var __hrDbClient: postgres.Sql | undefined;
}

const client = globalThis.__hrDbClient || postgres(databaseUrl, CONNECTION_OPTIONS);

if (!globalThis.__hrDbClient) {
  globalThis.__hrDbClient = client;
}

export const db = drizzle(client);
export const pgClient = client;

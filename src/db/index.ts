import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { env } from '@/lib/env';
import * as schema from './schema';

/**
 * Neon's HTTP driver: no connection lifecycle to manage, which suits
 * serverless functions that may be cold-started per request.
 *
 * Uses the POOLED connection string. Schema migrations go through
 * drizzle.config.ts, which uses the direct string instead.
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export { schema };

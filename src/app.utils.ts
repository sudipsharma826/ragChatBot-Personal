import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Token identifiers for shared providers */
export const REDIS_CLIENT = 'REDIS_CLIENT';
export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

/**
 * Create and return a shared Redis client instance.
 * Throws an error if the required `REDIS_URL` environment variable is missing.
 */
export function getRedisClient(config: ConfigService): Redis {
  const url = config.get<string>('REDIS_URL');
  if (!url) {
    throw new Error('REDIS_URL is required in environment');
  }
  return new Redis(url);
}

/**
 * Create and return a shared Supabase client instance.
 * Throws an error if `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` are missing.
 */
export function getSupabaseClient(config: ConfigService): SupabaseClient {
  const url = config.get<string>('SUPABASE_URL');
  const key = config.get<string>('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in environment');
  }
  return createClient(url, key);
}

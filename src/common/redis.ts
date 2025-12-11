import Redis from 'ioredis';

// Lazily create a singleton Redis client
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL;
    redisClient = url
      ? new Redis(url)
      : new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || '432423@fsdfAs',
          db: Number(process.env.REDIS_DB || 0),
        });

    redisClient.on('error', (err) => {
      // Avoid throwing inside event; just log for observability
      console.error('Redis error:', err?.message || err);
    });
  }
  return redisClient;
}

export async function redisGet<T = any>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null as unknown as T;
  }
}

export async function redisSet(
  key: string,
  value: any,
  ttlSeconds?: number,
): Promise<void> {
  const client = getRedisClient();
  const payload = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await client.set(key, payload, 'EX', Math.floor(ttlSeconds));
  } else {
    await client.set(key, payload);
  }
}

export async function redisDel(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

/**
 * Get TTL (time to live) for a Redis key in seconds
 * @param key - Redis key
 * @returns TTL in seconds, -2 if key doesn't exist, -1 if key has no expiry
 */
export async function getRedisTTL(key: string): Promise<number> {
  const client = getRedisClient();
  return await client.ttl(key);
}

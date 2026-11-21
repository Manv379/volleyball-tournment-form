const { Redis } = require('@upstash/redis');

// In-memory fallback so the app works immediately even before Upstash Redis is connected.
// For permanent cloud persistence across deployments, connect Upstash Redis in Vercel Storage.
if (!global.__TEAMKIT_ORDERS__) {
  global.__TEAMKIT_ORDERS__ = [];
}

function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return new Redis({ url, token });
  }
  return null;
}

const ORDERS_KEY = 'teamkit:orders';

async function getAllOrders() {
  const redis = getRedisClient();
  if (redis) {
    const data = await redis.get(ORDERS_KEY);
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return []; }
    }
    return [];
  }
  return global.__TEAMKIT_ORDERS__;
}

async function saveAllOrders(orders) {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(ORDERS_KEY, JSON.stringify(orders));
    return;
  }
  global.__TEAMKIT_ORDERS__ = orders;
}

function isPersistentStorageEnabled() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

module.exports = {
  getAllOrders,
  saveAllOrders,
  isPersistentStorageEnabled
};

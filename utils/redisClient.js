let client = null;
let connectPromise = null;

const hasRedisConfig = Boolean(process.env.REDIS_URL);

const getRedisClient = async () => {
  if (!hasRedisConfig) return null;
  if (client && client.isOpen) return client;
  if (connectPromise) return connectPromise;

  let createClient;
  try {
    ({ createClient } = require("redis"));
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.warn("Redis package is not installed. Run `npm install` in edu-api-main to enable Redis features.");
    } else {
      console.warn("Redis package could not be loaded:", err.message);
    }
    return null;
  }

  try {
    client = createClient({
      username: process.env.REDIS_USER || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        host: process.env.REDIS_HOST || undefined,
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 3000,
        reconnectStrategy: false,
      },
    });

    client.on("error", (err) => {
      console.error("Redis error:", err.message);
    });

    connectPromise = client.connect().then(() => client).catch((err) => {
      console.error("Redis connection failed:", err.message);
      client = null;
      connectPromise = null;
      return null;
    });

    return connectPromise;
  } catch (err) {
    console.warn("Redis features are disabled:", err.message);
    return null;
  }
};

const getJSON = async (key) => {
  const redis = await getRedisClient();
  if (!redis) return null;

  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
};

const setJSON = async (key, value, ttlSeconds = 60) => {
  const redis = await getRedisClient();
  if (!redis) return false;

  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  return true;
};

const delByPattern = async (pattern) => {
  const redis = await getRedisClient();
  if (!redis) return false;

  for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    await redis.del(key);
  }
  return true;
};

module.exports = {
  getRedisClient,
  getJSON,
  setJSON,
  delByPattern,
};

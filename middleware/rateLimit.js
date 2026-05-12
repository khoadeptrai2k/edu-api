const { getRedisClient } = require("../utils/redisClient");

const memoryHits = new Map();

const cleanupMemoryHits = (now) => {
  for (const [key, value] of memoryHits.entries()) {
    if (value.resetAt <= now) memoryHits.delete(key);
  }
};

const rateLimit = ({ windowSeconds = 60, max = 120, prefix = "rl" } = {}) => {
  return async (req, res, next) => {
    const key = `${prefix}:${req.ip}:${req.originalUrl.split("?")[0]}`;
    const redis = await getRedisClient();

    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      if (count > max) {
        return res.status(429).json({ msg: "Too many requests. Please slow down." });
      }
      return next();
    }

    const now = Date.now();
    cleanupMemoryHits(now);

    const hit = memoryHits.get(key) || { count: 0, resetAt: now + windowSeconds * 1000 };
    if (hit.resetAt <= now) {
      hit.count = 0;
      hit.resetAt = now + windowSeconds * 1000;
    }
    hit.count += 1;
    memoryHits.set(key, hit);

    if (hit.count > max) {
      return res.status(429).json({ msg: "Too many requests. Please slow down." });
    }

    return next();
  };
};

module.exports = rateLimit;

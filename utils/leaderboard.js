const { getRedisClient } = require("./redisClient");

const LEADERBOARD_KEY = "leaderboard:learners";

const incrementLearnerScore = async (userId, points = 1) => {
  const redis = await getRedisClient();
  if (!redis || !userId) return null;
  return redis.zIncrBy(LEADERBOARD_KEY, points, userId.toString());
};

const getLeaderboard = async (limit = 20) => {
  const redis = await getRedisClient();
  if (!redis) return [];

  const end = Math.max(Number(limit) || 20, 1) - 1;
  const rows = await redis.zRangeWithScores(LEADERBOARD_KEY, 0, end, { REV: true });

  return rows.map((row, index) => ({
    rank: index + 1,
    user: row.value,
    score: row.score,
  }));
};

module.exports = {
  incrementLearnerScore,
  getLeaderboard,
};

const Posts = require("../models/postModel");
const Users = require("../models/userModel");
const { getJSON, setJSON } = require("../utils/redisClient");
const { getLeaderboard, incrementLearnerScore } = require("../utils/leaderboard");

const tokenize = (value = "") => value
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .split(/\s+/)
  .filter((word) => word.length > 2)
  .slice(0, 8);

const learningCtrl = {
  smartFeed: async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const skip = (page - 1) * limit;
      const following = [...req.user.following, req.user._id];
      const cacheKey = `smart-feed:${req.user._id}:${page}:${limit}`;
      const cached = await getJSON(cacheKey);
      if (cached) return res.json(cached);

      const posts = await Posts.aggregate([
        { $match: { user: { $in: following } } },
        {
          $addFields: {
            likesCount: { $size: "$likes" },
            commentsCount: { $size: "$comments" },
            score: {
              $add: [
                { $multiply: [{ $size: "$likes" }, 2] },
                { $multiply: [{ $size: "$comments" }, 3] },
                {
                  $cond: [
                    { $in: ["$user", req.user.following] },
                    5,
                    0,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { score: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]);

      await Posts.populate(posts, [
        { path: "user", select: "avatar username fullname followers" },
        { path: "likes", select: "avatar username fullname" },
        { path: "comments" },
      ]);

      const payload = { posts, result: posts.length };
      await setJSON(cacheKey, payload, 30);
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  leaderboard: async (req, res) => {
    try {
      const rows = await getLeaderboard(Math.min(Number(req.query.limit) || 20, 50));
      const users = await Users.find({ _id: { $in: rows.map((row) => row.user) } })
        .select("avatar username fullname")
        .lean();
      const userMap = new Map(users.map((user) => [user._id.toString(), user]));

      return res.json({
        leaderboard: rows.map((row) => ({
          ...row,
          user: userMap.get(row.user) || { _id: row.user },
        })),
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  addProgress: async (req, res) => {
    try {
      const points = Math.min(Math.max(Number(req.body.points) || 1, 1), 100);
      await incrementLearnerScore(req.user._id, points);
      return res.json({ msg: "Progress recorded.", points });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  aiSearch: async (req, res) => {
    try {
      const q = (req.query.q || "").trim();
      if (!q) return res.json({ users: [], posts: [] });

      const terms = tokenize(q);
      const regex = new RegExp(terms.join("|"), "i");

      const [users, posts] = await Promise.all([
        Users.find({
          $or: [
            { username: regex },
            { fullname: regex },
            { story: regex },
          ],
        }).select("avatar username fullname story").limit(10).lean(),
        Posts.find({ content: regex })
          .sort("-createdAt")
          .limit(20)
          .populate("user", "avatar username fullname")
          .lean(),
      ]);

      return res.json({ users, posts, terms });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

module.exports = learningCtrl;

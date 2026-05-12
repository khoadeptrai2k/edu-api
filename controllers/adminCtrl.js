const Users = require("../models/userModel");

const adminCtrl = {
  getUsers: async (req, res) => {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const search = (req.query.search || "").trim();
      const query = search
        ? {
            $or: [
              { username: { $regex: search, $options: "i" } },
              { fullname: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        Users.find(query)
          .select("-password")
          .sort("-createdAt")
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Users.countDocuments(query),
      ]);

      return res.json({ users, total, result: users.length, page });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const allowed = [
        "fullname",
        "username",
        "email",
        "role",
        "isActive",
        "aiEnabled",
        "aiLearningFocus",
        "mobile",
        "address",
        "story",
        "website",
        "gender",
      ];

      const updates = {};
      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
      });

      if (Object.prototype.hasOwnProperty.call(updates, "aiEnabled")) {
        updates.aiEnabledAt = updates.aiEnabled ? new Date() : null;
      }

      if (updates.email) updates.email = updates.email.toLowerCase().trim();
      if (updates.username) updates.username = updates.username.toLowerCase().replace(/\s/g, "");

      const user = await Users.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) return res.status(404).json({ msg: "User does not exist." });

      return res.json({ msg: "User updated.", user });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

module.exports = adminCtrl;

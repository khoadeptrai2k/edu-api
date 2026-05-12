/** @format */

const Users = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/mailer");

const authCtrl = {
  register: async (req, res) => {
    try {
      const { fullname, username, email, password, gender } = req.body;
      if (!fullname || !username || !email || !password) {
        return res.status(400).json({ msg: "Please fill in all fields." });
      }

      let newUserName = username.toLowerCase().replace(/\s/g, "");
      const normalizedEmail = email.toLowerCase().trim();

      const user_name = await Users.findOne({ username: newUserName });
      if (user_name) return res.status(400).json({ msg: "This user name already exists." });

      const user_email = await Users.findOne({ email: normalizedEmail });
      if (user_email) return res.status(400).json({ msg: "This email already exists." });

      if (password.length < 6) return res.status(400).json({ msg: "Password must be at least 6 characters." });

      const passwordHash = await bcrypt.hash(password, 12);

      const newUser = new Users({
        fullname,
        username: newUserName,
        email: normalizedEmail,
        password: passwordHash,
        gender,
      });

      const access_token = createAccessToken({ id: newUser._id });
      const refresh_token = createRefreshToken({ id: newUser._id });

      res.cookie("refreshtoken", refresh_token, {
        httpOnly: true,
        path: "/api/refresh_token",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30days
      });

      await newUser.save();

      res.json({
        msg: "Register Success!",
        access_token,
        user: {
          ...newUser._doc,
          password: "",
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ msg: "Please fill in all fields." });

      const user = await Users.findOne({ email: email.toLowerCase().trim() }).populate(
        "followers following",
        "avatar username fullname followers following",
      );

      if (!user) return res.status(400).json({ msg: "This email does not exist." });
      if (user.isActive === false) return res.status(403).json({ msg: "Your account has been deactivated." });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ msg: "Password is incorrect." });

      const access_token = createAccessToken({ id: user._id });
      const refresh_token = createRefreshToken({ id: user._id });

      res.cookie("refreshtoken", refresh_token, {
        httpOnly: true,
        path: "/api/refresh_token",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        msg: "Login Success!",
        access_token,
        user: {
          ...user._doc,
          password: "",
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  logout: async (req, res) => {
    try {
      res.clearCookie("refreshtoken", { path: "/api/refresh_token" });
      return res.json({ msg: "Logged out!" });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  generateAccessToken: async (req, res) => {
    try {
      const rf_token = req.cookies.refreshtoken || req.body.token;
      if (!rf_token) return res.status(401).json({ msg: "Please login now." });

      jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, async (err, result) => {
        if (err) return res.status(400).json({ msg: "Please login now." });

        const user = await Users.findById(result.id)
          .select("-password")
          .populate("followers following", "avatar username fullname followers following");

        if (!user) return res.status(400).json({ msg: "This does not exist." });
        if (user.isActive === false) return res.status(403).json({ msg: "Your account has been deactivated." });

        const access_token = createAccessToken({ id: result.id });

        res.json({
          access_token,
          user,
        });
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ msg: "Please fill in all fields." });
      if (newPassword.length < 6) return res.status(400).json({ msg: "Password must be at least 6 characters." });

      const user = await Users.findById(req.user._id);
      if (!user) return res.status(404).json({ msg: "User does not exist." });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ msg: "Current password is incorrect." });

      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      return res.json({ msg: "Password changed successfully." });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  forgotPassword: async (req, res) => {
    try {
      const email = (req.body.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ msg: "Email is required." });

      const user = await Users.findOne({ email });
      if (!user) {
        return res.json({ msg: "If the email exists, a password reset link has been sent." });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
      await user.save();

      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      const resetUrl = `${clientUrl}/reset_password/${rawToken}`;
      await sendPasswordResetEmail({ to: user.email, resetUrl, username: user.username });

      return res.json({ msg: "If the email exists, a password reset link has been sent." });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ msg: "Token and password are required." });
      if (password.length < 6) return res.status(400).json({ msg: "Password must be at least 6 characters." });

      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
      const user = await Users.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) return res.status(400).json({ msg: "Password reset token is invalid or expired." });

      user.password = await bcrypt.hash(password, 12);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.json({ msg: "Password reset successfully. Please login again." });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
};

const createRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "30d" });
};

module.exports = authCtrl;

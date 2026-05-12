const router = require("express").Router();
const auth = require("../middleware/auth");
const learningCtrl = require("../controllers/learningCtrl");

router.get("/feed/smart", auth, learningCtrl.smartFeed);
router.get("/leaderboard", auth, learningCtrl.leaderboard);
router.post("/progress", auth, learningCtrl.addProgress);
router.get("/ai-search", auth, learningCtrl.aiSearch);

module.exports = router;

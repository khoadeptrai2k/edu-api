const router = require("express").Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const adminCtrl = require("../controllers/adminCtrl");

router.get("/admin/users", auth, admin, adminCtrl.getUsers);
router.patch("/admin/users/:id", auth, admin, adminCtrl.updateUser);

module.exports = router;

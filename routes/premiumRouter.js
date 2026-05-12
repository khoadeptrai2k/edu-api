const router = require("express").Router();
const auth = require("../middleware/auth");
const premiumCtrl = require("../controllers/premiumCtrl");

router.get("/premium/admin-contact", auth, premiumCtrl.getAdminContact);
router.post("/premium/checkout", auth, premiumCtrl.createCheckout);
router.post("/premium/confirm", auth, premiumCtrl.confirmCheckout);

module.exports = router;

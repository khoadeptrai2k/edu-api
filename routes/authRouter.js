const router = require('express').Router()
const authCtrl = require('../controllers/authCtrl')
const auth = require('../middleware/auth')

router.post('/register', authCtrl.register)

router.post('/login', authCtrl.login)

router.post('/logout', authCtrl.logout)

router.post('/refresh_token', authCtrl.generateAccessToken)
router.patch('/change_password', auth, authCtrl.changePassword)
router.post('/forgot_password', authCtrl.forgotPassword)
router.post('/reset_password', authCtrl.resetPassword)


module.exports = router

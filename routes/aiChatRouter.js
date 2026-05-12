const router = require('express').Router()
const aiChatCtrl = require('../controllers/aiChatCtrl')
const auth = require('../middleware/auth')

router.get('/ai-chat/assistant', auth, aiChatCtrl.getAssistant)
router.post('/ai-chat/message', auth, aiChatCtrl.createMessage)

module.exports = router

const Conversations = require('../models/conversationModel')
const Messages = require('../models/messageModel')
const { getAIAssistantUser, generateLearningChatReply } = require('../utils/aiLearningAssistant')

const activeAIChats = new Set()
const buildParticipantsKey = (first, second) => [first.toString(), second.toString()].sort().join(':')

const getAIConversation = async (userId, aiUserId, updates = {}) => {
  const participantsKey = buildParticipantsKey(userId, aiUserId)
  return Conversations.findOneAndUpdate({
    $or: [
      { participantsKey },
      { recipients: [userId, aiUserId] },
      { recipients: [aiUserId, userId] }
    ]
  }, {
    recipients: [userId, aiUserId],
    participantsKey,
    isGroup: false,
    ...updates
  }, { new: true, upsert: true })
}

const aiChatCtrl = {
  getAssistant: async (req, res) => {
    try {
      const aiUser = await getAIAssistantUser()
      const conversation = await Conversations.findOne({
        participantsKey: buildParticipantsKey(req.user._id, aiUser._id)
      }).lean()

      return res.json({
        user: {
          _id: aiUser._id,
          avatar: aiUser.avatar,
          username: "Premium AI",
          fullname: "Study assistant",
          text: conversation?.text || "Ask a study question",
          media: conversation?.media || [],
          isAIChat: true,
          online: true
        }
      })
    } catch (err) {
      return res.status(500).json({ msg: err.message })
    }
  },

  createMessage: async (req, res) => {
    const lockKey = req.user._id.toString()
    if (activeAIChats.has(lockKey)) {
      return res.status(429).json({ msg: "Premium AI is still answering your previous message." })
    }

    try {
      if (!req.user.aiEnabled) return res.status(403).json({ msg: "Premium AI is not enabled for your account yet." })

      const { text = "" } = req.body
      if (!text.trim()) return res.status(400).json({ msg: "Message cannot be empty." })
      if (text.length > 1800) return res.status(400).json({ msg: "Please keep AI chat messages under 1800 characters." })

      activeAIChats.add(lockKey)
      const aiUser = await getAIAssistantUser()
      const conversation = await getAIConversation(req.user._id, aiUser._id, { text })

      const userMessage = await Messages.create({
        conversation: conversation._id,
        sender: req.user._id,
        recipient: aiUser._id,
        text: text.trim()
      })

      const ai = await generateLearningChatReply({
        message: text,
        focus: req.user.aiLearningFocus
      })

      const replyText = ai?.text || "Premium AI is not configured yet. Please ask admin to add the OpenAI API key."
      const aiMessage = await Messages.create({
        conversation: conversation._id,
        sender: aiUser._id,
        recipient: req.user._id,
        text: replyText
      })

      await Conversations.findByIdAndUpdate(conversation._id, { text: replyText, media: [] })

      const populatedUserMessage = await Messages.findById(userMessage._id).populate('sender', 'avatar username fullname')
      const populatedAIMessage = await Messages.findById(aiMessage._id).populate('sender', 'avatar username fullname')

      return res.json({
        msg: "Premium AI replied.",
        conversation,
        messages: [populatedUserMessage, populatedAIMessage]
      })
    } catch (err) {
      return res.status(500).json({ msg: err.message })
    } finally {
      activeAIChats.delete(lockKey)
    }
  }
}

module.exports = aiChatCtrl

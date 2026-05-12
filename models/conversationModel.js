const mongoose = require('mongoose')

const conversationSchema = new mongoose.Schema({
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true }],
    participantsKey: { type: String, sparse: true, unique: true },
    isGroup: { type: Boolean, default: false, index: true },
    name: { type: String, trim: true, maxlength: 80 },
    avatar: { type: String, default: '' },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    text: { type: String, trim: true, default: '' },
    media: { type: Array, default: [] },
    call: Object
}, {
    timestamps: true
})

conversationSchema.index({ recipients: 1, updatedAt: -1 })
conversationSchema.index({ participantsKey: 1 }, { unique: true })

module.exports = mongoose.model('conversation', conversationSchema)

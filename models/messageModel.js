const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'conversation', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    media: { type: Array, default: [] },
    call: Object
}, {
    timestamps: true
})

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 })
messageSchema.index({ recipient: 1, sender: 1, createdAt: -1 })
messageSchema.index({ conversation: 1, createdAt: -1 })

module.exports = mongoose.model('message', messageSchema)

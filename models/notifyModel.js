const mongoose = require('mongoose')

const notifySchema = new mongoose.Schema({
    id: mongoose.Schema.Types.ObjectId,
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true},
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    url: String,
    text: String,
    content: String,
    image: String,
    isRead: {type: Boolean, default: false}
}, {
    timestamps: true
})

notifySchema.index({ recipients: 1, createdAt: -1 })
notifySchema.index({ user: 1, createdAt: -1 })
notifySchema.index({ id: 1, url: 1 })
notifySchema.index({ isRead: 1 })

module.exports = mongoose.model('notify', notifySchema)

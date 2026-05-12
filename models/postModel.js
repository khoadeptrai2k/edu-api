const mongoose = require('mongoose')

const postSchema = new mongoose.Schema({
    content: { type: String, trim: true, maxlength: 2000 },
    images: {
        type: Array,
        required: true
    },
    tags: [{ type: String, trim: true, lowercase: true, index: true }],
    premium: { type: Boolean, default: false, index: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'comment' }],
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true}
}, {
    timestamps: true
})

postSchema.index({ user: 1, createdAt: -1 })
postSchema.index({ createdAt: -1 })
postSchema.index({ likes: 1 })
postSchema.index({ comments: 1 })
postSchema.index({ content: 'text' })

module.exports = mongoose.model('post', postSchema)

const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    tag: Object,
    reply: { type: mongoose.Schema.Types.ObjectId, ref: 'comment' },
    likes: [{type: mongoose.Schema.Types.ObjectId, ref: 'user'}],
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
    isAI: {type: Boolean, default: false, index: true},
    aiMeta: {
        model: String,
        provider: String
    },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'post', required: true },
    postUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true }
}, {
    timestamps: true
})

commentSchema.index({ postId: 1, createdAt: -1 })
commentSchema.index({ user: 1, createdAt: -1 })
commentSchema.index({ reply: 1 })
commentSchema.index({ likes: 1 })

module.exports = mongoose.model('comment', commentSchema)

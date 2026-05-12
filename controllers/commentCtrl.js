const Comments = require('../models/commentModel')
const Posts = require('../models/postModel')
const { delByPattern } = require('../utils/redisClient')
const { incrementLearnerScore } = require('../utils/leaderboard')


const commentCtrl = {
    createComment: async (req, res) => {
        try {
            const { postId, content, tag, reply, postUserId } = req.body
            if(!content || !content.trim()) return res.status(400).json({msg: "Please add comment content."})

            const post = await Posts.findById(postId)
            if(!post) return res.status(400).json({msg: "This post does not exist."})

            if(reply){
                const cm = await Comments.findById(reply)
                if(!cm) return res.status(400).json({msg: "This comment does not exist."})
            }

            const newComment = new Comments({
                user: req.user._id, content, tag, reply, postUserId, postId
            })

            await Posts.findOneAndUpdate({_id: postId}, {
                $addToSet: {comments: newComment._id}
            }, {new: true})

            await newComment.save()
            await delByPattern(`feed:*`)
            await incrementLearnerScore(req.user._id, 2)

            res.json({newComment})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updateComment: async (req, res) => {
        try {
            const { content } = req.body
            
            if(!content || !content.trim()) return res.status(400).json({msg: "Please add comment content."})

            const comment = await Comments.findOneAndUpdate({
                _id: req.params.id, user: req.user._id
            }, {content}, { new: true })
            if(!comment) return res.status(404).json({msg: "Comment does not exist or is not yours."})
            await delByPattern(`feed:*`)

            res.json({msg: 'Update Success!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    likeComment: async (req, res) => {
        try {
            const comment = await Comments.findOneAndUpdate({_id: req.params.id}, {
                $addToSet: {likes: req.user._id}
            }, {new: true})
            if(!comment) return res.status(404).json({msg: "Comment does not exist."})
            await delByPattern(`feed:*`)

            res.json({msg: 'Liked Comment!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    unLikeComment: async (req, res) => {
        try {

            const comment = await Comments.findOneAndUpdate({_id: req.params.id}, {
                $pull: {likes: req.user._id}
            }, {new: true})
            if(!comment) return res.status(404).json({msg: "Comment does not exist."})
            await delByPattern(`feed:*`)

            res.json({msg: 'UnLiked Comment!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    deleteComment: async (req, res) => {
        try {
            const comment = await Comments.findOneAndDelete({
                _id: req.params.id,
                $or: [
                    {user: req.user._id},
                    {postUserId: req.user._id}
                ]
            })
            if(!comment) return res.status(404).json({msg: "Comment does not exist or cannot be deleted."})

            await Posts.findOneAndUpdate({_id: comment.postId}, {
                $pull: {comments: req.params.id}
            })
            await delByPattern(`feed:*`)

            res.json({msg: 'Deleted Comment!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
}


module.exports = commentCtrl

const Posts = require('../models/postModel')
const Comments = require('../models/commentModel')
const Users = require('../models/userModel')
const APIFeatures = require('../utils/apiFeatures')
const { getJSON, setJSON, delByPattern } = require('../utils/redisClient')
const { incrementLearnerScore } = require('../utils/leaderboard')
const { getAIAssistantUser, generateLearningComment } = require('../utils/aiLearningAssistant')

const populatePost = (query) => query
    .populate("user likes", "avatar username fullname followers")
    .populate({
        path: "comments",
        populate: {
            path: "user likes",
            select: "-password"
        }
    })

const postCtrl = {
    createPost: async (req, res) => {
        try {
            const { content, images } = req.body

            if(!Array.isArray(images) || images.length === 0)
            return res.status(400).json({msg: "Please add your photo."})

            const isPremium = Boolean(req.user.aiEnabled)
            const newPost = new Posts({
                content,
                images,
                user: req.user._id,
                premium: isPremium,
                tags: isPremium ? ['premium'] : []
            })
            await newPost.save()

            let aiComment = null
            if(isPremium && content && content.trim()){
                try {
                    const ai = await generateLearningComment({
                        content,
                        focus: req.user.aiLearningFocus
                    })

                    if(ai && ai.text){
                        const aiUser = await getAIAssistantUser()
                        aiComment = await Comments.create({
                            user: aiUser._id,
                            content: ai.text,
                            postId: newPost._id,
                            postUserId: req.user._id,
                            isAI: true,
                            aiMeta: {
                                model: ai.model,
                                provider: 'openai'
                            }
                        })
                        await Posts.findByIdAndUpdate(newPost._id, {
                            $addToSet: {comments: aiComment._id}
                        })
                        aiComment = {
                            ...aiComment._doc,
                            user: {
                                _id: aiUser._id,
                                avatar: aiUser.avatar,
                                username: aiUser.username,
                                fullname: aiUser.fullname
                            }
                        }
                    }
                } catch (aiErr) {
                    console.warn('AI learning comment skipped:', aiErr.message)
                }
            }
            await delByPattern(`feed:${req.user._id}:*`)
            await delByPattern(`discover:*`)
            await incrementLearnerScore(req.user._id, 5)

            res.json({
                msg: 'Created Post!',
                newPost: {
                    ...newPost._doc,
                    comments: aiComment ? [aiComment] : [],
                    user: req.user
                }
            })
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getPosts: async (req, res) => {
        try {
            const cacheKey = `feed:${req.user._id}:${req.query.page || 1}:${req.query.limit || 9}`
            const cached = await getJSON(cacheKey)
            if(cached) return res.json(cached)

            const features =  new APIFeatures(Posts.find({
                user: [...req.user.following, req.user._id]
            }), req.query).paginating()

            const posts = await populatePost(features.query.sort('-createdAt'))

            const payload = {
                msg: 'Success!',
                result: posts.length,
                posts
            }
            await setJSON(cacheKey, payload, 30)
            res.json(payload)

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updatePost: async (req, res) => {
        try {
            const { content, images } = req.body

            const post = await populatePost(Posts.findOneAndUpdate({_id: req.params.id, user: req.user._id}, {
                content, images
            }, { new: true }))

            if(!post) return res.status(404).json({msg: 'This post does not exist or is not yours.'})
            await delByPattern(`feed:*`)
            await delByPattern(`discover:*`)

            res.json({
                msg: "Updated Post!",
                newPost: post
            })
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    likePost: async (req, res) => {
        try {
            const like = await Posts.findOneAndUpdate({_id: req.params.id}, {
                $addToSet: {likes: req.user._id}
            }, {new: true})

            if(!like) return res.status(400).json({msg: 'This post does not exist.'})

            await delByPattern(`feed:*`)
            await incrementLearnerScore(req.user._id, 1)
            res.json({msg: 'Liked Post!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    unLikePost: async (req, res) => {
        try {

            const like = await Posts.findOneAndUpdate({_id: req.params.id}, {
                $pull: {likes: req.user._id}
            }, {new: true})

            if(!like) return res.status(400).json({msg: 'This post does not exist.'})

            await delByPattern(`feed:*`)
            res.json({msg: 'UnLiked Post!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getUserPosts: async (req, res) => {
        try {
            const features = new APIFeatures(Posts.find({user: req.params.id}), req.query)
            .paginating()
            const posts = await populatePost(features.query.sort("-createdAt"))

            res.json({
                posts,
                result: posts.length
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getPost: async (req, res) => {
        try {
            const post = await populatePost(Posts.findById(req.params.id))

            if(!post) return res.status(400).json({msg: 'This post does not exist.'})

            res.json({
                post
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getPostsDicover: async (req, res) => {
        try {

            const newArr = [...req.user.following, req.user._id]

            const num  = Math.min(Number(req.query.num) || 9, 30)
            const cacheKey = `discover:${req.user._id}:${num}`
            const cached = await getJSON(cacheKey)
            if(cached) return res.json(cached)

            const posts = await Posts.aggregate([
                { $match: { user : { $nin: newArr } } },
                { $sample: { size: num } },
            ])
            await Posts.populate(posts, { path: "user likes", select: "avatar username fullname followers" })

            const payload = {
                msg: 'Success!',
                result: posts.length,
                posts
            }
            await setJSON(cacheKey, payload, 60)
            return res.json(payload)

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    deletePost: async (req, res) => {
        try {
            const post = await Posts.findOneAndDelete({_id: req.params.id, user: req.user._id})
            if(!post) return res.status(404).json({msg: 'This post does not exist or is not yours.'})
            await Comments.deleteMany({_id: {$in: post.comments }})
            await delByPattern(`feed:*`)
            await delByPattern(`discover:*`)

            res.json({
                msg: 'Deleted Post!',
                newPost: {
                    ...post,
                    user: req.user
                }
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    savePost: async (req, res) => {
        try {
            const save = await Users.findOneAndUpdate({_id: req.user._id}, {
                $addToSet: {saved: req.params.id}
            }, {new: true})

            if(!save) return res.status(400).json({msg: 'This user does not exist.'})

            res.json({msg: 'Saved Post!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    unSavePost: async (req, res) => {
        try {
            const save = await Users.findOneAndUpdate({_id: req.user._id}, {
                $pull: {saved: req.params.id}
            }, {new: true})

            if(!save) return res.status(400).json({msg: 'This user does not exist.'})

            res.json({msg: 'unSaved Post!'})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getSavePosts: async (req, res) => {
        try {
            const features = new APIFeatures(Posts.find({
                _id: {$in: req.user.saved}
            }), req.query).paginating()

            const savePosts = await populatePost(features.query.sort("-createdAt"))

            res.json({
                savePosts,
                result: savePosts.length
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
}

module.exports = postCtrl

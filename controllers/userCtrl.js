const Users = require('../models/userModel')

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const userCtrl = {
    searchUser: async (req, res) => {
        try {
            const username = escapeRegex((req.query.username || "").trim())
            if(!username) return res.json({ users: [] })

            const users = await Users.find({username: {$regex: username, $options: "i"}})
            .limit(10).select("fullname username avatar").lean()
            
            res.json({users})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getUser: async (req, res) => {
        try {
            const user = await Users.findById(req.params.id).select('-password')
            .populate("followers following", "-password")
            if(!user) return res.status(400).json({msg: "User does not exist."})
            
            res.json({user})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updateUser: async (req, res) => {
        try {
            const { avatar, fullname, mobile, address, story, website, gender } = req.body
            if(!fullname) return res.status(400).json({msg: "Please add your full name."})

            const user = await Users.findOneAndUpdate({_id: req.user._id}, {
                avatar, fullname, mobile, address, story, website, gender
            }, { new: true }).select("-password")

            res.json({msg: "Update Success!", user})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    follow: async (req, res) => {
        try {
            if(req.params.id === req.user._id.toString()) {
                return res.status(400).json({msg: "You cannot follow yourself."})
            }

            const newUser = await Users.findOneAndUpdate({_id: req.params.id}, { 
                $addToSet: {followers: req.user._id}
            }, {new: true}).populate("followers following", "-password")
            if(!newUser) return res.status(404).json({msg: "User does not exist."})

            await Users.findOneAndUpdate({_id: req.user._id}, {
                $addToSet: {following: req.params.id}
            }, {new: true})

            res.json({newUser})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    unfollow: async (req, res) => {
        try {

            const newUser = await Users.findOneAndUpdate({_id: req.params.id}, { 
                $pull: {followers: req.user._id}
            }, {new: true}).populate("followers following", "-password")

            await Users.findOneAndUpdate({_id: req.user._id}, {
                $pull: {following: req.params.id}
            }, {new: true})

            res.json({newUser})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    suggestionsUser: async (req, res) => {
        try {
            const newArr = [...req.user.following, req.user._id]

            const num  = Math.min(Number(req.query.num) || 10, 30)

            const users = await Users.aggregate([
                { $match: { _id: { $nin: newArr } } },
                { $sample: { size: num } },
                { $project: { password: 0 } },
                { $lookup: { from: 'users', localField: 'followers', foreignField: '_id', as: 'followers' } },
                { $lookup: { from: 'users', localField: 'following', foreignField: '_id', as: 'following' } },
                { $project: { 'followers.password': 0, 'following.password': 0 } },
            ])

            return res.json({
                users,
                result: users.length
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
}


module.exports = userCtrl

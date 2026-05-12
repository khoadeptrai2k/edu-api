const Notifies = require('../models/notifyModel')


const notifyCtrl = {
    createNotify: async (req, res) => {
        try {
            const { id, recipients, url, text, content, image } = req.body

            if(!Array.isArray(recipients) || recipients.length === 0) {
                return res.status(400).json({msg: "Recipients are required."})
            }

            if(recipients.includes(req.user._id.toString())) return res.json({notify: null})

            const notify = new Notifies({
                id, recipients, url, text, content, image, user: req.user._id
            })

            await notify.save()
            return res.json({notify})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    removeNotify: async (req, res) => {
        try {
            const notify = await Notifies.findOneAndDelete({
                id: req.params.id, url: req.query.url, user: req.user._id
            })
            
            return res.json({notify})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getNotifies: async (req, res) => {
        try {
            const notifies = await Notifies.find({recipients: req.user._id})
            .sort('-createdAt').limit(100).populate('user', 'avatar username')
            
            return res.json({notifies})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    isReadNotify: async (req, res) => {
        try {
            const notifies = await Notifies.findOneAndUpdate({_id: req.params.id, recipients: req.user._id}, {
                isRead: true
            }, { new: true })
            if(!notifies) return res.status(404).json({msg: "Notification does not exist."})

            return res.json({notifies})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    deleteAllNotifies: async (req, res) => {
        try {
            const notifies = await Notifies.deleteMany({recipients: req.user._id})
            
            return res.json({notifies})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
}


module.exports = notifyCtrl

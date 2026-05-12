const Conversations = require('../models/conversationModel')
const Messages = require('../models/messageModel')
const APIFeatures = require('../utils/apiFeatures')

const buildParticipantsKey = (first, second) => [first.toString(), second.toString()].sort().join(':')

const messageCtrl = {
    createGroup: async (req, res) => {
        try {
            const { name, recipients = [], avatar = '' } = req.body
            const memberIds = [...new Set([req.user._id.toString(), ...recipients.map(id => id.toString())])]

            if(!name || !name.trim()) return res.status(400).json({msg: 'Group name is required.'})
            if(memberIds.length < 3) return res.status(400).json({msg: 'A group needs at least 3 members including you.'})

            const group = await Conversations.create({
                recipients: memberIds,
                isGroup: true,
                name: name.trim(),
                avatar,
                admins: [req.user._id],
                participantsKey: `group:${Date.now()}:${req.user._id}`
            })

            await group.populate('recipients', 'avatar username fullname')
            return res.json({msg: 'Group created.', group})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updateGroup: async (req, res) => {
        try {
            const { name, avatar, addMembers = [], removeMembers = [] } = req.body
            const group = await Conversations.findOne({_id: req.params.id, isGroup: true, admins: req.user._id})
            if(!group) return res.status(404).json({msg: 'Group does not exist or you are not an admin.'})

            if(name) group.name = name.trim()
            if(avatar !== undefined) group.avatar = avatar

            const removeSet = new Set(removeMembers.map(id => id.toString()))
            group.recipients = group.recipients
                .map(id => id.toString())
                .filter(id => !removeSet.has(id) || id === req.user._id.toString())

            addMembers.forEach(id => {
                const value = id.toString()
                if(!group.recipients.includes(value)) group.recipients.push(value)
            })

            if(group.recipients.length < 3) return res.status(400).json({msg: 'A group needs at least 3 members.'})

            await group.save()
            await group.populate('recipients', 'avatar username fullname')
            return res.json({msg: 'Group updated.', group})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    createMessage: async (req, res) => {
        try {
            const { recipient, conversationId, text = '', media = [], call } = req.body
            const sender = req.user._id

            if(!recipient && !conversationId) return res.status(400).json({msg: 'Recipient or conversation is required.'})
            if(!text.trim() && (!Array.isArray(media) || media.length === 0) && !call) {
                return res.status(400).json({msg: 'Message cannot be empty.'})
            }

            let newConversation;
            let resolvedRecipient = recipient || null;

            if(conversationId) {
                newConversation = await Conversations.findOne({
                    _id: conversationId,
                    recipients: sender
                })
                if(!newConversation) return res.status(404).json({msg: 'Conversation does not exist.'})

                await Conversations.findByIdAndUpdate(conversationId, { text, media, call }, { new: true })
            } else {
                const participantsKey = buildParticipantsKey(sender, recipient)

                newConversation = await Conversations.findOneAndUpdate({
                    $or: [
                        { participantsKey },
                        { recipients: [sender, recipient] },
                        { recipients: [recipient, sender] }
                    ]
                }, {
                    recipients: [sender, recipient],
                    participantsKey,
                    isGroup: false,
                    text, media, call
                }, { new: true, upsert: true })
            }

            const newMessage = new Messages({
                conversation: newConversation._id,
                sender, call,
                recipient: resolvedRecipient, text, media
            })

            await newMessage.save()

            res.json({msg: 'Create Success!', conversation: newConversation, newMessage})

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getConversations: async (req, res) => {
        try {
            const features = new APIFeatures(Conversations.find({
                recipients: req.user._id
            }), req.query).paginating()

            const conversations = await features.query.sort('-updatedAt')
            .populate('recipients', 'avatar username fullname')

            res.json({
                conversations,
                result: conversations.length
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getMessages: async (req, res) => {
        try {
            const group = await Conversations.findOne({_id: req.params.id, isGroup: true, recipients: req.user._id})
            const query = group
                ? { conversation: req.params.id }
                : {
                    $or: [
                        {sender: req.user._id, recipient: req.params.id},
                        {sender: req.params.id, recipient: req.user._id}
                    ]
                }

            const features = new APIFeatures(Messages.find(query), req.query).paginating()

            const messages = await features.query.sort('-createdAt')
            .populate('sender', 'avatar username fullname')

            res.json({
                messages,
                result: messages.length
            })

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    deleteMessages: async (req, res) => {
        try {
            const message = await Messages.findOneAndDelete({_id: req.params.id, sender: req.user._id})
            if(!message) return res.status(404).json({msg: 'Message does not exist or is not yours.'})
            res.json({msg: 'Delete Success!'})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    deleteConversation: async (req, res) => {
        try {
            const group = await Conversations.findOne({_id: req.params.id, isGroup: true, recipients: req.user._id})
            if(group) {
                await Conversations.findOneAndUpdate({_id: req.params.id}, {$pull: {recipients: req.user._id}})
                return res.json({msg: 'Left group.'})
            }

            const newConver = await Conversations.findOneAndDelete({
                $or: [
                    { participantsKey: buildParticipantsKey(req.user._id, req.params.id) },
                    { recipients: [req.user._id, req.params.id] },
                    { recipients: [req.params.id, req.user._id] }
                ]
            })
            if(!newConver) return res.status(404).json({msg: 'Conversation does not exist.'})
            await Messages.deleteMany({conversation: newConver._id})
            
            res.json({msg: 'Delete Success!'})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
}


module.exports = messageCtrl

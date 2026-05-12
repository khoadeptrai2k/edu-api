const Users = require("../models/userModel")
const jwt = require('jsonwebtoken')

const auth = async (req, res, next) => {
    try {
        const token = (req.header("Authorization") || "").replace(/^Bearer\s+/i, "")

        if(!token) return res.status(401).json({msg: "Invalid Authentication."})

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        if(!decoded) return res.status(401).json({msg: "Invalid Authentication."})

        const user = await Users.findOne({_id: decoded.id}).select("-password")
        if(!user) return res.status(401).json({msg: "Invalid Authentication."})
        if(user.isActive === false) return res.status(403).json({msg: "Your account has been deactivated."})
        
        req.user = user
        next()
    } catch (err) {
        return res.status(401).json({msg: "Invalid Authentication."})
    }
}


module.exports = auth

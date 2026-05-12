/** @format */

const Users = require("./models/userModel");

let users = [];

const toId = (value) => {
  if (!value) return "";
  if (value._id) return value._id.toString();
  return value.toString();
};

const getRelationIds = (items = []) => items.map(toId);
const uniqueIds = (items = []) => [...new Set(items.map(toId).filter(Boolean))];
const emitToUsers = (socket, ids, event, payload) => {
  uniqueIds(ids).forEach((id) => {
    socket.to(id).emit(event, payload);
  });
};

const EditData = (data, id, call) => {
  const newData = data.map((item) => (item.id === id.toString() ? { ...item, call } : item));
  return newData;
};

const SocketServer = (socket) => {
  // Connect - Disconnect
  socket.on("joinUser", async (user) => {
    if (!user || !user._id) return;

    try {
      const account = await Users.findById(user._id).select("isActive").lean();
      if (!account || account.isActive === false) {
        socket.emit("accountDeactivated");
        socket.disconnect(true);
        return;
      }
    } catch (err) {
      console.warn("Socket account status check failed:", err.message);
      return;
    }

    users = users.filter((u) => u.id !== user._id.toString());
    socket.join(user._id.toString());
    users.push({
      id: user._id.toString(),
      socketId: socket.id,
      followers: getRelationIds(user.followers),
      following: getRelationIds(user.following),
    });
  });

  socket.on("disconnect", () => {
    const data = users.find((user) => user.socketId === socket.id);
    if (data) {
      const clients = users.filter((user) => data.followers.includes(user.id));

      if (clients.length > 0) {
        clients.forEach((client) => {
          socket.to(`${client.socketId}`).emit("CheckUserOffline", data.id);
        });
      }

      if (data.call) {
        const callUser = users.find((user) => user.id === data.call);
        if (callUser) {
          users = EditData(users, callUser.id, null);
          socket.to(callUser.id).emit("callerDisconnect");
        }
      }
    }

    users = users.filter((user) => user.socketId !== socket.id);
  });

  // Likes
  socket.on("likePost", (newPost) => {
    const ids = [...getRelationIds(newPost.user.followers), toId(newPost.user._id)];
    emitToUsers(socket, ids, "likeToClient", newPost);
  });

  socket.on("unLikePost", (newPost) => {
    const ids = [...getRelationIds(newPost.user.followers), toId(newPost.user._id)];
    emitToUsers(socket, ids, "unLikeToClient", newPost);
  });

  // Comments
  socket.on("createComment", (newPost) => {
    const ids = [...getRelationIds(newPost.user.followers), toId(newPost.user._id)];
    emitToUsers(socket, ids, "createCommentToClient", newPost);
  });

  socket.on("deleteComment", (newPost) => {
    const ids = [...getRelationIds(newPost.user.followers), toId(newPost.user._id)];
    emitToUsers(socket, ids, "deleteCommentToClient", newPost);
  });

  // Follow
  socket.on("follow", (newUser) => {
    socket.to(toId(newUser._id)).emit("followToClient", newUser);
  });

  socket.on("unFollow", (newUser) => {
    socket.to(toId(newUser._id)).emit("unFollowToClient", newUser);
  });

  // Notification
  socket.on("createNotify", (msg) => {
    emitToUsers(socket, msg.recipients, "createNotifyToClient", msg);
  });

  socket.on("removeNotify", (msg) => {
    emitToUsers(socket, msg.recipients, "removeNotifyToClient", msg);
  });

  // Message
  socket.on("addMessage", (msg) => {
    if (msg.conversationId && Array.isArray(msg.recipients)) {
      emitToUsers(socket, msg.recipients.filter((id) => toId(id) !== toId(msg.sender)), "addMessageToClient", msg);
      return;
    }
    socket.to(toId(msg.recipient)).emit("addMessageToClient", msg);
  });

  socket.on("createGroup", (group) => {
    if (!group || !Array.isArray(group.recipients)) return;
    emitToUsers(socket, group.recipients, "createGroupToClient", group);
  });

  // Check User Online / Offline
  socket.on("checkUserOnline", (data) => {
    const followingIds = getRelationIds(data.following);
    const followerIds = getRelationIds(data.followers);
    const following = users.filter((user) => followingIds.includes(user.id));
    socket.emit("checkUserOnlineToMe", following);

    const clients = users.filter((user) => followerIds.includes(user.id));

    if (clients.length > 0) {
      clients.forEach((client) => {
        socket.to(client.id).emit("checkUserOnlineToClient", toId(data._id));
      });
    }
  });

  // Call User
  socket.on("callUser", (data) => {
    if (data.conversationId && Array.isArray(data.recipients)) {
      emitToUsers(socket, data.recipients.filter((id) => toId(id) !== toId(data.sender)), "callUserToClient", data);
      return;
    }

    users = EditData(users, toId(data.sender), toId(data.recipient));

    const client = users.find((user) => user.id === toId(data.recipient));

    if (client) {
      if (client.call) {
        socket.emit("userBusy", data);
        users = EditData(users, toId(data.sender), null);
      } else {
        users = EditData(users, toId(data.recipient), toId(data.sender));
        socket.to(toId(data.recipient)).emit("callUserToClient", data);
      }
    }
  });

  socket.on("endCall", (data) => {
    const senderId = toId(data.sender);
    const recipientId = toId(data.recipient);

    emitToUsers(socket, [senderId, recipientId], "endCallToClient", data);
    users = EditData(users, senderId, null);
    users = EditData(users, recipientId, null);
  });

  socket.on("joinStudyCluster", ({ roomId, user }) => {
    if (!roomId || !user) return;
    socket.join(`study:${roomId}`);
    socket.to(`study:${roomId}`).emit("studyCluster:userJoined", { roomId, user });
  });

  socket.on("studyCluster:update", ({ roomId, payload }) => {
    if (!roomId) return;
    socket.to(`study:${roomId}`).emit("studyCluster:updateToClient", { roomId, payload });
  });

  socket.on("leaveStudyCluster", ({ roomId, user }) => {
    if (!roomId) return;
    socket.leave(`study:${roomId}`);
    socket.to(`study:${roomId}`).emit("studyCluster:userLeft", { roomId, user });
  });
};

module.exports = SocketServer;

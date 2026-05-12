/** @format */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const SocketServer = require("./socketServer");
const { ExpressPeerServer } = require("peer");
const path = require("path");
const fs = require("fs");
const rateLimit = require("./middleware/rateLimit");
const { getRedisClient } = require("./utils/redisClient");

const app = express();
// app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: "*",
  }),
);
app.use(cookieParser());
app.use(rateLimit({ windowSeconds: 60, max: Number(process.env.RATE_LIMIT_MAX) || 180 }));

try {
  const helmet = require("helmet");
  const compression = require("compression");
  app.use(helmet());
  app.use(compression());
} catch (err) {
  console.warn("Optional security/compression packages are not installed.");
}

const configureSessionStore = async () => {
  try {
    const session = require("express-session");
    const { RedisStore } = require("connect-redis");
    const redis = await getRedisClient();

    app.use(session({
      store: redis ? new RedisStore({ client: redis, prefix: "sess:" }) : undefined,
      secret: process.env.SESSION_SECRET || process.env.REFRESH_TOKEN_SECRET || "dev-session-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }));

    console.log(redis ? "Redis session store enabled" : "Memory session store enabled");
  } catch (err) {
    console.warn("Session packages are not installed; JWT auth remains active.");
  }
};
configureSessionStore();

// Socket
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});

const getSocketIOMajorVersion = () => {
  try {
    const socketIOEntry = require.resolve("socket.io");
    const packagePath = path.join(path.dirname(socketIOEntry), "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return Number((pkg.version || "0").split(".")[0]);
  } catch (err) {
    return 0;
  }
};

const configureSocketScaling = async () => {
  try {
    const socketIOMajor = getSocketIOMajorVersion();
    if (socketIOMajor < 4) {
      console.warn("Socket.io Redis adapter disabled: @socket.io/redis-adapter requires Socket.IO v4+. Current server uses Socket.IO v3.");
      return;
    }

    const redis = await getRedisClient();
    if (!redis) return;

    const { createAdapter } = require("@socket.io/redis-adapter");
    const pubClient = redis;
    const subClient = pubClient.duplicate();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter enabled");
  } catch (err) {
    console.warn("Socket.io Redis adapter disabled:", err.message);
  }
};
configureSocketScaling();

io.on("connection", (socket) => {
  SocketServer(socket);
});

// Create peer server
const peerServer = ExpressPeerServer(http, { path: "/" });
app.use("/peerjs", peerServer);

// Routes
app.use("/api", require("./routes/authRouter"));
app.use("/api", require("./routes/userRouter"));
app.use("/api", require("./routes/postRouter"));
app.use("/api", require("./routes/commentRouter"));
app.use("/api", require("./routes/notifyRouter"));
app.use("/api", require("./routes/messageRouter"));
app.use("/api", require("./routes/learningRouter"));
app.use("/api", require("./routes/adminRouter"));
app.use("/api", require("./routes/premiumRouter"));
app.use("/api", require("./routes/aiChatRouter"));

app.get("/api/docs.json", (req, res) => {
  res.sendFile(path.join(__dirname, "docs", "openapi.json"));
});

try {
  const swaggerUi = require("swagger-ui-express");
  const openapi = require("./docs/openapi.json");
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
} catch (err) {
  console.warn("Swagger UI package is not installed; use /api/docs.json instead.");
}

const URI = process.env.MONGODB_URL;
mongoose.connect(
  URI,
  {
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (err) throw err;
    console.log("Connected to mongodb");
  },
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
  });
}

const port = process.env.PORT || 9090;
http.listen(port, () => {
  console.log("Server is running on port", port);
});

import http from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import User from './models/User.js';
import Conversation from './models/Conversation.js';

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e5,
});

// REST routes use this instance to emit private chat events.
app.set('io', io);

const isObjectId = (value) =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

const conversationRoom = (id) => `conversation:${id}`;
const userRoom = (id) => `user:${id}`;

// Authenticate every Socket.IO connection using an access token.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (typeof token !== 'string' || !token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'estateflow-api',
      audience: 'estateflow-client',
    });

    if (
      payload.typ !== 'access' ||
      !payload.sub ||
      !payload.wid ||
      !isObjectId(payload.sub) ||
      !isObjectId(payload.wid)
    ) {
      return next(new Error('Invalid access token'));
    }

    const user = await User.findOne({
      _id: payload.sub,
      workspace_id: payload.wid,
      is_active: true,
    }).lean();

    if (!user) {
      return next(new Error('User unavailable'));
    }

    socket.data.user = {
      id: String(user._id),
      name: user.name,
      role: user.role,
      workspace_id: String(user.workspace_id),
    };

    next();
  } catch {
    next(new Error('Invalid or expired access token'));
  }
});


io.on('connection', (socket) => {
  const user = socket.data.user;

  if (!user?.id) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${String(user.id)}`);

  console.log('User joined notification room:', user.id);

  // User ko uske personal room mein join karwao
  // socket.join(`user:${user.id}`);

  socket.emit('connection:ready', {
    user_id: user.id,
  });

  // Conversation join handler isi block ke ANDAR hona chahiye
  socket.on('conversation:join', async (payload, acknowledge) => {
    const reply =
      typeof acknowledge === 'function' ? acknowledge : () => { };

    try {
      const conversationId = payload?.conversation_id;

      if (!isObjectId(conversationId)) {
        return reply({
          ok: false,
          error: 'Invalid conversation ID',
        });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: user.id,
      })
        .select('_id type workspace_id')
        .lean();

      if (
        !conversation ||
        (conversation.type !== 'direct' &&
          String(conversation.workspace_id) !== String(user.workspace_id))
      ) {
        return reply({
          ok: false,
          error: 'Conversation not found or access denied',
        });
      }

      await socket.join(`conversation:${conversationId}`);

      return reply({
        ok: true,
        conversation_id: String(conversationId),
      });
    } catch (error) {
      console.error('conversation:join error:', error);

      return reply({
        ok: false,
        error: 'Unable to join conversation',
      });
    }
  });

  // Existing socket.on('conversation:leave', ...) handler bhi
  // isi connection block ke andar hona chahiye.

}); // Connection block yahan close hota hai


await connectDatabase();

server.listen(env.PORT, () => {
  console.log(`EstateFlow API listening on port ${env.PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);

  io.close(() => {
    server.close(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

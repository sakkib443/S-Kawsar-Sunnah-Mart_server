import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';

let io: SocketIOServer | null = null;

interface SocketAuthPayload extends JwtPayload {
    userId: string;
    email?: string;
    role: string;
}

/**
 * Initialise the Socket.IO server and bind it to the given HTTP server.
 * - Authenticates every connection via JWT (handshake.auth.token, fallback query.token).
 * - Joins each socket to a personal room ('user:<userId>').
 * - Supports joining conversation rooms and relaying typing events.
 */
export const initSocket = (httpServer: HttpServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: true,
            credentials: true,
            methods: ['GET', 'POST'],
        },
    });

    // ── Auth middleware ──────────────────────────────────────────────
    io.use((socket: Socket, next) => {
        try {
            const token =
                (socket.handshake.auth && (socket.handshake.auth.token as string)) ||
                (socket.handshake.query && (socket.handshake.query.token as string));

            if (!token) {
                return next(new Error('unauthorized'));
            }

            const decoded = jwt.verify(token, config.jwt.access_secret) as SocketAuthPayload;
            socket.data.userId = decoded.userId;
            socket.data.role = decoded.role;
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    });

    // ── Connection handling ──────────────────────────────────────────
    io.on('connection', (socket: Socket) => {
        const userId = socket.data.userId as string;
        if (userId) {
            socket.join('user:' + userId);
        }
        // Admins/superadmins also join a shared room for live business/finance pushes.
        const role = socket.data.role as string;
        if (role === 'admin' || role === 'superadmin') {
            socket.join('admins');
        }

        // Join a specific conversation room for live updates.
        socket.on('conversation:join', (conversationId: string) => {
            if (conversationId) socket.join('conv:' + conversationId);
        });

        // Leave a conversation room.
        socket.on('conversation:leave', (conversationId: string) => {
            if (conversationId) socket.leave('conv:' + conversationId);
        });

        // Relay typing indicator to everyone else in the conversation room.
        socket.on('typing', (payload: { conversationId: string }) => {
            if (payload && payload.conversationId) {
                socket.to('conv:' + payload.conversationId).emit('typing', {
                    conversationId: payload.conversationId,
                    userId,
                });
            }
        });

        socket.on('disconnect', () => {
            // No extra cleanup required; rooms are dropped automatically.
        });
    });

    return io;
};

/**
 * Return the Socket.IO singleton. Throws if initSocket() was not called.
 */
export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initSocket(httpServer) first.');
    }
    return io;
};

/**
 * Emit a 'message:new' event to every participant's personal room and the
 * conversation room. Safe to call even if sockets aren't initialised yet.
 */
export const emitMessage = (
    message: unknown,
    participantIds: string[],
    convId: string
): void => {
    if (!io) return;
    const rooms = participantIds
        .map((id) => 'user:' + id)
        .concat('conv:' + convId);
    io.to(rooms).emit('message:new', message);
};

/**
 * Push a live business/finance update to every connected admin. Fired when an
 * order is placed or a payment is collected so the admin dashboard's revenue /
 * net-profit / sales figures refresh instantly (no 30s wait). Never throws.
 */
export const emitFinanceUpdate = (reason: string): void => {
    if (!io) return;
    try {
        io.to('admins').emit('finance:update', { reason, at: new Date().toISOString() });
    } catch {
        // never let a broadcast failure affect the request
    }
};

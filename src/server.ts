import mongoose from 'mongoose';
import app from './app';
import config from './app/config';
import { initSocket } from './app/utils/socket';
import { startCourierAutoSync } from './app/modules/courier/courier.cron';

process.on('uncaughtException', (error) => {
    console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
    console.error(error.message);
    process.exit(1);
});

// ── MongoDB Connection Caching ────────────────────────────────────
interface CachedConnection {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: CachedConnection | undefined;
}

const cached: CachedConnection = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) global.mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const opts: mongoose.ConnectOptions = {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        console.log('🔌 Connecting to MongoDB...');
        cached.promise = mongoose.connect(config.database_url, opts).then((m) => {
            console.log('✅ MongoDB Connected:', config.database_url);
            return m;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        console.error('❌ MongoDB Connection Error:', error);
        throw error;
    }

    return cached.conn;
}

// ── Connect immediately ───────────────────────────────────────────
connectDB().catch((err) => console.error('❌ Initial MongoDB connection failed:', err));

// ── Start Server ─────────────────────────────────────────────────
const server = app.listen(config.port, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║                                                  ║');
    console.log('║   🛒 S Kawsar Sunnah Mart API Server Started!             ║');
    console.log('║                                                  ║');
    console.log(`║   🌐 URL: http://localhost:${config.port}                  ║`);
    console.log(`║   🔧 Env:  ${String(config.env).padEnd(37)}║`);
    console.log('║                                                  ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});

// ── Real-time Messaging (Socket.IO) ───────────────────────────────
initSocket(server);

// ── Steadfast courier auto status-sync (opt-in via STEADFAST_AUTO_SYNC) ──
startCourierAutoSync();

process.on('unhandledRejection', (error: Error) => {
    console.error('💥 UNHANDLED REJECTION! Shutting down...');
    console.error(error.message);
    server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => console.log('💤 Process terminated.'));
});

export default app;

import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { env } from '../config/env.js';

const MySQLStore = MySQLStoreFactory(session);

// express-mysql-session manages its own connection pool (it needs a plain
// mysql2 callback-style Pool, not the pg-Pool-shaped promise wrapper in
// db/pool.ts), so it's configured from the same DATABASE_URL rather than
// sharing the app's pool.
const dbUrl = new URL(env.DATABASE_URL);

declare module 'express-session' {
  interface SessionData {
    staffId?: string;
  }
}

// Default session length, and the longer one opted into via "Remember me"
// at login (see modules/auth/controller.ts, which sets
// req.session.cookie.maxAge to one of these after a successful login).
// `rolling: true` below means either window resets on every request, so in
// practice a staff member using the app daily never sees either expiry —
// this only matters after a real gap in activity (e.g. away overnight).
export const DEFAULT_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours
export const REMEMBER_ME_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export const sessionMiddleware = session({
  store: new MySQLStore({
    host: dbUrl.hostname,
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    createDatabaseTable: false,
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: DEFAULT_SESSION_MAX_AGE_MS,
  },
});

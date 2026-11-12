import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, HttpError } from './middleware/errorHandler.js';
import { sessionMiddleware } from './middleware/session.js';
import { authRouter } from './modules/auth/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { permissionsRouter, rolesRouter, staffRouter } from './modules/staff/routes.js';
import { studentsRouter } from './modules/students/routes.js';
import { courseBatchesRouter, coursesRouter, enrollmentsRouter } from './modules/courses/routes.js';
import { attendanceRouter } from './modules/attendance/routes.js';
import { staffAttendanceRouter } from './modules/staff-attendance/routes.js';
import {
  feeDiscountsRouter,
  feePlansRouter,
  feeStructuresRouter,
  feeTransactionsRouter,
} from './modules/fees/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { examsRouter } from './modules/exams/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { licenseRouter } from './modules/license/routes.js';
import { leadsRouter } from './modules/leads/routes.js';
import { accountTransactionsRouter } from './modules/accounts/routes.js';

export function createApp() {
  const app = express();

  // Required in production: Caddy/nginx terminates TLS and forwards plain
  // HTTP internally, so without this Express never sees the connection as
  // secure and silently refuses to set the `secure` session cookie (see
  // middleware/session.ts) — logins would appear to succeed but the session
  // would never stick. Only trusted when actually in production, where the
  // documented deployment (docs/DEPLOYMENT.md) always puts a reverse proxy
  // in front; trusting X-Forwarded-* headers from an untrusted source would
  // let a client spoof "secure" and bypass the intent of COOKIE_SECURE.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin: env.NODE_ENV === 'development' ? true : env.APP_BASE_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(sessionMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/staff', staffRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/students', studentsRouter);
  app.use('/api/v1/courses', coursesRouter);
  app.use('/api/v1/course-batches', courseBatchesRouter);
  app.use('/api/v1/enrollments', enrollmentsRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/staff-attendance', staffAttendanceRouter);
  app.use('/api/v1/fee-structures', feeStructuresRouter);
  app.use('/api/v1/fee-discounts', feeDiscountsRouter);
  app.use('/api/v1/fee-plans', feePlansRouter);
  app.use('/api/v1/fee-transactions', feeTransactionsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/exams', examsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/license', licenseRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/account-transactions', accountTransactionsRouter);

  // Serve the built web app from the same process/port — the managed
  // hosting panel this app deploys to (see docs/DEPLOYMENT.md for the
  // Docker+Caddy alternative) allows only one Node process per site, so
  // there's no separate static-file container/reverse-proxy tier here.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDistPath = path.resolve(__dirname, '../../web/dist');

  app.use(express.static(webDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next(new HttpError(404, 'Not found'));
      return;
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}

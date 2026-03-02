import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './src/middlewares/errorHandler.js';
import absenceRouter from './src/routes/absenceRouter.js';
import auditLogRouter from './src/routes/auditLogRouter.js';
import authRouter from './src/routes/authRouter.js';
import calendarRouter from './src/routes/calendarRouter.js';
import customFieldRouter from './src/routes/customFieldRouter.js';
import dashboardRouter from './src/routes/dashboardRouter.js';
import healthRouter from './src/routes/healthRouter.js';
import jsErrorRouter from './src/routes/jsErrorRouter.js';
import monthClosureRouter from './src/routes/monthClosureRouter.js';
import notificationRouter from './src/routes/notificationRouter.js';
import projectCustomFieldRouter from './src/routes/projectCustomFieldRouter.js';
import projectRouter from './src/routes/projectRouter.js';
import reportRouter from './src/routes/reportRouter.js';
import userRouter from './src/routes/userRouter.js';
import workLogRouter from './src/routes/workLogRouter.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Публичные роуты
app.use('/api', healthRouter);
app.use('/api', jsErrorRouter);
app.use('/api', authRouter);

// Защищённые роуты
app.use('/api/users', userRouter);
app.use('/api/projects', projectRouter);
app.use('/api/custom-fields', customFieldRouter);
app.use('/api/projects/:projectId/custom-fields', projectCustomFieldRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/absences', absenceRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/month-closures', monthClosureRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/reports', reportRouter);
app.use('/api/work-logs', workLogRouter);

// Глобальный error handler — ПОСЛЕДНИМ
app.use(errorHandler);

export default app;

import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './src/middlewares/errorHandler.js';
import absenceRouter from './src/routes/absenceRouter.js';
import authRouter from './src/routes/authRouter.js';
import calendarRouter from './src/routes/calendarRouter.js';
import customFieldRouter from './src/routes/customFieldRouter.js';
import healthRouter from './src/routes/healthRouter.js';
import monthClosureRouter from './src/routes/monthClosureRouter.js';
import projectCustomFieldRouter from './src/routes/projectCustomFieldRouter.js';
import projectRouter from './src/routes/projectRouter.js';
import userRouter from './src/routes/userRouter.js';
import workLogRouter from './src/routes/workLogRouter.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Роуты
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api/absences', absenceRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/custom-fields', customFieldRouter);
app.use('/api/month-closures', monthClosureRouter);
app.use('/api/projects', projectRouter);
app.use('/api/projects/:projectId/custom-fields', projectCustomFieldRouter);
app.use('/api/users', userRouter);
app.use('/api/work-logs', workLogRouter);

// Глобальный error handler — подключить последним после всех роутов
app.use(errorHandler);

export default app;

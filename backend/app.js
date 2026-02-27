import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './src/middlewares/errorHandler.js';
import authRouter from './src/routes/authRouter.js';
import healthRouter from './src/routes/healthRouter.js';
import userRouter from './src/routes/userRouter.js';

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
app.use('/api/users', userRouter);

// Глобальный error handler — подключить последним после всех роутов
app.use(errorHandler);

export default app;

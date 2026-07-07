import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import botRouter from './routes/bot';

const app = express();
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors({ origin: true, credentials: true }));
app.use('/api', botRouter);

export default app;

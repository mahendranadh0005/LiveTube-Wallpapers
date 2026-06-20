import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { ensureDirsExist, cleanupTempFiles } from './utils/storage';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize folder structure
ensureDirsExist();

// Clean up old temporary files every 10 minutes
setInterval(() => {
  console.log('[Scheduler] Running cleanup of expired temp files...');
  cleanupTempFiles();
}, 10 * 60 * 1000);

// Run initial cleanup on start
cleanupTempFiles();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for local app development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'LiveTube Wallpapers Backend is running' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  LiveTube Wallpapers Backend Server is running!`);
  console.log(`  Port: http://localhost:${PORT}`);
  console.log(`==================================================`);
});

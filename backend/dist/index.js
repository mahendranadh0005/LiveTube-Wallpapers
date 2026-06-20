"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const storage_1 = require("./utils/storage");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Initialize folder structure
(0, storage_1.ensureDirsExist)();
// Clean up old temporary files every 10 minutes
setInterval(() => {
    console.log('[Scheduler] Running cleanup of expired temp files...');
    (0, storage_1.cleanupTempFiles)();
}, 10 * 60 * 1000);
// Run initial cleanup on start
(0, storage_1.cleanupTempFiles)();
// Middleware
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for local app development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api', routes_1.default);
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

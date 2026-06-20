"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const archiver_1 = __importDefault(require("archiver"));
const storage_1 = require("./utils/storage");
const ytDlp_1 = require("./utils/ytDlp");
const ffmpeg_1 = require("./utils/ffmpeg");
const router = (0, express_1.Router)();
// Configure multer for local video uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, storage_1.TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const fileId = (0, uuid_1.v4)();
        const ext = path_1.default.extname(file.originalname) || '.mp4';
        cb(null, `${fileId}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max upload limit
});
const jobs = new Map();
// Helper to run ffprobe on a file
function runFfprobe(filePath, entries) {
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('ffprobe', [
            '-v', 'error',
            '-show_entries', entries,
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath,
        ]);
        let stdout = '';
        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.on('close', (code) => {
            if (code === 0)
                resolve(stdout.trim());
            else
                reject(new Error(`ffprobe failed with code ${code}`));
        });
    });
}
// 1. YouTube Video Metadata Info Endpoint
router.post('/video-info', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'YouTube URL is required' });
    }
    try {
        const info = await (0, ytDlp_1.getVideoInfo)(url);
        res.json(info);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch YouTube video info' });
    }
});
// 2. Drag & Drop File Upload Endpoint
router.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }
    const filePath = req.file.path;
    const fileId = path_1.default.basename(req.file.filename, path_1.default.extname(req.file.filename));
    try {
        // Probe duration and resolution
        const durationStr = await runFfprobe(filePath, 'format=duration');
        const duration = parseFloat(durationStr) || 0;
        // Generate a thumbnail frame
        const thumbFilename = `thumb-${fileId}.jpg`;
        const thumbPath = path_1.default.join(storage_1.TEMP_DIR, thumbFilename);
        await new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)('ffmpeg', [
                '-ss', '1', // capture at 1 second mark
                '-i', filePath,
                '-vframes', '1',
                '-q:v', '2',
                '-y',
                thumbPath,
            ]);
            proc.on('close', (code) => {
                if (code === 0)
                    resolve(true);
                else
                    reject(new Error('Failed to generate thumbnail'));
            });
        });
        res.json({
            id: fileId,
            title: req.file.originalname,
            duration,
            thumbnailUrl: `/api/temp-file/${thumbFilename}`,
            fileName: req.file.filename,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to parse uploaded video' });
    }
});
// 3. Initiate Wallpaper Processing Endpoint
router.post('/generate', async (req, res) => {
    const { url, localFileId, startSec = 0, endSec = 10, resolution = '1080p', fps = 30, aspectRatio = '16:9', effects = [], burnSubtitles = false, subLanguage = 'en', seamlessLoop = true, } = req.body;
    if (!url && !localFileId) {
        return res.status(400).json({ error: 'Either YouTube URL or Local File ID is required' });
    }
    const jobId = (0, uuid_1.v4)();
    const jobTitle = url ? 'YouTube Wallpaper' : 'Local Video Wallpaper';
    // Initialize job status
    jobs.set(jobId, {
        id: jobId,
        status: 'pending',
        progress: 5,
        title: jobTitle,
    });
    // Start processing in the background
    (async () => {
        const job = jobs.get(jobId);
        job.status = 'processing';
        let inputPath = '';
        let subtitlePath;
        try {
            if (url) {
                // Download YouTube Video
                job.progress = 10;
                const tempDownloadPath = path_1.default.join(storage_1.TEMP_DIR, `yt-download-${jobId}.mp4`);
                const subTempPath = path_1.default.join(storage_1.TEMP_DIR, `yt-sub-${jobId}.srt`);
                const downloadResult = await (0, ytDlp_1.downloadVideo)({
                    url,
                    outputPath: tempDownloadPath,
                    startSec,
                    endSec,
                    downloadSubtitles: burnSubtitles,
                    subLanguage,
                    subOutputPath: subTempPath,
                });
                inputPath = downloadResult.videoPath;
                subtitlePath = downloadResult.subtitlePath;
            }
            else {
                // Find local file in TEMP_DIR
                const files = fs_1.default.readdirSync(storage_1.TEMP_DIR);
                const match = files.find((f) => f.startsWith(localFileId) && !f.startsWith('thumb-'));
                if (!match) {
                    throw new Error('Local video file not found');
                }
                inputPath = path_1.default.join(storage_1.TEMP_DIR, match);
            }
            job.progress = 40;
            // Output Wallpaper filenames
            const videoFilename = `wallpaper-${jobId}.mp4`;
            const videoOutputPath = path_1.default.join(storage_1.TEMP_DIR, videoFilename);
            // Run FFmpeg pipeline
            await (0, ffmpeg_1.processVideo)({
                inputPath,
                outputPath: videoOutputPath,
                startSec: url ? 0 : startSec, // if YouTube download was already trimmed, start from 0
                endSec: url ? (endSec - startSec) : endSec,
                resolution,
                fps,
                aspectRatio,
                effects,
                burnSubtitles: burnSubtitles && !!subtitlePath,
                subtitlePath,
                seamlessLoop,
            }, (percent) => {
                // scale FFmpeg progress (0-100) to job progress (40-90)
                job.progress = Math.min(40 + Math.round((percent / 100) * 50), 90);
            });
            // Create Wallpaper Engine ZIP archive
            job.progress = 92;
            const zipFilename = `wallpaper-engine-${jobId}.zip`;
            const zipOutputPath = path_1.default.join(storage_1.TEMP_DIR, zipFilename);
            const zipStream = fs_1.default.createWriteStream(zipOutputPath);
            const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
            archive.pipe(zipStream);
            // project.json structure for Wallpaper Engine
            const projectJson = {
                title: `LiveTube Wallpapers - ${jobId.substring(0, 8)}`,
                description: 'Looping wallpaper generated from LiveTube Wallpapers',
                type: 'video',
                file: 'wallpaper.mp4',
                preview: 'preview.jpg', // we can copy the thumb
                visibility: 'public',
                general: {
                    properties: {},
                },
            };
            archive.append(JSON.stringify(projectJson, null, 2), { name: 'project.json' });
            archive.file(videoOutputPath, { name: 'wallpaper.mp4' });
            // Add a thumbnail
            let thumbSourcePath = path_1.default.join(storage_1.TEMP_DIR, `thumb-${localFileId}.jpg`);
            if (url || !fs_1.default.existsSync(thumbSourcePath)) {
                // generate a quick thumb from the final video
                thumbSourcePath = path_1.default.join(storage_1.TEMP_DIR, `thumb-final-${jobId}.jpg`);
                await new Promise((resolve) => {
                    const proc = (0, child_process_1.spawn)('ffmpeg', [
                        '-i', videoOutputPath,
                        '-vframes', '1',
                        '-y',
                        thumbSourcePath,
                    ]);
                    proc.on('close', () => resolve(true));
                });
            }
            if (fs_1.default.existsSync(thumbSourcePath)) {
                archive.file(thumbSourcePath, { name: 'preview.jpg' });
            }
            await archive.finalize();
            // Clean up inputs to save space
            if (url && fs_1.default.existsSync(inputPath)) {
                fs_1.default.unlinkSync(inputPath);
            }
            if (subtitlePath && fs_1.default.existsSync(subtitlePath)) {
                fs_1.default.unlinkSync(subtitlePath);
            }
            job.status = 'completed';
            job.progress = 100;
            job.videoFilename = videoFilename;
            job.zipFilename = zipFilename;
            jobs.set(jobId, job);
            console.log(`[Job] Job ${jobId} completed successfully!`);
        }
        catch (err) {
            console.error(`[Job] Job ${jobId} failed:`, err);
            job.status = 'failed';
            job.error = err.message || 'Video processing failed';
            jobs.set(jobId, job);
        }
    })();
    res.json({ jobId });
});
// 4. Job Status Endpoint
router.get('/job-status/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
});
// 5. Download Files Endpoint
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    // Ensure we only download files from TEMP_DIR to prevent directory traversal
    const safeFilename = path_1.default.basename(filename);
    const filePath = path_1.default.join(storage_1.TEMP_DIR, safeFilename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, safeFilename);
});
// 6. Serve Temp Thumbnail/Preview files (needed for local uploads)
router.get('/temp-file/:filename', (req, res) => {
    const filename = req.params.filename;
    const safeFilename = path_1.default.basename(filename);
    const filePath = path_1.default.join(storage_1.TEMP_DIR, safeFilename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
});
exports.default = router;

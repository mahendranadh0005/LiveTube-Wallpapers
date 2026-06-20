"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCookiesFile = findCookiesFile;
exports.downloadFile = downloadFile;
exports.ensureYtDlpInstalled = ensureYtDlpInstalled;
exports.getVideoInfo = getVideoInfo;
exports.downloadVideo = downloadVideo;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const child_process_1 = require("child_process");
const storage_1 = require("./storage");
const isWindows = process.platform === 'win32';
const YT_DLP_BINARY = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YT_DLP_PATH = path_1.default.join(storage_1.BIN_DIR, YT_DLP_BINARY);
const YT_DLP_URL = isWindows
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
// Find cookies.txt in multiple possible paths for local and cloud environments
function findCookiesFile() {
    const possiblePaths = [
        path_1.default.join(storage_1.BACKEND_DIR, 'cookies.txt'),
        path_1.default.join(process.cwd(), 'cookies.txt'),
        path_1.default.join(storage_1.BACKEND_DIR, '..', 'cookies.txt'),
        '/opt/render/project/src/cookies.txt',
        '/app/cookies.txt',
        '/opt/render/project/src/backend/cookies.txt',
    ];
    for (const p of possiblePaths) {
        if (fs_1.default.existsSync(p)) {
            console.log(`[yt-dlp] Found cookies.txt file at: ${p}`);
            return p;
        }
    }
    console.log(`[yt-dlp] cookies.txt not found in checked locations: ${possiblePaths.join(', ')}`);
    return null;
}
// Helper to download with redirect support
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(dest);
        const request = (targetUrl) => {
            https_1.default.get(targetUrl, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    // Follow redirect
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        request(redirectUrl);
                    }
                    else {
                        reject(new Error(`Redirect status ${response.statusCode} without location header`));
                    }
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download, status code: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs_1.default.unlink(dest, () => { }); // delete partial file
                reject(err);
            });
        };
        request(url);
    });
}
async function ensureYtDlpInstalled() {
    (0, storage_1.ensureDirsExist)();
    if (fs_1.default.existsSync(YT_DLP_PATH)) {
        return YT_DLP_PATH;
    }
    console.log(`[yt-dlp] Downloading yt-dlp binary from ${YT_DLP_URL}...`);
    try {
        await downloadFile(YT_DLP_URL, YT_DLP_PATH);
        console.log(`[yt-dlp] Download complete! Saved to ${YT_DLP_PATH}`);
        // Set executable permissions on Linux/macOS
        if (!isWindows) {
            fs_1.default.chmodSync(YT_DLP_PATH, '755');
            console.log(`[yt-dlp] Set executable permissions (chmod 755)`);
        }
        return YT_DLP_PATH;
    }
    catch (err) {
        console.error(`[yt-dlp] Failed to download yt-dlp binary:`, err);
        throw err;
    }
}
async function getVideoInfo(url) {
    const ytDlpPath = await ensureYtDlpInstalled();
    return new Promise((resolve, reject) => {
        const args = ['--dump-json'];
        const cookiesPath = findCookiesFile();
        if (cookiesPath) {
            args.push('--cookies', cookiesPath);
        }
        args.push(url);
        console.log(`[yt-dlp] Querying metadata: yt-dlp ${args.map(a => a.includes('cookies.txt') ? 'cookies.txt' : a).join(' ')}`);
        const proc = (0, child_process_1.spawn)(ytDlpPath, args);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`yt-dlp info command failed with code ${code}: ${stderr}`));
            }
            try {
                const data = JSON.parse(stdout);
                // Extract subtitles information
                const subtitles = [];
                if (data.subtitles) {
                    Object.keys(data.subtitles).forEach((lang) => {
                        subtitles.push({ lang, name: `Closed Captions (${lang.toUpperCase()})` });
                    });
                }
                // Add auto-generated subtitles if available and not already in manual subtitles
                if (data.automatic_captions) {
                    Object.keys(data.automatic_captions).forEach((lang) => {
                        if (!subtitles.find((s) => s.lang === lang)) {
                            subtitles.push({ lang, name: `Auto-translated (${lang.toUpperCase()})` });
                        }
                    });
                }
                // Get thumbnail
                let thumbnail = data.thumbnail || '';
                if (data.thumbnails && data.thumbnails.length > 0) {
                    // find best thumbnail
                    thumbnail = data.thumbnails[data.thumbnails.length - 1].url;
                }
                resolve({
                    id: data.id,
                    title: data.title,
                    duration: data.duration,
                    thumbnail,
                    webpage_url: data.webpage_url,
                    subtitles,
                });
            }
            catch (err) {
                reject(err);
            }
        });
    });
}
async function downloadVideo(options) {
    const ytDlpPath = await ensureYtDlpInstalled();
    return new Promise((resolve, reject) => {
        // Basic arguments for high quality video/audio merged to mp4
        // We restrict maximum height to 1080p for fast download unless user specifically needs higher
        // But since the server runs locally on their system, let's download the best format up to 4K if it exists
        const args = [
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '-o', options.outputPath,
        ];
        const cookiesPath = findCookiesFile();
        if (cookiesPath) {
            args.push('--cookies', cookiesPath);
        }
        // Handle sections download if requested (requires ffmpeg available on system path)
        if (options.startSec !== undefined && options.endSec !== undefined) {
            args.push('--download-sections', `*${options.startSec}-${options.endSec}`);
        }
        // Handle subtitles
        if (options.downloadSubtitles && options.subLanguage && options.subOutputPath) {
            args.push('--write-subs', '--write-auto-subs');
            args.push('--sub-langs', options.subLanguage);
            args.push('--sub-format', 'srt');
        }
        args.push(options.url);
        console.log(`[yt-dlp] Running: yt-dlp ${args.join(' ')}`);
        const proc = (0, child_process_1.spawn)(ytDlpPath, args);
        let stderr = '';
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`yt-dlp download failed with code ${code}: ${stderr}`));
            }
            // Check if subtitle file was created
            let finalSubPath;
            if (options.downloadSubtitles && options.subLanguage && options.subOutputPath) {
                // yt-dlp names subtitle files like <output_path>.<lang>.srt
                const ext = path_1.default.extname(options.outputPath);
                const baseWithoutExt = options.outputPath.substring(0, options.outputPath.length - ext.length);
                const expectedSubPath = `${baseWithoutExt}.${options.subLanguage}.srt`;
                if (fs_1.default.existsSync(expectedSubPath)) {
                    // Rename or copy to desired subOutputPath
                    fs_1.default.renameSync(expectedSubPath, options.subOutputPath);
                    finalSubPath = options.subOutputPath;
                }
                else {
                    // check if there's any other subtitle extensions created (like vtt)
                    const expectedSubPathVtt = `${baseWithoutExt}.${options.subLanguage}.vtt`;
                    if (fs_1.default.existsSync(expectedSubPathVtt)) {
                        // we will need to convert VTT to SRT or use it directly
                        fs_1.default.renameSync(expectedSubPathVtt, options.subOutputPath.replace('.srt', '.vtt'));
                        finalSubPath = options.subOutputPath.replace('.srt', '.vtt');
                    }
                }
            }
            resolve({
                videoPath: options.outputPath,
                subtitlePath: finalSubPath,
            });
        });
    });
}

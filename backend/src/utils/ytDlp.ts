import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn, execSync } from 'child_process';
import { BIN_DIR, BACKEND_DIR, TEMP_DIR, ensureDirsExist } from './storage';

const isWindows = process.platform === 'win32';
const YT_DLP_BINARY = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const YT_DLP_PATH = path.join(BIN_DIR, YT_DLP_BINARY);
const YT_DLP_URL = isWindows
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

// Find cookies.txt in multiple possible paths for local and cloud environments
export function findCookiesFile(): string | null {
  const possiblePaths = [
    path.join(BACKEND_DIR, 'cookies.txt'),
    path.join(process.cwd(), 'cookies.txt'),
    '/etc/secrets/cookies.txt', // Render default secrets mount directory
    path.join(BACKEND_DIR, '..', 'cookies.txt'),
    '/opt/render/project/src/cookies.txt',
    '/app/cookies.txt',
    '/opt/render/project/src/backend/cookies.txt',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[yt-dlp] Found cookies.txt file at: ${p}`);
      
      // Copy to writeable TEMP_DIR to prevent read-only filesystem crashes
      const writeablePath = path.join(TEMP_DIR, 'cookies-active.txt');
      try {
        fs.copyFileSync(p, writeablePath);
        // On Linux, make it writeable for the running process
        if (process.platform !== 'win32') {
          fs.chmodSync(writeablePath, '666');
        }
        console.log(`[yt-dlp] Copied cookies.txt to writeable path: ${writeablePath}`);
        return writeablePath;
      } catch (err) {
        console.error(`[yt-dlp] Failed to copy cookies to writeable location, falling back to original path:`, err);
        return p;
      }
    }
  }
  
  console.log(`[yt-dlp] cookies.txt not found in checked locations: ${possiblePaths.join(', ')}`);
  return null;
}

// Helper to download with redirect support
export function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = (targetUrl: string) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            request(redirectUrl);
          } else {
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
        fs.unlink(dest, () => {}); // delete partial file
        reject(err);
      });
    };

    request(url);
  });
}

function isGlobalYtDlpAvailable(): boolean {
  try {
    execSync(isWindows ? 'where yt-dlp' : 'which yt-dlp', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

export async function ensureYtDlpInstalled(): Promise<string> {
  // If yt-dlp is installed globally (e.g. via pip in the Docker container), use it directly
  if (isGlobalYtDlpAvailable()) {
    console.log(`[yt-dlp] Using globally installed yt-dlp from system PATH`);
    return 'yt-dlp';
  }

  ensureDirsExist();
  if (fs.existsSync(YT_DLP_PATH)) {
    return YT_DLP_PATH;
  }

  console.log(`[yt-dlp] Downloading yt-dlp binary from ${YT_DLP_URL}...`);
  try {
    await downloadFile(YT_DLP_URL, YT_DLP_PATH);
    console.log(`[yt-dlp] Download complete! Saved to ${YT_DLP_PATH}`);
    
    // Set executable permissions on Linux/macOS
    if (!isWindows) {
      fs.chmodSync(YT_DLP_PATH, '755');
      console.log(`[yt-dlp] Set executable permissions (chmod 755)`);
    }
    
    return YT_DLP_PATH;
  } catch (err) {
    console.error(`[yt-dlp] Failed to download yt-dlp binary:`, err);
    throw err;
  }
}

export interface VideoMetadata {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  webpage_url: string;
  subtitles: { lang: string; name: string }[];
}

export async function getVideoInfo(url: string): Promise<VideoMetadata> {
  const ytDlpPath = await ensureYtDlpInstalled();

  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--js-runtimes', `node:${process.execPath}`];
    const cookiesPath = findCookiesFile();
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }
    args.push(url);

    console.log(`[yt-dlp] Querying metadata: yt-dlp ${args.map(a => a.includes('cookies.txt') ? 'cookies.txt' : a).join(' ')}`);
    const proc = spawn(ytDlpPath, args);
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
        const subtitles: { lang: string; name: string }[] = [];
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
      } catch (err) {
        reject(err);
      }
    });
  });
}

interface DownloadOptions {
  url: string;
  outputPath: string;
  startSec?: number;
  endSec?: number;
  downloadSubtitles?: boolean;
  subLanguage?: string;
  subOutputPath?: string;
}

export async function downloadVideo(options: DownloadOptions): Promise<{ videoPath: string; subtitlePath?: string }> {
  const ytDlpPath = await ensureYtDlpInstalled();

  return new Promise((resolve, reject) => {
    // Basic arguments for high quality video/audio merged to mp4
    // We restrict maximum height to 1080p for fast download unless user specifically needs higher
    // But since the server runs locally on their system, let's download the best format up to 4K if it exists
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', options.outputPath,
      '--js-runtimes', `node:${process.execPath}`,
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
    const proc = spawn(ytDlpPath, args);

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp download failed with code ${code}: ${stderr}`));
      }

      // Check if subtitle file was created
      let finalSubPath: string | undefined;
      if (options.downloadSubtitles && options.subLanguage && options.subOutputPath) {
        // yt-dlp names subtitle files like <output_path>.<lang>.srt
        const ext = path.extname(options.outputPath);
        const baseWithoutExt = options.outputPath.substring(0, options.outputPath.length - ext.length);
        const expectedSubPath = `${baseWithoutExt}.${options.subLanguage}.srt`;

        if (fs.existsSync(expectedSubPath)) {
          // Rename or copy to desired subOutputPath
          fs.renameSync(expectedSubPath, options.subOutputPath);
          finalSubPath = options.subOutputPath;
        } else {
          // check if there's any other subtitle extensions created (like vtt)
          const expectedSubPathVtt = `${baseWithoutExt}.${options.subLanguage}.vtt`;
          if (fs.existsSync(expectedSubPathVtt)) {
            // we will need to convert VTT to SRT or use it directly
            fs.renameSync(expectedSubPathVtt, options.subOutputPath.replace('.srt', '.vtt'));
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

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResolutionDimensions = getResolutionDimensions;
exports.processVideo = processVideo;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
function getResolutionDimensions(resolution, aspectRatio) {
    // Dimensions map based on ratio and resolution scale
    if (aspectRatio === '16:9') {
        switch (resolution) {
            case '720p': return { width: 1280, height: 720 };
            case '1440p': return { width: 2560, height: 1440 };
            case '4k': return { width: 3840, height: 2160 };
            case '1080p':
            default:
                return { width: 1920, height: 1080 };
        }
    }
    else if (aspectRatio === '9:16') {
        switch (resolution) {
            case '720p': return { width: 720, height: 1280 };
            case '1440p': return { width: 1440, height: 2560 };
            case '4k': return { width: 2160, height: 3840 };
            case '1080p':
            default:
                return { width: 1080, height: 1920 };
        }
    }
    else { // '21:9' (Ultrawide)
        switch (resolution) {
            case '720p': return { width: 1680, height: 720 };
            case '1440p': return { width: 3440, height: 1440 };
            case '4k': return { width: 5120, height: 2160 };
            case '1080p':
            default:
                return { width: 2560, height: 1080 };
        }
    }
}
function processVideo(options, onProgress) {
    return new Promise((resolve, reject) => {
        const { width, height } = getResolutionDimensions(options.resolution, options.aspectRatio);
        const duration = options.endSec - options.startSec;
        // We build the complex filter graph
        let filterComplex = '';
        let currentStream = '0:v';
        // 1. Aspect Ratio Handling (Crop or Blur Background)
        if (options.effects.includes('blur_background')) {
            // Split the source video stream
            // Background: scale to fill and crop, then blur
            // Foreground: scale to fit
            // Overlay foreground on blurred background
            filterComplex += `[${currentStream}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=40:5[bg];`;
            filterComplex += `[${currentStream}]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];`;
            filterComplex += `[bg][fg]overlay=(W-w)/2:(H-h)/2[aspectv];`;
            currentStream = 'aspectv';
        }
        else {
            // Center crop to target aspect ratio
            let numericalRatio = 16 / 9;
            if (options.aspectRatio === '9:16')
                numericalRatio = 9 / 16;
            if (options.aspectRatio === '21:9')
                numericalRatio = 21 / 9;
            filterComplex += `[${currentStream}]crop=w='min(iw\\,ih*${numericalRatio})':h='min(ih\\,iw/${numericalRatio})',scale=${width}:${height}[aspectv];`;
            currentStream = 'aspectv';
        }
        // 2. Motion Zoom (Subtle drifting pan effect)
        if (options.effects.includes('motion_zoom')) {
            const zoomWidth = Math.round(width * 1.08);
            const zoomHeight = Math.round(height * 1.08);
            filterComplex += `[${currentStream}]scale=${zoomWidth}:${zoomHeight},crop=${width}:${height}:x='(iw-ow)/2+(iw-ow)/2*sin(t/3)':y='(ih-oh)/2+(ih-oh)/2*cos(t/4)'[zoomv];`;
            currentStream = 'zoomv';
        }
        // 3. Glow Effect
        if (options.effects.includes('glow_effect')) {
            filterComplex += `[${currentStream}]split[g1][g2];[g2]boxblur=15:3[g2b];[g1][g2b]blend=all_mode='screen'[glowv];`;
            currentStream = 'glowv';
        }
        // 4. Color Enhancement
        if (options.effects.includes('color_enhancement')) {
            filterComplex += `[${currentStream}]eq=saturation=1.35:contrast=1.1:brightness=0.03[colorv];`;
            currentStream = 'colorv';
        }
        // 5. Vignette
        if (options.effects.includes('vignette')) {
            filterComplex += `[${currentStream}]vignette=angle=0.45[vignettev];`;
            currentStream = 'vignettev';
        }
        // 6. Closed Captions (Subtitles)
        if (options.burnSubtitles && options.subtitlePath) {
            // Relative path to avoid backslash escaping issues on Windows
            const relativeSubPath = path_1.default.relative(process.cwd(), options.subtitlePath).replace(/\\/g, '/');
            filterComplex += `[${currentStream}]subtitles='${relativeSubPath}'[subsv];`;
            currentStream = 'subsv';
        }
        // 7. Particle Overlay (Film grain texture)
        if (options.effects.includes('particle_overlay')) {
            filterComplex += `[${currentStream}]noise=alls=6:allf=t[particlev];`;
            currentStream = 'particlev';
        }
        // 8. Seamless Loop Crossfade
        if (options.seamlessLoop && duration > 2) {
            const crossfadeDuration = 1.0; // 1 second crossfade
            const trimStart = crossfadeDuration;
            const trimEnd = duration - crossfadeDuration;
            // Split the filtered stream into 3 parts:
            // v_main: trim from trimStart to trimEnd
            // v_end: trim from trimEnd to duration
            // v_start: trim from 0 to trimStart
            filterComplex += `[${currentStream}]split=3[v_all1][v_all2][v_all3];`;
            filterComplex += `[v_all1]trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS[v_main];`;
            filterComplex += `[v_all2]trim=start=${trimEnd}:end=${duration},setpts=PTS-STARTPTS[v_end];`;
            filterComplex += `[v_all3]trim=start=0:end=${trimStart},setpts=PTS-STARTPTS[v_start];`;
            // Crossfade v_end and v_start
            filterComplex += `[v_end][v_start]xfade=transition=fade:duration=${crossfadeDuration}:offset=0[vxf];`;
            // Concatenate main and crossfade parts
            filterComplex += `[v_main][vxf]concat=n=2:v=1:a=0[finalv]`;
            currentStream = 'finalv';
        }
        // Combine args
        const args = [];
        // Input file (trim input via -ss and -to before filters to speed up processing)
        args.push('-ss', options.startSec.toString());
        args.push('-to', options.endSec.toString());
        args.push('-i', options.inputPath);
        // Apply complex filter graph
        args.push('-filter_complex', filterComplex);
        args.push('-map', `[${currentStream}]`);
        // Output fps, video codec and settings for premium compatibility (H.264 mp4)
        args.push('-r', options.fps.toString());
        args.push('-c:v', 'libx264');
        args.push('-preset', 'medium'); // fast, medium, slow
        args.push('-crf', '18'); // visually lossless compression
        args.push('-pix_fmt', 'yuv420p'); // essential for mobile/windows player support
        args.push('-an'); // remove audio (standard for wallpapers)
        args.push('-y'); // overwrite output
        args.push(options.outputPath);
        console.log(`[FFmpeg] Running: ffmpeg ${args.join(' ')}`);
        const proc = (0, child_process_1.spawn)('ffmpeg', args);
        let stderr = '';
        proc.stderr.on('data', (data) => {
            const line = data.toString();
            stderr += line;
            // Extract progress if possible
            // FFmpeg logs time=HH:MM:SS.ms, we can parse it to estimate completion
            const match = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
            if (match && onProgress) {
                const hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                const seconds = parseInt(match[3]);
                const ms = parseInt(match[4]);
                const currentTime = hours * 3600 + minutes * 60 + seconds + ms / 100;
                // Calculate percentage (since we cut to `duration` length)
                let percent = Math.min(Math.round((currentTime / duration) * 100), 99);
                onProgress(percent);
            }
        });
        proc.on('close', (code) => {
            if (code === 0) {
                if (onProgress)
                    onProgress(100);
                resolve(options.outputPath);
            }
            else {
                reject(new Error(`FFmpeg failed with exit code ${code}. Error: ${stderr}`));
            }
        });
    });
}

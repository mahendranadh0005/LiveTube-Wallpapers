# LiveTube Wallpapers

LiveTube Wallpapers is a premium full-stack application designed to generate high-quality, customized live wallpapers for Desktop monitors, mobile phones (Android/iOS), and Ultrawide displays from any YouTube video or local video upload.

The application automatically downloads and updates `yt-dlp` to fetch YouTube video files and subtitles, uses `ffmpeg` for complex filter graphs (scaling, center-cropping, adding cinematics like Glow/Vignette/Drift zoom, burning closed captions, and generating seamless crossfade loops), and packages everything into an MP4 or Wallpaper Engine-ready ZIP format.

---

## Features

- **YouTube & Local File Uploads**: Paste any YouTube link or drag-and-drop video files up to 100MB.
- **Closed Caption Burning**: Automatically download and hardcode English or auto-translated subtitles into the video.
- **Cinematic Effects**: Customize your wallpaper with saturations boosts, dreamlike neon glow filters, slow drift zoom, vignetting, and analog film grain.
- **Perfect Seamless Loops**: Blends the last 1.0 second of the clip with the first 1.0 second using alpha crossfades, avoiding jarring jump-cuts.
- **Wallpaper Engine Integration**: Exports a structured ZIP archive including `project.json` and previews for direct imports.
- **Platform Guides**: Step-by-step installation walkthroughs for Windows Lively, Wallpaper Engine, Android, and iOS.

---

## Prerequisites

Ensure you have the following installed on your machine:
1. **Node.js** (v18 or higher)
2. **FFmpeg & FFprobe** (available globally on your system PATH)

*Note: `yt-dlp` is automatically managed by the backend server; no manual installation is required.*

---

## Installation & Running

This project uses a monorepo setup: `/backend` and `/frontend`.

### 1. Start Backend Server

Open a terminal inside the `backend` directory and run:

```bash
# Install dependencies
npm.cmd install

# Start Express server in development mode
npm.cmd run dev
```

The backend server will run on `http://localhost:5000`.

### 2. Start Frontend Server

Open another terminal inside the `frontend` directory and run:

```bash
# Install dependencies
npm.cmd install

# Start Next.js dev server
npm.cmd run dev
```

The Next.js frontend will run on `http://localhost:3000`.

---

## Important Technical Details for Windows

### PowerShell Execution Policy
If your system blocks executing PowerShell scripts (like `npm.ps1`), use `npm.cmd` and `npx.cmd` in place of `npm` and `npx` in all commands (e.g., `npm.cmd run dev` or `npx.cmd next dev`).

### FFmpeg Subtitle Paths
To burn subtitles into video on Windows, absolute path backslashes can fail in FFmpeg commands. The backend resolves this by calculating relative paths using forward slashes (e.g., `temp/yt-sub-xxx.srt`), which works reliably out-of-the-box.

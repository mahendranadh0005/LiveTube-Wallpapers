import fs from 'fs';
import path from 'path';

export const BACKEND_DIR = path.resolve(__dirname, '../..');
export const TEMP_DIR = path.join(BACKEND_DIR, 'temp');
export const BIN_DIR = path.join(BACKEND_DIR, 'bin');

export function ensureDirsExist() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }
}

// Clean up files older than 1 hour in TEMP_DIR
export function cleanupTempFiles() {
  if (!fs.existsSync(TEMP_DIR)) return;

  const files = fs.readdirSync(TEMP_DIR);
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  files.forEach((file) => {
    const filePath = path.join(TEMP_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      // Don't delete directories, only files (or empty folders if we create session subdirs)
      if (stats.isFile()) {
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`[Storage] Cleaned up temp file: ${file}`);
        }
      } else if (stats.isDirectory()) {
        // If it's a subdirectory, recursively clean and remove if old/empty
        const subFiles = fs.readdirSync(filePath);
        if (subFiles.length === 0 || now - stats.mtimeMs > maxAge) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`[Storage] Cleaned up temp directory: ${file}`);
        }
      }
    } catch (err) {
      console.error(`[Storage] Error cleaning up file ${file}:`, err);
    }
  });
}

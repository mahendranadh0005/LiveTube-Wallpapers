"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIN_DIR = exports.TEMP_DIR = exports.BACKEND_DIR = void 0;
exports.ensureDirsExist = ensureDirsExist;
exports.cleanupTempFiles = cleanupTempFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.BACKEND_DIR = path_1.default.resolve(__dirname, '../..');
exports.TEMP_DIR = path_1.default.join(exports.BACKEND_DIR, 'temp');
exports.BIN_DIR = path_1.default.join(exports.BACKEND_DIR, 'bin');
function ensureDirsExist() {
    if (!fs_1.default.existsSync(exports.TEMP_DIR)) {
        fs_1.default.mkdirSync(exports.TEMP_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(exports.BIN_DIR)) {
        fs_1.default.mkdirSync(exports.BIN_DIR, { recursive: true });
    }
}
// Clean up files older than 1 hour in TEMP_DIR
function cleanupTempFiles() {
    if (!fs_1.default.existsSync(exports.TEMP_DIR))
        return;
    const files = fs_1.default.readdirSync(exports.TEMP_DIR);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    files.forEach((file) => {
        const filePath = path_1.default.join(exports.TEMP_DIR, file);
        try {
            const stats = fs_1.default.statSync(filePath);
            // Don't delete directories, only files (or empty folders if we create session subdirs)
            if (stats.isFile()) {
                if (now - stats.mtimeMs > maxAge) {
                    fs_1.default.unlinkSync(filePath);
                    console.log(`[Storage] Cleaned up temp file: ${file}`);
                }
            }
            else if (stats.isDirectory()) {
                // If it's a subdirectory, recursively clean and remove if old/empty
                const subFiles = fs_1.default.readdirSync(filePath);
                if (subFiles.length === 0 || now - stats.mtimeMs > maxAge) {
                    fs_1.default.rmSync(filePath, { recursive: true, force: true });
                    console.log(`[Storage] Cleaned up temp directory: ${file}`);
                }
            }
        }
        catch (err) {
            console.error(`[Storage] Error cleaning up file ${file}:`, err);
        }
    });
}

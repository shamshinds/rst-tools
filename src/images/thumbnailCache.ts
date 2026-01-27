import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const CACHE_DIR = path.join(__dirname, '..', '..', '.thumbs');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

export function ensureCacheDir() {
 if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
 }
}

export function getThumbPath(imgPath: string): string {
 ensureCacheDir();
 const name = path.basename(imgPath);
 return path.join(CACHE_DIR, name.replace(/\./, '_thumb.'));
}

export async function ensureThumb(imgPath: string): Promise<string> {
 const thumb = getThumbPath(imgPath);
 if (fs.existsSync(thumb)) return thumb;

 await sharp(imgPath).resize({ width: 360 }).toFile(thumb);
 return thumb;
}

export function cleanupOldThumbs() {
 if (!fs.existsSync(CACHE_DIR)) return;

 const now = Date.now();
 for (const f of fs.readdirSync(CACHE_DIR)) {
  const full = path.join(CACHE_DIR, f);
  const stat = fs.statSync(full);
  if (now - stat.mtimeMs > MAX_AGE_MS) {
   fs.unlinkSync(full);
  }
 }
}

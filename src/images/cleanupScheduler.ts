import { cleanupOldThumbs } from './thumbnailCache';

export function startThumbCleanupScheduler() {
 // одна очистка при старте
 cleanupOldThumbs();

 // затем раз в сутки
 setInterval(() => {
  cleanupOldThumbs();
 }, 24 * 60 * 60 * 1000);
}

/* Lightweight filesystem cache for storing generated images.
   - Saves data URLs to disk as files
   - Returns file:// URLs for local access
   - Simple TTL-based expiration
*/

import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { logger } from "../../logger";

export interface CacheEntry {
  id: string;
  filePath: string;
  createdAt: number;
  ttl: number;
}

export class FileCache {
  private cacheDir: string;
  private indexPath: string;
  private index: Map<string, CacheEntry>;

  constructor(cacheDir: string, private defaultTTL: number = 7 * 24 * 60 * 60 * 1000) {
    this.cacheDir = cacheDir;
    this.indexPath = path.join(cacheDir, "index.json");
    this.index = new Map();
    this.ensureCacheDir();
    this.loadIndex();
  }

  private ensureCacheDir(): void {
    fs.ensureDirSync(this.cacheDir);
  }

  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readJsonSync(this.indexPath);
        this.index = new Map(Object.entries(data));
        logger.debug({ indexSize: this.index.size }, "Loaded cache index");
      }
    } catch (error) {
      logger.error(error, "Failed to load cache index");
      this.index = new Map();
    }
  }

  private saveIndex(): void {
    try {
      const data = Object.fromEntries(this.index);
      fs.writeJsonSync(this.indexPath, data, { spaces: 2 });
    } catch (error) {
      logger.error(error, "Failed to save cache index");
    }
  }

  has(id: string): boolean {
    const entry = this.index.get(id);
    if (!entry) {
      return false;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.createdAt > entry.ttl) {
      this.delete(id);
      return false;
    }

    // Check if file exists
    if (!fs.existsSync(entry.filePath)) {
      this.index.delete(id);
      this.saveIndex();
      return false;
    }

    return true;
  }

  get(id: string): string | null {
    if (!this.has(id)) {
      return null;
    }

    const entry = this.index.get(id)!;
    return entry.filePath;
  }

  getFileUrl(id: string): string | null {
    const filePath = this.get(id);
    if (!filePath) {
      return null;
    }
    return `file://${filePath}`;
  }

  getDataUrl(id: string): string | null {
    const filePath = this.get(id);
    if (!filePath) {
      return null;
    }

    try {
      const buf = fs.readFileSync(filePath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch (error) {
      logger.error(error, "Failed to read cached file");
      return null;
    }
  }

  setFromDataUrl(id: string, dataUrl: string, ttl?: number): string {
    // Extract base64 data from data URL
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid data URL format");
    }

    const [, format, base64Data] = matches;
    const buffer = Buffer.from(base64Data, "base64");

    // Generate filename from ID hash
    const hash = crypto.createHash("md5").update(id).digest("hex");
    const filename = `${hash}.${format}`;
    const filePath = path.join(this.cacheDir, filename);

    // Write file
    fs.writeFileSync(filePath, buffer);

    // Update index
    const entry: CacheEntry = {
      id,
      filePath,
      createdAt: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.index.set(id, entry);
    this.saveIndex();

    logger.debug({ id, filePath }, "Cached image to filesystem");

    return filePath;
  }

  delete(id: string): void {
    const entry = this.index.get(id);
    if (entry) {
      try {
        if (fs.existsSync(entry.filePath)) {
          fs.unlinkSync(entry.filePath);
        }
      } catch (error) {
        logger.error(error, "Failed to delete cached file");
      }
      this.index.delete(id);
      this.saveIndex();
    }
  }

  cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [id, entry] of this.index.entries()) {
      if (now - entry.createdAt > entry.ttl) {
        this.delete(id);
        deletedCount++;
      }
    }

    logger.debug({ deletedCount }, "Cleaned up expired cache entries");
  }

  clear(): void {
    for (const [id] of this.index.entries()) {
      this.delete(id);
    }
    logger.debug("Cleared all cache entries");
  }

  getStats(): { size: number; totalSizeBytes: number } {
    let totalSize = 0;

    for (const [, entry] of this.index.entries()) {
      try {
        if (fs.existsSync(entry.filePath)) {
          const stats = fs.statSync(entry.filePath);
          totalSize += stats.size;
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return {
      size: this.index.size,
      totalSizeBytes: totalSize,
    };
  }
}

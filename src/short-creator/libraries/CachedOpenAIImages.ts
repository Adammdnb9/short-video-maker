/* Cached wrapper for OpenAI Images API
   - Uses FileCache to store generated images
   - Returns file:// URLs to avoid re-encoding
   - Prevents duplicate API calls for the same prompt
*/

import { OpenAIImagesAPI, type ImageStyle } from "./OpenAIImages";
import { FileCache } from "./FileCache";
import { OrientationEnum, type Video } from "../../types/shorts";
import { logger } from "../../logger";
import path from "path";
import os from "os";

export class CachedOpenAIImagesAPI {
  private cache: FileCache;

  constructor(
    private api: OpenAIImagesAPI,
    cacheDir?: string,
  ) {
    const dir = cacheDir || path.join(os.homedir(), ".ai-agents-az-video-generator", "image-cache");
    this.cache = new FileCache(dir);
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
  ): Promise<Video> {
    // Create cache key from search terms and orientation
    const cacheKey = `${searchTerms.join("-")}-${orientation}`.replace(/[^a-z0-9-]/gi, "").toLowerCase();

    // Check cache first
    const cachedUrl = this.cache.getFileUrl(cacheKey);
    if (cachedUrl) {
      logger.debug({ cacheKey, url: cachedUrl }, "Using cached image");
      
      // Parse dimensions from the video object we'll create
      const width = orientation === OrientationEnum.portrait ? 1080 : 1920;
      const height = orientation === OrientationEnum.portrait ? 1920 : 1080;
      
      return {
        id: cacheKey,
        url: cachedUrl,
        width,
        height,
      };
    }

    // Generate new image
    logger.debug({ cacheKey, searchTerms }, "Cache miss, generating new image");
    const result = await this.api.findVideo(
      searchTerms,
      minDurationSeconds,
      excludeIds,
      orientation,
    );

    // Cache the result
    try {
      this.cache.setFromDataUrl(cacheKey, result.url);
      const fileUrl = this.cache.getFileUrl(cacheKey);
      
      if (fileUrl) {
        return {
          ...result,
          id: cacheKey,
          url: fileUrl,
        };
      }
    } catch (error) {
      logger.error(error, "Failed to cache image, returning original data URL");
    }

    return result;
  }

  cleanup(): void {
    this.cache.cleanup();
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return this.cache.getStats();
  }
}

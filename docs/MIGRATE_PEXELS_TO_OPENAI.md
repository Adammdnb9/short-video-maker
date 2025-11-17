# Migration Guide: Switching from Pexels Video to OpenAI Image Generation

This guide shows how to replace Pexels video lookups with OpenAI image generation in your short video maker workflow.

## Overview

The OpenAI Images API integration allows you to generate custom images instead of searching for stock videos. Images are then animated using the Ken Burns effect (zoom/pan) to create dynamic backgrounds for your short videos.

## Prerequisites

- OpenAI API key with access to DALL-E 3
- Understanding of your current Pexels integration points

## Step 1: Set Environment Variables

Add these to your `.env` file or environment:

```bash
# Required: Your OpenAI API key
OPENAI_API_KEY=sk-proj-...

# Optional: Image generation style (default: "creepy-cartoon-tiktok")
IMAGE_STYLE=neon
```

Available styles:
- `creepy-cartoon-tiktok` (default)
- `glitchy`
- `neon`
- `pastel-creepy`
- `vhs`
- `comic-pop`
- `surreal`
- `haunted-book`
- `retro-anime`
- `stop-motion`

## Step 2: Update Configuration

The app now accepts either `PEXELS_API_KEY` or `OPENAI_API_KEY`. You can run with OpenAI images instead of Pexels videos.

**Note**: `src/config.ts` has been updated to support both providers. The `ensureConfig` function now validates that at least one API key is present.

## Step 3: Swap Provider Instantiation

### Before (Pexels)

```typescript
import { PexelsAPI } from "./short-creator/libraries/Pexels";

const pexels = new PexelsAPI(process.env.PEXELS_API_KEY!);
const video = await pexels.findVideo(["playground"], 3.5, []);
// video: { id, url, width, height }
```

### After (OpenAI with caching)

```typescript
import { OpenAIImagesAPI } from "./short-creator/libraries/OpenAIImages";
import { CachedOpenAIImagesAPI } from "./short-creator/libraries/CachedOpenAIImages";

const imageStyle = (process.env.IMAGE_STYLE as ImageStyle) || "creepy-cartoon-tiktok";
const openai = new OpenAIImagesAPI(process.env.OPENAI_API_KEY!, imageStyle);
const cached = new CachedOpenAIImagesAPI(openai);

const image = await cached.findVideo(["playground"], 3.5, []);
// image: { id, url, width, height } - same shape as Pexels!
```

The `findVideo` method returns the same object shape, making the swap straightforward.

## Step 4: Update Remotion Composition

Since OpenAI returns static images instead of videos, you need to replace `OffthreadVideo` with the `KenBurnsImage` component for animation.

### Before (Pexels Video)

```typescript
import { OffthreadVideo } from "remotion";

<OffthreadVideo
  src={scene.video.url}
  startFrom={0}
  style={{ width: "100%", height: "100%" }}
/>
```

### After (OpenAI Image with Ken Burns)

```typescript
import { KenBurnsImage } from "../components/images/KenBurnsImage";

<KenBurnsImage
  src={scene.image.url}  // Can be file:// or data: URL
  durationInFrames={Math.floor(scene.audio.duration * fps)}
  direction="zoom-in"
  intensity={1.2}
/>
```

See [EXAMPLE_KENBURNS.md](./EXAMPLE_KENBURNS.md) for detailed usage examples.

## Step 5: Handle Scene Duration

With Pexels videos, the video duration could exceed the narration. With static images + Ken Burns, the image animation should match the narration duration.

```typescript
const durationInFrames = Math.floor(scene.audio.duration * fps);

<KenBurnsImage
  src={scene.image.url}
  durationInFrames={durationInFrames}
  direction="zoom-in"
/>
```

## Operational Notes

### Caching

**Highly recommended**: Use `CachedOpenAIImagesAPI` to avoid regenerating the same images.

- Images are cached based on search terms and orientation
- Cached images are stored in `~/.ai-agents-az-video-generator/image-cache` by default
- Cache reduces API costs and speeds up repeated generations

```typescript
const cached = new CachedOpenAIImagesAPI(openai, "/custom/cache/path");

// First call: generates image via API
const img1 = await cached.findVideo(["cat"], 3.0);

// Second call with same terms: returns from cache
const img2 = await cached.findVideo(["cat"], 3.0);
```

### Cleanup

```typescript
// Remove expired cache entries
cached.cleanup();

// Clear entire cache
cached.clear();

// Get cache statistics
const stats = cached.getStats();
console.log(`Cache size: ${stats.size} images, ${stats.totalSizeBytes} bytes`);
```

### Rate Limits

OpenAI has rate limits for image generation:
- DALL-E 3: typically 5 images/minute on free tier
- Consider caching and batch processing
- Handle rate limit errors gracefully

### Cost Considerations

- DALL-E 3 Standard: ~$0.04 per image (1024x1024)
- DALL-E 3 HD: ~$0.08 per image
- Caching significantly reduces costs for repeated scenes

### Prompt Tuning

Adjust the prompt style via `IMAGE_STYLE` environment variable:

```bash
# Neon cyberpunk aesthetic
IMAGE_STYLE=neon

# VHS retro look
IMAGE_STYLE=vhs

# Pastel creepy style
IMAGE_STYLE=pastel-creepy
```

Or customize prompts directly in `OpenAIImages.ts` by editing the `PROMPT_TEMPLATES` object.

## Example: Complete Migration

```typescript
// old-approach.ts (Pexels)
import { PexelsAPI } from "./libraries/Pexels";

const pexels = new PexelsAPI(process.env.PEXELS_API_KEY!);

for (const scene of scenes) {
  const video = await pexels.findVideo(scene.searchTerms, scene.duration, []);
  scene.video = video;
}

// new-approach.ts (OpenAI)
import { OpenAIImagesAPI } from "./libraries/OpenAIImages";
import { CachedOpenAIImagesAPI } from "./libraries/CachedOpenAIImages";

const openai = new OpenAIImagesAPI(process.env.OPENAI_API_KEY!, "neon");
const cached = new CachedOpenAIImagesAPI(openai);

for (const scene of scenes) {
  const image = await cached.findVideo(scene.searchTerms, scene.duration, []);
  scene.image = image; // Note: property name change from 'video' to 'image'
}
```

## Testing

Preview generated prompts without API calls:

```bash
npx ts-node src/scripts/preview-prompt.ts
```

Test with mock API responses:

```bash
npm test -- OpenAIImages.test.ts
```

## Rollback

To revert to Pexels:
1. Remove `OPENAI_API_KEY` from environment
2. Ensure `PEXELS_API_KEY` is set
3. Switch back to `PexelsAPI` and `OffthreadVideo`
4. Restart the server

## Troubleshooting

### "Invalid OpenAI API key"
- Verify your API key is correct
- Check that it has access to DALL-E 3
- Ensure the key isn't expired

### Images not displaying
- Check cache directory permissions
- Verify `file://` paths are absolute
- Try using `data:` URLs temporarily

### Poor image quality
- Try different `IMAGE_STYLE` values
- Adjust prompts in `PROMPT_TEMPLATES`
- Consider using HD quality (requires code change)

### Slow generation
- Enable caching with `CachedOpenAIImagesAPI`
- Generate images in advance during off-peak hours
- Consider parallel processing with rate limiting

## Next Steps

- Experiment with different image styles
- Tune prompts for your specific use case
- Set up a pre-generation pipeline for common scenes
- Monitor API usage and costs

See [EXAMPLE_KENBURNS.md](./EXAMPLE_KENBURNS.md) for animation examples and best practices.

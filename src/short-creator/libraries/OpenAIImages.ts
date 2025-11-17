/* OpenAI Images provider with built-in prompt templates (enum-style switch)
   - Exports ImageStyle union and getPrompt helper so the CLI can reuse the same templates
   - OpenAIImagesAPI.buildPrompt uses the template mapping and supports optional modifiers
   - findVideo keeps the same output shape as the Pexels provider (id, url, width, height)
*/

import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

export const IMAGE_STYLES = [
  "creepy-cartoon-tiktok",
  "glitchy",
  "neon",
  "pastel-creepy",
  "vhs",
  "comic-pop",
  "surreal",
  "haunted-book",
  "retro-anime",
  "stop-motion",
] as const;

export type ImageStyle = (typeof IMAGE_STYLES)[number];

const PROMPT_TEMPLATES: Record<ImageStyle, string> = {
  "creepy-cartoon-tiktok": `{searchTerm}. Render as a high-detail creepy cartoon in a viral TikTok art style: exaggerated features, high-contrast shading, bold colors, grainy film texture, dramatic side lighting, cinematic framing, subtle vignette; slightly unsettling expressions; no photorealism. Size: {width}x{height}.`,

  glitchy: `{searchTerm}. Render as a creepy cartoon in a glitchy viral-TikTok aesthetic: jittery halftone linework, RGB split/chromatic aberration, datamosh artifacts, digital scanlines, high-contrast neon highlights, bold cel-shading, dramatic low-angle composition; subtle motion blur as if frame-skipping. Do not render photorealistic. Size: {width}x{height}.`,

  neon: `{searchTerm}. Render as a creepy, neon-lit cartoon in a viral TikTok style: saturated neon palette (magenta, cyan, electric blue), strong rim light, reflective wet surfaces, cinematic depth, bold ink outlines, synthwave vibes, slightly uncanny expressions. Keep it stylized, not photorealistic. Size: {width}x{height}.`,

  "pastel-creepy": `{searchTerm}. Render as a creepy cartoon in a viral TikTok pastel style: soft pastel palette (muted pinks, mint, lavender), grainy texture, quirky unsettling smile, childlike character design with eerie atmosphere, low-contrast lighting, film grain, hand-drawn ink details. No photorealism. Size: {width}x{height}.`,

  vhs: `{searchTerm}. Render as a creepy cartoon in a 90s VHS viral TikTok look: heavy film grain, color bleed, soft focus, analog noise, saturated cyan-magenta tint, bold cartoon inking, high contrast lighting, retro framing. Slightly degraded edges and scanline artifacts. Not photorealistic. Size: {width}x{height}.`,

  "comic-pop": `{searchTerm}. Render as a creepy cartoon in a comic-pop viral TikTok style: thick halftone shading, dramatic cross-hatching, cinematic panel composition, saturated flat colors, exaggerated expressions, bold contrast, dynamic perspective. Add subtle vignette. Not photorealistic. Size: {width}x{height}.`,

  surreal: `{searchTerm}. Render as a surreal creepy cartoon in a viral TikTok aesthetic: dreamlike floating elements, warped perspective, soft glows, muted color palette with one contrasting accent, delicate linework, eerie yet whimsical mood; cinematic composition. No photorealism. Size: {width}x{height}.`,

  "haunted-book": `{searchTerm}. Render as a creepy cartoon in the style of a haunted children's book, viral-TikTok friendly: slightly naive rounded forms, textured paper grain, muted autumnal palette, eerie smiling characters, soft vignette, gentle film grain; evoke unsettling nostalgia while staying illustrated. Not photorealistic. Size: {width}x{height}.`,

  "retro-anime": `{searchTerm}. Render as a creepy cartoon in a retro anime viral TikTok style: cel-shaded, film grain, dramatic camera lens flares, moody backlighting, expressive eyes with uncanny detail, muted pastel highlights; cinematic composition, not photorealistic. Size: {width}x{height}.`,

  "stop-motion": `{searchTerm}. Render as a creepy cartoon with a stop-motion / claymation TikTok vibe: slightly uneven textures, visible fingerprints and seams, tactile shadows, warm studio lighting, subtle jittered framing as if captured frame-by-frame; keep it illustrated/handmade, not photorealistic. Size: {width}x{height}.`,
};

const NEGATIVE_PROMPT = `Avoid photorealism, photographic lighting, human skin pores, or realistic faces. No text, logos, or watermarks. Do not crop subjects off-frame; leave safe space for captions.`;

export function getPrompt(
  style: ImageStyle,
  searchTerm: string,
  width: number,
  height: number,
  modifiers?: string,
): string {
  const template = PROMPT_TEMPLATES[style];
  let prompt = template
    .replace("{searchTerm}", searchTerm)
    .replace("{width}", width.toString())
    .replace("{height}", height.toString());

  if (modifiers) {
    prompt += ` ${modifiers}`;
  }

  prompt += ` ${NEGATIVE_PROMPT}`;

  return prompt;
}

export class OpenAIImagesAPI {
  constructor(
    private API_KEY: string,
    private imageStyle: ImageStyle = "creepy-cartoon-tiktok",
  ) {}

  private buildPrompt(
    searchTerm: string,
    width: number,
    height: number,
    modifiers?: string,
  ): string {
    return getPrompt(this.imageStyle, searchTerm, width, height, modifiers);
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("OpenAI API key not set");
    }

    const searchTerm = searchTerms.join(", ");
    const { width, height } = getOrientationConfig(orientation);

    logger.debug(
      { searchTerm, orientation, imageStyle: this.imageStyle },
      "Generating image with OpenAI",
    );

    const prompt = this.buildPrompt(searchTerm, width, height);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: this.getSizeString(width, height),
            quality: "standard",
            response_format: "b64_json",
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Invalid OpenAI API key - please set a valid key in OPENAI_API_KEY environment variable",
          );
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();
      const imageData = data.data[0];

      if (!imageData || !imageData.b64_json) {
        throw new Error("No image data returned from OpenAI");
      }

      // Create a unique ID based on search terms and style
      const id = `openai-${this.imageStyle}-${searchTerms.join("-").replace(/[^a-z0-9-]/gi, "").toLowerCase()}-${Date.now()}`;

      // Convert base64 to data URL
      const dataUrl = `data:image/png;base64,${imageData.b64_json}`;

      logger.debug({ id, searchTerm, imageStyle: this.imageStyle }, "Image generated with OpenAI");

      return {
        id,
        url: dataUrl,
        width,
        height,
      };
    } catch (error) {
      logger.error(error, "Error generating image with OpenAI");
      throw error;
    }
  }

  private getSizeString(width: number, height: number): string {
    // DALL-E 3 only supports specific sizes
    // For portrait (1080x1920), use 1024x1792
    // For landscape or square, use closest match
    if (height > width) {
      return "1024x1792"; // portrait
    } else if (width > height) {
      return "1792x1024"; // landscape
    } else {
      return "1024x1024"; // square
    }
  }
}

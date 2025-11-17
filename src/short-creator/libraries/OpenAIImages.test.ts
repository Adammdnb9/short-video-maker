import nock from "nock";
import { test, expect, beforeAll, afterAll } from "vitest";
import { OpenAIImagesAPI, getPrompt, IMAGE_STYLES } from "./OpenAIImages";
import { OrientationEnum } from "../../types/shorts";

beforeAll(() => {
  process.env.LOG_LEVEL = "debug";
});

afterAll(() => {
  nock.cleanAll();
});

test("getPrompt generates correct prompt with style", () => {
  const prompt = getPrompt("neon", "spooky playground", 1080, 1920);
  expect(prompt).toContain("spooky playground");
  expect(prompt).toContain("neon");
  expect(prompt).toContain("1080x1920");
  expect(prompt).toContain("Avoid photorealism");
});

test("getPrompt with modifiers", () => {
  const prompt = getPrompt("glitchy", "cat", 1080, 1920, "low-angle shot");
  expect(prompt).toContain("cat");
  expect(prompt).toContain("low-angle shot");
});

test("OpenAIImagesAPI generates image and returns data URL", async () => {
  const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  
  nock("https://api.openai.com")
    .post("/v1/images/generations")
    .reply(200, {
      data: [
        {
          b64_json: mockBase64,
          revised_prompt: "A creepy cartoon playground",
        },
      ],
    });

  const api = new OpenAIImagesAPI("test-api-key", "neon");
  const result = await api.findVideo(["playground"], 3.0, [], OrientationEnum.portrait);

  expect(result).toHaveProperty("id");
  expect(result).toHaveProperty("url");
  expect(result).toHaveProperty("width");
  expect(result).toHaveProperty("height");
  expect(result.url).toContain("data:image/png;base64,");
  expect(result.id).toContain("openai-neon");
});

test("OpenAIImagesAPI handles API errors", async () => {
  nock("https://api.openai.com")
    .post("/v1/images/generations")
    .reply(401, { error: { message: "Invalid API key" } });

  const api = new OpenAIImagesAPI("invalid-key");
  
  await expect(async () => {
    await api.findVideo(["test"], 3.0);
  }).rejects.toThrow("Invalid OpenAI API key");
});

test("OpenAIImagesAPI handles missing API key", async () => {
  const api = new OpenAIImagesAPI("");
  
  await expect(async () => {
    await api.findVideo(["test"], 3.0);
  }).rejects.toThrow("OpenAI API key not set");
});

test("All image styles are valid", () => {
  for (const style of IMAGE_STYLES) {
    const prompt = getPrompt(style, "test", 1080, 1920);
    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(0);
  }
});

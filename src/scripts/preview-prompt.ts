#!/usr/bin/env ts-node
/* CLI helper to preview prompts and tweak adjectives interactively.
   Usage:
     - Install dependencies: npm install -D ts-node typescript @types/node inquirer @types/inquirer
     - Run: npx ts-node src/scripts/preview-prompt.ts
*/

import { IMAGE_STYLES, getPrompt, type ImageStyle } from "../short-creator/libraries/OpenAIImages";

// Simple interactive prompt since we may not have inquirer installed
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("\n🎨 OpenAI Image Prompt Preview Tool\n");
  console.log("Available styles:");
  IMAGE_STYLES.forEach((style, i) => {
    console.log(`  ${i + 1}. ${style}`);
  });

  const styleInput = await question("\nSelect style (1-10): ");
  const styleIndex = parseInt(styleInput, 10) - 1;

  if (styleIndex < 0 || styleIndex >= IMAGE_STYLES.length) {
    console.log("Invalid selection");
    rl.close();
    return;
  }

  const style = IMAGE_STYLES[styleIndex];

  const searchTerm = await question("Enter search term (e.g., 'spooky playground'): ");
  const orientation = await question("Orientation (portrait/landscape) [portrait]: ") || "portrait";
  
  const width = orientation === "landscape" ? 1920 : 1080;
  const height = orientation === "landscape" ? 1080 : 1920;

  const modifiers = await question("Optional modifiers (press enter to skip): ");

  console.log("\n" + "=".repeat(80));
  console.log("Generated Prompt:");
  console.log("=".repeat(80));

  const prompt = getPrompt(style, searchTerm, width, height, modifiers || undefined);
  console.log(prompt);

  console.log("\n" + "=".repeat(80));
  console.log(`Style: ${style}`);
  console.log(`Search Term: ${searchTerm}`);
  console.log(`Size: ${width}x${height}`);
  if (modifiers) {
    console.log(`Modifiers: ${modifiers}`);
  }
  console.log("=".repeat(80) + "\n");

  const again = await question("Preview another prompt? (y/n): ");
  if (again.toLowerCase() === "y") {
    await main();
  } else {
    rl.close();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});

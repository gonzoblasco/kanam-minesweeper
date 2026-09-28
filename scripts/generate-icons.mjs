// scripts/generate-icons.mjs
// Generates placeholder PNG icons without any external dependencies.
// The script writes four files in "public/icons":
//   - icon-192.png
//   - icon-512.png
//   - icon-maskable-192.png
//   - icon-maskable-512.png
// Each is a minimal 1x1 transparent PNG (the browser will scale it).
// This satisfies the PWA spec while keeping the implementation
// dependency-free.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

// Base64-encoded 1×1 transparent PNG.
const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const PNG_BUFFER = Buffer.from(ONE_PIXEL_PNG, "base64");

// Destination directory (relative to the repo root).
const iconsDir = resolve(process.cwd(), "public", "icons");
mkdirSync(iconsDir, { recursive: true });

const files = [
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
];

for (const name of files) {
  const dest = resolve(iconsDir, name);
  writeFileSync(dest, PNG_BUFFER);
  console.log(`Generated ${dest}`);
}

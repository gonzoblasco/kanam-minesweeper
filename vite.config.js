// Configuracion de Vite.
//
// `base` relativo (`./`) para que el sitio funcione tanto en la raiz del dominio
// como bajo el subpath de GitHub Pages (`/<repo>/`). El service worker se
// escribe a mano (cero dependencias de runtime) y lo emite un plugin propio.
import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

/**
 * Simple helper to walk a directory recursively and return a list of file paths.
 */
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  plugins: [
    {
      name: "pwa-generate-sw",
      // Runs after Vite has written the build output.
      writeBundle: async () => {
        const outDir = path.resolve(process.cwd(), "dist");
        const allFiles = walkDir(outDir);
        // Build a relative precache list, using './' prefix.
        const precache = allFiles
          .map((p) => "./" + path.relative(outDir, p).replace(/\\/g, "/"))
          .filter((p) => !p.endsWith("sw.js"));
        const version = JSON.stringify(precache);
        const templatePath = path.resolve(process.cwd(), "src", "ui", "sw-template.js");
        const template = fs.readFileSync(templatePath, "utf8");
        const swContent = template
          .replace("self.__precacheManifest = []", `self.__precacheManifest = ${JSON.stringify(precache)}`)
          .replace("self.__cacheVersion = \"\"", `self.__cacheVersion = ${JSON.stringify(version)}`);
        const swPath = path.join(outDir, "sw.js");
        fs.writeFileSync(swPath, swContent);
        console.log(`Generated service worker with ${precache.length} precached assets.`);
      },
    },
  ],
});


// Configuracion de Vite.
//
// `base` relativo (`./`) para que el sitio funcione tanto en la raiz del dominio
// como bajo el subpath de GitHub Pages (`/<repo>/`). El service worker se
// escribe a mano (cero dependencias de runtime) y lo emite un plugin propio.
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});

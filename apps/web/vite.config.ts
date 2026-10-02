import { readFileSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const releaseVersion = readFileSync(new URL("../../VERSION", import.meta.url), "utf8").trim();
if (!/^v\d+\.\d+\.\d+$/.test(releaseVersion)) {
  throw new Error("Invalid WarEra Lab release version: " + releaseVersion);
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_WARERA_LAB_VERSION": JSON.stringify(releaseVersion),
  },
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3220",
    },
  },
});

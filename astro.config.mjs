import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://lovemallacoota.au",
  output: "static",
  build: {
    format: "file",
  },
});

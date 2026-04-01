import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: "explorer",
  publicDir: path.resolve(__dirname, "data"),
  server: {
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
});

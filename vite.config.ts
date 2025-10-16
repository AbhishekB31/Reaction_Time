import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Required for GitHub Pages under /Reaction_Time
  base: "/Reaction_Time/",
  server: {
    host: "::",
    port: 8080
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Emit the production build into /docs so GitHub Pages can serve it directly
    outDir: "docs",
  },
}));

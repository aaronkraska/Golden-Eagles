import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// React handles JSX; the development proxy forwards browser /api calls to Express on port 3001.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Required for @solana/web3.js + @coral-xyz/anchor in the browser
    nodePolyfills({ include: ["buffer", "crypto", "stream", "util"] }),
  ],
  server: {
    allowedHosts: ["37a4f3162131.ngrok-free.app", "localhost:5173"],
  },
});

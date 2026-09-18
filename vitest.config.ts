import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Same "@/..." alias tsconfig gives the app, so tests can import
    // modules that reach the database client.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    setupFiles: ["dotenv/config"], // DATABASE_URL for the integration tests
  },
});

import { defineConfig } from "vitest/config";

// Only plain-TypeScript modules under lib/ are unit tested; screens run on device.
export default defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node" } });

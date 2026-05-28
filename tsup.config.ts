import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "rehau-modbus-2-mqtt/dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
});
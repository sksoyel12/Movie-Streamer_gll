import { existsSync } from "node:fs";
import { join } from "node:path";

const requiredPaths = [
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "artifacts/s-movie/package.json",
  "artifacts/api-server/package.json",
  "artifacts/smovie-download/package.json",
];

const missingPaths = requiredPaths.filter((path) => !existsSync(join(process.cwd(), path)));

if (missingPaths.length > 0) {
  console.error(`Missing imported-project files:\n- ${missingPaths.join("\n- ")}`);
  process.exit(1);
}

const mobilePackage = await import("../artifacts/s-movie/package.json", {
  with: { type: "json" },
});
const hasGeminiMapping = mobilePackage.default.scripts?.dev?.includes(
  "EXPO_PUBLIC_GEMINI_API_KEY",
);

const hasGeminiSecret = Boolean(process.env.GEMINI_API_KEY);
console.log(`Imported S-Movie workspace: ready`);
console.log(`Expo Gemini wiring: ${hasGeminiMapping ? "present" : "missing"}`);
console.log(`Gemini AI secret: ${hasGeminiSecret ? "configured" : "not configured (AI features will be disabled)"}`);

if (!hasGeminiMapping) {
  process.exit(1);
}
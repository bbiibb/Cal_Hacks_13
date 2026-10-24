import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/convex/_generated/**",
      "apps/frontend/**", // Frontend owner's area: the frontend has its own lint setup
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/convex/_generated/**",
      "apps/frontend/**", // 프론트 담당자 영역: 프론트 쪽 lint 설정을 따로 둔다
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);

import reactHooks from "eslint-plugin-react-hooks";
import base from "../../eslint.config.base.mjs";

export default [
  ...base,
  { ignores: ["targets/**", "modules/echo-shared/ios/**", ".expo/**", "expo-env.d.ts", "metro.config.js"] },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

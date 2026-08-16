/** @type {import('tailwindcss').Config} */
import preset from "@brim/ui-kit/tailwind-preset";

export default {
  presets: [preset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui-kit/src/**/*.{ts,tsx}"],
  darkMode: "class",
};

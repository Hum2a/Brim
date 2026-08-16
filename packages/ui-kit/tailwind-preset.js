/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  theme: {
    extend: {
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
      },
      colors: {
        forecourt: "#14171A",
        pump: "#F2F0EB",
        gauge: "#E8B33C",
        diesel: "#1F6F63",
        warning: "#C4472F",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        destructive: "hsl(var(--destructive))",
      },
      fontFamily: {
        display: ['"Archivo Expanded"', "Archivo", "sans-serif"],
        body: ['"Inter Tight"', "system-ui", "sans-serif"],
        data: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [
    ({ addUtilities }) => {
      addUtilities({
        ".tabular": { fontVariantNumeric: "tabular-nums", fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
      });
    },
  ],
};

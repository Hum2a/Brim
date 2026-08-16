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
        night: "#0B1220",
        mist: "#8BA3C7",
        glow: "#E8B33C",
        glass: {
          DEFAULT: "rgba(20,23,26,0.55)",
          border: "rgba(242,240,235,0.14)",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        display: ['"Archivo Expanded"', "Archivo", "sans-serif"],
        body: ['"Inter Tight"', "system-ui", "sans-serif"],
        data: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 24px 80px rgba(0,0,0,.45)",
        glow: "0 0 40px rgba(232,179,60,.35)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    ({ addUtilities }) => {
      addUtilities({
        ".tabular": {
          fontVariantNumeric: "tabular-nums",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        },
      });
    },
  ],
};

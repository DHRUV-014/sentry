/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // The theme is always resolved onto <html data-theme> (src/lib/theme.ts), so dark: follows the toggle.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // Type scale: 13 / 15 / 16 (body) / 18 / 22 / 28 / 36 / 48.
    fontSize: {
      xs: ["13px", { lineHeight: "1.5" }],
      sm: ["15px", { lineHeight: "1.55" }],
      base: ["16px", { lineHeight: "1.6" }],
      lg: ["18px", { lineHeight: "1.55" }],
      xl: ["22px", { lineHeight: "1.4" }],
      "2xl": ["28px", { lineHeight: "1.25" }],
      "3xl": ["36px", { lineHeight: "1.15" }],
      "4xl": ["48px", { lineHeight: "1.06" }],
    },
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
      },
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        subtle: token("subtle"),
        line: token("line"),
        ink: { DEFAULT: token("ink"), 2: token("ink-2") },
        muted: token("muted"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          pressed: token("accent-pressed"),
          tint: token("accent-tint"),
          ink: token("accent-ink"),
        },
        danger: { text: token("danger-text") },
        risk: {
          low: { DEFAULT: token("risk-low"), tint: token("risk-low-tint") },
          medium: { DEFAULT: token("risk-medium"), tint: token("risk-medium-tint") },
          high: { DEFAULT: token("risk-high"), tint: token("risk-high-tint") },
          critical: { DEFAULT: token("risk-critical"), tint: token("risk-critical-tint") },
        },
      },
      borderRadius: {
        control: "10px",
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.04), 0 8px 24px rgb(var(--shadow) / 0.06)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.05), 0 16px 40px rgb(var(--shadow) / 0.10)",
      },
      maxWidth: {
        content: "1120px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

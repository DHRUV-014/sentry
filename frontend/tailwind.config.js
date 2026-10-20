/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        subtle: token("subtle"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        accent: { DEFAULT: token("accent"), hover: token("accent-hover"), ink: token("accent-ink") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        info: { soft: token("info-soft") },
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px rgb(var(--shadow) / 0.08)",
      },
    },
  },
  plugins: [],
};

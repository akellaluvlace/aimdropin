import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F5F1EA",
        ink: "#0F0F0F",
        coral: "#FF4D2E",
        muted: "#8C847A",
        soft: "#EDE6D9",
        card: "#FFFFFF",
        // Highlighter yellow: stickers, "new"/"soon" badges, text marks.
        sun: "#FFD23F",
      },
      boxShadow: {
        // Hard offset shadows: the neo-brutalist depth cue.
        "brut-sm": "2px 2px 0 0 #0F0F0F",
        brut: "4px 4px 0 0 #0F0F0F",
        "brut-lg": "8px 8px 0 0 #0F0F0F",
        "brut-coral": "6px 6px 0 0 #FF4D2E",
      },
      transitionTimingFunction: {
        // UI feedback (250-500ms) and reveals; nothing bounces.
        snap: "cubic-bezier(0.32, 0.72, 0, 1)",
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-instrument)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": [
          "clamp(3rem, 8vw, 7rem)",
          { lineHeight: "0.95", letterSpacing: "-0.03em" },
        ],
        "display-lg": [
          "clamp(2.25rem, 5vw, 4rem)",
          { lineHeight: "1", letterSpacing: "-0.025em" },
        ],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0D0C", // deep base
        panel: "#0F1413", // raised surface
        panel2: "#141A18", // secondary surface
        hair: "#1E2A26", // hairline borders
        fog: "#8A968F", // muted text
        bone: "#E9EFEA", // primary text
        signal: "#B8FF3C", // PLIMSOLL lime — live/active accent
        trend: "#5DD39E", // regime: trending
        chop: "#E8B84B", // regime: chopping
        risk: "#E8635D", // regime: risk_off / danger
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(184,255,60,0.20), 0 0 24px -6px rgba(184,255,60,0.25)",
      },
      keyframes: {
        pulse2: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.82)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        pulse2: "pulse2 1.6s ease-in-out infinite",
        scan: "scan 7s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

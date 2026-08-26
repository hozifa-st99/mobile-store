import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0a0b1e",
          secondary: "#0d0f24",
          card: "#121432",
          "card-hover": "#161b2c",
          input: "#0f1128",
          sidebar: "#0b0d20",
        },
        primary: {
          DEFAULT: "#7c3aed",
          light: "#8b5cf6",
          dark: "#6d28d9",
          glow: "rgba(124, 58, 237, 0.45)",
        },
        accent: {
          green: "#10b981",
          blue: "#3b82f6",
          cyan: "#06b6d4",
          orange: "#f59e0b",
          pink: "#ec4899",
          yellow: "#eab308",
        },
        muted: {
          DEFAULT: "#b8c5d6",
          dark: "#8fa3b8",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.06)",
          light: "rgba(255, 255, 255, 0.1)",
        },
      },
      fontFamily: {
        sans: ["var(--font-tajawal)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        glow: "0 0 24px rgba(124, 58, 237, 0.35)",
        "glow-sm": "0 0 12px rgba(124, 58, 237, 0.25)",
        card: "0 4px 32px rgba(0, 0, 0, 0.5)",
        "card-hover": "0 8px 40px rgba(124, 58, 237, 0.12)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)",
        "gradient-primary-h": "linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)",
        "gradient-pro": "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(37,117,252,0.15) 100%)",
        "gradient-sidebar-active": "linear-gradient(90deg, rgba(124, 58, 237, 0.35) 0%, rgba(124, 58, 237, 0.08) 100%)",
        "gradient-login": "radial-gradient(ellipse at 20% 50%, rgba(124, 58, 237, 0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(91, 33, 182, 0.12) 0%, transparent 50%), #0a0b1e",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(124, 58, 237, 0.3)" },
          "50%": { boxShadow: "0 0 36px rgba(124, 58, 237, 0.55)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

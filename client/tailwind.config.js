/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0b1727",
        mist: "#eef4ff",
        brand: {
          50: "#eff8ff",
          100: "#d9edff",
          200: "#bce2ff",
          300: "#8fd2ff",
          400: "#59b6ff",
          500: "#2796f3",
          600: "#1178d4",
          700: "#0d61ac",
          800: "#104f8b",
          900: "#144270",
        },
        accent: {
          coral: "#ff7a59",
          gold: "#f5b942",
          mint: "#33c3a5",
          berry: "#c5528c",
        },
      },
      boxShadow: {
        panel: "0 24px 48px rgba(11, 23, 39, 0.08)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at top left, rgba(39,150,243,0.18), transparent 32%), radial-gradient(circle at top right, rgba(255,122,89,0.15), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #edf3fb 100%)",
      },
    },
  },
  plugins: [],
};

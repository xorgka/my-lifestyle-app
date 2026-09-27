/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard Variable", "system-ui", "sans-serif"],
      },
      colors: {
        "soft-bg": "#F5F5F7",
        "soft-border": "#E5E5EA",
      },
      borderRadius: {
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};


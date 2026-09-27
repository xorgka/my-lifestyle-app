/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        // 폴드 가로 등 중간 폭: 사이드바를 좁히고 PC 배치를 쓰는 구간
        fold: { raw: "(min-width: 768px) and (max-width: 1279px)" },
      },
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


/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0c0c0e', // near-black backgrounds
        charcoal: '#17171c',
        ivory: '#f6f2ea', // warm off-white page background
        cream: '#efe8da',
        gold: {
          DEFAULT: '#c2a063', // brass accent
          light: '#d8bd86',
          dark: '#9c7f4a',
        },
        stone: '#8c877d', // muted secondary text
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        luxe: '0.28em',
        wide2: '0.18em',
      },
      maxWidth: {
        '8xl': '88rem',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.7s ease-out both',
        fadeIn: 'fadeIn 0.8s ease-out both',
        marquee: 'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
};

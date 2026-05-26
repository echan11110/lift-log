/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0a0a0a',
        card:    '#141414',
        cardHov: '#1a1a1a',
        border:  '#242424',
        accent:  '#f97316',
        accentHov: '#ea6c0a',
        success: '#22c55e',
        pr:      '#f59e0b',
      },
      fontFamily: {
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0)' }, '50%': { boxShadow: '0 0 16px 4px rgba(249,115,22,0.25)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      '#030303',
        panel:   '#080808',
        border:  '#1a1a1a',
        green:   '#00ff88',
        red:     '#ff0055',
        blue:    '#00c8ff',
        muted:   '#555555',
        dim:     '#333333',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono:     ['Share Tech Mono', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 16px rgba(0,255,136,0.3)',
        'glow-red':   '0 0 16px rgba(255,0,85,0.3)',
        'glow-blue':  '0 0 16px rgba(0,200,255,0.3)',
        'card':       '0 0 0 1px #1a1a1a',
      },
      animation: {
        'pulse-fast': 'pulse 0.8s ease-in-out infinite',
        'fade-up':    'fadeSlideUp 0.4s ease forwards',
      },
    },
  },
  plugins: [],
};
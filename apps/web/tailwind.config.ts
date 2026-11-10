import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nuit: '#172320',
        brume: '#F6F4EE',
        encre: '#202A27',
        seve: '#26735B',
        safran: '#F2B84B',
        wax: '#B84C43',
      },
      borderRadius: {
        card: '1.25rem',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

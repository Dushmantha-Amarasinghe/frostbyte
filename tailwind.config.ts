import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral graphite base — "light blacks", no color cast
        ink: '#0B0B0C',
        ink2: '#0F0F11',
        panel: '#151517',
        panel2: '#1C1C1F',
        line: 'rgba(255,255,255,0.07)',
        lineBright: 'rgba(255,255,255,0.16)',
        // Monochrome accent scale (named "frost" for legacy class compatibility)
        frost: '#F4F4F5', // near-white — active/accent
        frostDeep: '#B6B6BC', // mid-light grey — gradient pair
        frostDim: '#74747A', // grey — quiet labels
        text: '#F4F4F5',
        textDim: '#9A9AA1',
        textFaint: '#5E5E64',
        danger: '#E08368',
        dangerBg: '#1E1614'
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif'],
        display: ["'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif'],
        mono: ["'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif']
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter: '-0.02em'
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '26px'
      },
      boxShadow: {
        frost: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 10px 30px -12px rgba(0,0,0,0.8)',
        lift: '0 18px 50px -12px rgba(0,0,0,0.75)'
      },
      keyframes: {
        shimmer: { '0%': { transform: 'translateX(-120%)' }, '100%': { transform: 'translateX(220%)' } },
        breathe: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '0.85' } },
        floatY: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } }
      },
      animation: {
        shimmer: 'shimmer 2.4s ease-in-out infinite',
        breathe: 'breathe 3.5s ease-in-out infinite',
        floatY: 'floatY 5s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config

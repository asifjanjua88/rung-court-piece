/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        felt:    { DEFAULT: '#1a5c38', light: '#226b44', dark: '#0f3d24' },
        card:    { DEFAULT: '#ffffff', back: '#1e3a8a' },
        gold:    { DEFAULT: '#f59e0b', light: '#fcd34d' },
        trump:   { DEFAULT: '#dc2626', light: '#fca5a5' },
      },
      fontFamily: {
        game: ['Georgia', 'serif'],
      },
      boxShadow: {
        card:           '0 2px 8px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
        'card-hover':   '0 8px 20px rgba(0,0,0,0.4)',
        'card-selected':'0 0 0 3px #f59e0b, 0 8px 20px rgba(0,0,0,0.4)',
      },
      animation: {
        'deal-in':      'dealIn 0.3s ease-out',
        'flip':         'flip 0.4s ease-in-out',
        'pulse-gold':   'pulseGold 1.5s infinite',
        'slide-up':     'slideUp 0.25s ease-out',
        'bounce-in':    'bounceIn 0.4s cubic-bezier(0.36,0.07,0.19,0.97)',
        // Card play fly-in from each seat direction
        'fly-south':    'flySouth 0.55s cubic-bezier(0.16,1,0.3,1) both',
        'fly-north':    'flyNorth 0.55s cubic-bezier(0.16,1,0.3,1) both',
        'fly-east':     'flyEast  0.55s cubic-bezier(0.16,1,0.3,1) both',
        'fly-west':     'flyWest  0.55s cubic-bezier(0.16,1,0.3,1) both',
        // Toss
        'deal-facedown':'dealFaceDown 0.35s ease-out both',
        'card-flip':    'cardFlip 0.45s ease-in-out both',
        'winner-glow':  'winnerGlow 0.5s ease-out both',
        // Hidden rung pulse
        'hidden-rung':  'hiddenRung 2s ease-in-out infinite',
      },
      keyframes: {
        dealIn:       { from: { opacity: '0', transform: 'translateY(-20px) scale(0.9)' },  to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        flip:         { '0%': { transform: 'rotateY(0)' }, '50%': { transform: 'rotateY(90deg)' }, '100%': { transform: 'rotateY(0)' } },
        pulseGold:    { '0%,100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(245,158,11,0)' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(16px)' },             to: { opacity: '1', transform: 'translateY(0)' } },
        bounceIn:     { '0%': { transform: 'scale(0.8)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        // Fly from each direction (card starts far and slides to center)
        flySouth:     { '0%': { opacity: '0', transform: 'translateY(160px) scale(1.25) rotate(-3deg)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1) rotate(0deg)' } },
        flyNorth:     { '0%': { opacity: '0', transform: 'translateY(-160px) scale(1.25) rotate(3deg)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1) rotate(0deg)' } },
        flyEast:      { '0%': { opacity: '0', transform: 'translateX(160px) scale(1.25) rotate(3deg)' },  '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0deg)' } },
        flyWest:      { '0%': { opacity: '0', transform: 'translateX(-160px) scale(1.25) rotate(-3deg)' },'100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0deg)' } },
        // Toss animations
        dealFaceDown: { '0%': { opacity: '0', transform: 'translateY(-40px) scale(0.7)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        cardFlip:     { '0%': { transform: 'rotateY(0deg)' }, '50%': { transform: 'rotateY(90deg)' }, '100%': { transform: 'rotateY(0deg)' } },
        winnerGlow:   { '0%': { boxShadow: '0 0 0 0 rgba(245,158,11,0)' }, '100%': { boxShadow: '0 0 0 12px rgba(245,158,11,0.6)' } },
        // Hidden rung breathe
        hiddenRung:   { '0%,100%': { boxShadow: '0 0 8px 2px rgba(96,165,250,0.4)' }, '50%': { boxShadow: '0 0 20px 6px rgba(96,165,250,0.7)' } },
      },
    },
  },
  plugins: [],
}

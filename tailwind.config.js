module.exports = {
  theme: {
    extend: {
      keyframes: {
        openClose: {
          '0%': { transform: 'scaleX(0)', opacity: '0.4' },
          '50%': { transform: 'scaleX(1)', opacity: '1' },
          '100%': { transform: 'scaleX(0)', opacity: '0.4' },
        },
      },
      animation: {
        openClose: 'openClose 1.2s ease-in-out infinite',
      },
    },
  },
}
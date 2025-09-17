module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#7c3aed', // 밝은 보라색
          DEFAULT: '#6d28d9', // 보라색
          dark: '#5b21b6', // 진한 보라색
        },
        secondary: {
          light: '#ec4899', // 밝은 핑크
          DEFAULT: '#db2777', // 핑크
          dark: '#be185d', // 진한 핑크
        },
        accent: {
          light: '#10b981', // 밝은 에메랄드
          DEFAULT: '#059669', // 에메랄드
          dark: '#047857', // 진한 에메랄드
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      fontSize: {
        'display-1': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-2': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'heading-1': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'heading-2': ['2rem', { lineHeight: '1.25', fontWeight: '700' }],
        'heading-3': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'subtitle-1': ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }],
        'subtitle-2': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body-1': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-2': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      fontFamily: {
        sans: ['Pretendard', 'Noto Sans KR', 'sans-serif'],
        title: ['GmarketSans', 'sans-serif'],
        display: ['Montserrat', 'GmarketSans', 'sans-serif'],
        logo: ['PartialSansKR-Regular', 'GmarketSans', 'sans-serif'],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* IE and Edge */
          '-ms-overflow-style': 'none',
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        },
        '.line-clamp-2': {
          'overflow': 'hidden',
          'display': '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '2',
        },
        '.line-clamp-3': {
          'overflow': 'hidden',
          'display': '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3',
        }
      })
    }
  ],
}
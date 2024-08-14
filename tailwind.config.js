module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#C53030', // 밝은 짙은 빨간색
          DEFAULT: '#9B2C2C', // 중간 짙은 빨간색
          dark: '#742A2A', // 매우 짙은 빨간색
        },
        secondary: {
          light: '#ECC94B', // 밝은 노란색
          DEFAULT: '#D69E2E', // 중간 짙은 노란색
          dark: '#B7791F', // 매우 짙은 노란색
        },
        accent: '#DD6B20', // 짙은 주황색 (강조용)
        background: {
          light: '#FFFBEB', // 매우 연한 노란 크림색 (라이트 모드)
          dark: '#1A202C', // 매우 진한 남색 (다크 모드)
        },
        text: {
          light: '#2D3748', // 진한 남색 (라이트 모드)
          dark: '#F7FAFC', // 매우 연한 회색 (다크 모드)
        },
      },
      gradientColorStops: {
        'deep-autumn': ['#742A2A', '#9B2C2C', '#D69E2E'],
        'rich-harvest': ['#C53030', '#DD6B20', '#ECC94B'],
      },
      fontFamily: {
        title: ['HS-Regular', 'sans-serif'],
        body: ['NanumSquareNeo', 'sans-serif'],
        light: ['NanumSquareNeoLight', 'sans-serif'],
        bold: ['NanumSquareNeoBold', 'sans-serif'],
        extrabold: ['NanumSquareNeoExtraBold', 'sans-serif'],
        heavy: ['NanumSquareNeoHeavy', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
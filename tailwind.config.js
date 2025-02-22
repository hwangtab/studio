module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#4A90E2',  // 밝은 청색 - 신뢰감과 전문성
          DEFAULT: '#2C5282', // 중간 청색 - 안정감
          dark: '#1A365D',   // 진한 청색 - 깊이감
        },
        secondary: {
          light: '#9F7AEA',  // 밝은 보라색 - 창의성
          DEFAULT: '#6B46C1', // 중간 보라색 - 예술성
          dark: '#44337A',   // 진한 보라색 - 고급스러움
        },
        accent: '#F6AD55',   // 따뜻한 오렌지색 - 친근함과 활력
        background: {
          light: '#F7FAFC',  // 매우 연한 청색 - 깨끗함
          dark: '#1A202C',   // 진한 남색 - 집중감
        },
        text: {
          light: '#2D3748',  // 진한 남색 - 가독성
          dark: '#E2E8F0',   // 연한 회색 - 부드러움
        },
      },
      gradientColorStops: {
        'studio': ['#1A365D', '#2C5282', '#4A90E2'],
        'creative': ['#44337A', '#6B46C1', '#9F7AEA'],
        'warm': ['#2C5282', '#6B46C1', '#F6AD55'],
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
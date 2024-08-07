module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#FF6B6B',
          DEFAULT: '#FF3E3E',
          dark: '#FF0000',
        },
        secondary: {
          light: '#4ECDC4',
          DEFAULT: '#45B7AC',
          dark: '#3CA399',
        },
        accent: {
          light: '#45B7D1',
          DEFAULT: '#3CA3BD',
          dark: '#3690A9',
        },
        background: '#F7F7F7',
        text: '#333333',
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
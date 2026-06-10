const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/lib/lucide-icons$': '<rootDir>/test/mocks/lucide-icons.js',
    '^lucide-react/dist/esm/icons/.+\\.js$': '<rootDir>/test/mocks/lucide-icon.js',
    '^@vercel/analytics/react$': '<rootDir>/test/mocks/vercel-analytics.js',
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      lines: 18,
      branches: 11,
      functions: 15,
    },
  },
};

module.exports = createJestConfig(customJestConfig);

const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  /**
   * 작업용 git worktree를 테스트 대상에서 뺀다.
   *
   * .claude/worktrees/ 아래에 브랜치별 사본이 생기는데, jest는 rootDir 전체를 훑으므로
   * 그 사본의 테스트까지 함께 돌린다. 사본은 마이그레이션이 안 돌았거나 작업 중간이라
   * 실패하기 마련이고, 그 실패가 본 프로젝트 결과에 섞여 "무엇이 진짜 깨진 것인지"를
   * 가린다(실제로 no such table 실패 2건이 그렇게 잡혔다).
   *
   * next/jest의 기본값은 ['/node_modules/', '/.next/']다. 여기서 지정하면 그것을 대체하므로
   * 함께 적어 둔다 — 빠뜨리면 node_modules 안의 테스트까지 훑는다.
   *
   * modulePathIgnorePatterns도 함께 둔다. 워크트리에 node_modules가 딸려 오면 같은 이름의
   * package.json이 둘이 되어 haste map 충돌 경고가 뜬다.
   */
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
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

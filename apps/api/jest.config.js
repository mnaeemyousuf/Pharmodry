/** Jest projects: fast unit tests (src/**\/*.spec.ts) and end-to-end API tests on real PostgreSQL. */
const tsJest = ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }];
module.exports = {
  testTimeout: 120000,
  // E2E suites share one seeded database; run test files serially so assertions never race each other.
  maxWorkers: 1,
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: { '^.+\.ts$': tsJest },
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      transform: { '^.+\.ts$': tsJest },
      globalSetup: '<rootDir>/test/global-setup.ts',
      globalTeardown: '<rootDir>/test/global-teardown.ts',
      setupFiles: ['<rootDir>/test/env.ts'],
    },
  ],
};

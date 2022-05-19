export default {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', 'dist', 'web'],
  testPathIgnorePatterns: ['/node_modules/', 'dist', 'web'],
  globals: {
    'ts-jest': {
      tsconfig: {
        sourceMap: true
      }
    }
  },
  preset: 'ts-jest',
  resetMocks: false,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jsdomFixups.ts']
}

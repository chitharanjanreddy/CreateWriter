module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleNameMapper: {
    '^../config/config$': '<rootDir>/__tests__/helpers/__mocks__/config.js',
    '^../../config/config$': '<rootDir>/__tests__/helpers/__mocks__/config.js',
    '^../../../config/config$': '<rootDir>/__tests__/helpers/__mocks__/config.js',
    '^../../../../config/config$': '<rootDir>/__tests__/helpers/__mocks__/config.js',
    '^.*/config/config$': '<rootDir>/__tests__/helpers/__mocks__/config.js'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/database.js',
    '!src/utils/seed.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};

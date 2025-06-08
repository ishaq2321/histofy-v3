const fs = require('fs');
const path = require('path');

// Create test directory
const testDir = path.join(__dirname, 'tests');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

console.log('Creating test files...');

// Basic test setup
const jestConfig = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};

fs.writeFileSync(path.join(__dirname, 'jest.config.js'), 
  `module.exports = ${JSON.stringify(jestConfig, null, 2)};`
);

console.log('Test configuration created');

module.exports = {
  "testEnvironment": "node",
  "testMatch": [
    "**/tests/**/*.test.js"
  ],
  "collectCoverageFrom": [
    "src/**/*.js",
    "!src/index.js"
  ],
  "coverageDirectory": "coverage",
  "verbose": true
};
module.exports = {
  // The test environment that will be used for testing
  testEnvironment: 'node',

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // An array of regexp pattern strings that are matched against all test paths
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // An array of regexp pattern strings that are matched against all source file paths
  transformIgnorePatterns: [
    '/node_modules/',
    '\\.pnp\\.[^\\/]+$'
  ],

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/config/',
    '/coverage/',
    'jest.config.js',
    '.eslintrc.js'
  ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: [
    'json',
    'text',
    'lcov',
    'clover',
    'html'
  ],

  // An object that configures minimum threshold enforcement for coverage results
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // A path to a module which exports an async function that is triggered once before all test suites
  globalSetup: './tests/setup.js',

  // A path to a module which exports an async function that is triggered once after all test suites
  globalTeardown: './tests/teardown.js',

  // A set of global variables that need to be available in all test environments
  globals: {
    'NODE_ENV': 'test'
  },

  // The maximum amount of workers used to run your tests
  maxWorkers: '50%',

  // An array of directory names to be searched recursively up from the requiring module's location
  moduleDirectories: [
    'node_modules',
    '<rootDir>/src'
  ],

  // A map from regular expressions to module names or to arrays of module names
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Activates notifications for test results
  notify: false,

  // An enum that specifies notification mode
  notifyMode: 'failure-change',

  // Run tests with specified reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports/junit',
        outputName: 'jest-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Automatically reset mock state between every test
  resetMocks: false,

  // Reset the module registry before running each individual test
  resetModules: false,

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: ['./tests/setupTests.js'],

  // The number of seconds after which a test is considered as slow and reported as such in the results
  slowTestThreshold: 5,

  // A list of paths to snapshot serializer modules Jest should use for snapshot testing
  snapshotSerializers: [],

  // Options that will be passed to the testEnvironment
  testEnvironmentOptions: {},

  // Adds a location field to test results
  testLocationInResults: false,

  // The regexp pattern or array of patterns that Jest uses to detect test files
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.js$',

  // This option allows the use of a custom results processor
  testResultsProcessor: null,

  // This option allows use of a custom test runner
  testRunner: 'jest-circus/runner',

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // Whether to use watchman for file crawling
  watchman: true
};

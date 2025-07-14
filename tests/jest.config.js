/**
 * Jest Configuration for Agentic RevOps Testing
 * Comprehensive testing setup with coverage, performance, and security validation
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Root and source directories
  rootDir: '../',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/types/*.ts',
    '!src/**/demo/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Critical components need higher coverage
    './src/swarm/queen/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/swarm/consensus/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/testSetup.ts',
    '<rootDir>/tests/setup/mockSetup.ts'
  ],
  testTimeout: 30000,
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Agentic RevOps Test Results',
      outputPath: '<rootDir>/test-results/test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true
    }]
  ],
  
  // Performance testing
  testResultsProcessor: '<rootDir>/tests/performance/performanceProcessor.js',
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          sourceMap: true,
          declaration: false
        }
      }
    }]
  },
  
  // Global variables for testing
  globals: {
    'ts-jest': {
      isolatedModules: true
    },
    TEST_CONFIG: {
      enableSlowTests: process.env.CI === 'true',
      enableSecurityTests: true,
      enablePerformanceTests: true,
      mockExternalServices: true
    }
  },
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost',
    userAgent: 'AgenticRevOps-Test-Agent'
  }
};
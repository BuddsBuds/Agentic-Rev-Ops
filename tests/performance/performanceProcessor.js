/**
 * Jest performance processor
 * Processes test results and generates performance metrics
 */

const fs = require('fs');
const path = require('path');

module.exports = (testResults) => {
  const performanceData = {
    timestamp: new Date().toISOString(),
    totalTests: testResults.numTotalTests,
    passedTests: testResults.numPassedTests,
    failedTests: testResults.numFailedTests,
    totalDuration: testResults.testResults.reduce(
      (sum, result) => sum + result.perfStats.runtime,
      0
    ),
    testSuites: [],
  };

  // Process each test suite
  testResults.testResults.forEach((suiteResult) => {
    const suite = {
      name: path.basename(suiteResult.testFilePath),
      path: suiteResult.testFilePath,
      duration: suiteResult.perfStats.runtime,
      startTime: suiteResult.perfStats.start,
      endTime: suiteResult.perfStats.end,
      tests: [],
    };

    // Process individual tests
    suiteResult.testResults.forEach((test) => {
      suite.tests.push({
        title: test.title,
        fullName: test.fullName,
        status: test.status,
        duration: test.duration || 0,
        failureMessages: test.failureMessages,
      });
    });

    // Calculate suite metrics
    suite.metrics = {
      totalTests: suite.tests.length,
      passedTests: suite.tests.filter(t => t.status === 'passed').length,
      failedTests: suite.tests.filter(t => t.status === 'failed').length,
      averageTestDuration: 
        suite.tests.reduce((sum, t) => sum + (t.duration || 0), 0) / suite.tests.length,
      slowestTest: suite.tests.reduce(
        (slowest, test) => (test.duration > slowest.duration ? test : slowest),
        { duration: 0 }
      ),
    };

    performanceData.testSuites.push(suite);
  });

  // Generate summary statistics
  performanceData.summary = {
    averageSuiteDuration: 
      performanceData.totalDuration / performanceData.testSuites.length,
    slowestSuite: performanceData.testSuites.reduce(
      (slowest, suite) => (suite.duration > slowest.duration ? suite : slowest),
      { duration: 0 }
    ),
    testPassRate: 
      (performanceData.passedTests / performanceData.totalTests) * 100,
  };

  // Write performance report
  const reportPath = path.join(
    process.cwd(),
    'test-results',
    'performance-report.json'
  );

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(performanceData, null, 2));

  console.log('\n📊 Performance Report Generated:');
  console.log(`   Total Duration: ${(performanceData.totalDuration / 1000).toFixed(2)}s`);
  console.log(`   Test Pass Rate: ${performanceData.summary.testPassRate.toFixed(2)}%`);
  console.log(`   Slowest Suite: ${performanceData.summary.slowestSuite.name} (${(performanceData.summary.slowestSuite.duration / 1000).toFixed(2)}s)`);
  console.log(`   Report saved to: ${reportPath}\n`);

  return testResults;
};
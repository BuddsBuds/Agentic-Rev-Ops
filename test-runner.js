#!/usr/bin/env node
/**
 * Comprehensive Test Runner for Agentic RevOps
 * Tests all major components and captures errors
 */

const { AgenticRevOpsSystem } = require('./dist/index.js');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logEntry);
    this.results.push(logEntry);
  }

  async runTest(name, testFn) {
    this.log(`\n🧪 Testing: ${name}`);
    try {
      await testFn();
      this.log(`✅ ${name} - PASSED`, 'success');
    } catch (error) {
      this.log(`❌ ${name} - FAILED: ${error.message}`, 'error');
      this.errors.push({ test: name, error: error.message, stack: error.stack });
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Agentic RevOps System Testing\n', 'info');

    // Test 1: System Initialization
    await this.runTest('System Initialization', async () => {
      const system = new AgenticRevOpsSystem({
        swarm: {
          queenConfig: { name: 'Test Queen' },
          majorityConfig: { votingThreshold: 0.6 }
        }
      });
      await system.initialize();
      const status = system.getSystemStatus();
      if (!status.queen || !status.coordinator) {
        throw new Error('System initialization incomplete');
      }
    });

    // Test 2: Pipeline Optimization Request
    await this.runTest('Pipeline Optimization Request', async () => {
      const system = new AgenticRevOpsSystem();
      await system.initialize();
      
      const result = await system.processRequest({
        type: 'pipeline-optimization',
        description: 'Optimize sales pipeline for Q4',
        context: { quarter: 'Q4', revenue_target: 1000000 }
      });
      
      if (!result || !result.decision) {
        throw new Error('No decision returned from pipeline optimization');
      }
    });

    // Test 3: Lead Qualification
    await this.runTest('Lead Qualification Request', async () => {
      const system = new AgenticRevOpsSystem();
      await system.initialize();
      
      const result = await system.processRequest({
        type: 'lead-qualification',
        description: 'Qualify batch of 50 new leads',
        context: { lead_count: 50, source: 'webinar' }
      });
      
      if (!result) {
        throw new Error('Lead qualification failed');
      }
    });

    // Test 4: Revenue Forecasting
    await this.runTest('Revenue Forecasting', async () => {
      const system = new AgenticRevOpsSystem();
      await system.initialize();
      
      const result = await system.processRequest({
        type: 'revenue-forecasting',
        description: 'Forecast Q1 revenue based on current pipeline',
        context: { pipeline_value: 5000000, close_rate: 0.25 }
      });
      
      if (!result) {
        throw new Error('Revenue forecasting failed');
      }
    });

    // Test 5: System Status Check
    await this.runTest('System Status Check', async () => {
      const system = new AgenticRevOpsSystem();
      await system.initialize();
      
      const status = system.getSystemStatus();
      const requiredComponents = ['queen', 'coordinator', 'memory', 'visualizer'];
      
      for (const component of requiredComponents) {
        if (!status[component]) {
          throw new Error(`Missing component in status: ${component}`);
        }
      }
    });

    // Test 6: Graceful Shutdown
    await this.runTest('Graceful Shutdown', async () => {
      const system = new AgenticRevOpsSystem();
      await system.initialize();
      await system.shutdown();
      // If we get here without errors, shutdown was successful
    });

    // Generate report
    this.generateReport();
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.filter(r => r.includes('Testing:')).length,
        passed: this.results.filter(r => r.includes('PASSED')).length,
        failed: this.errors.length
      },
      errors: this.errors,
      fullLog: this.results
    };

    fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
    
    console.log('\n📊 Test Summary:');
    console.log(`   Total Tests: ${report.summary.total}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.errors.forEach(error => {
        console.log(`   - ${error.test}: ${error.error}`);
      });
    }
  }
}

// Run tests
async function main() {
  const runner = new TestRunner();
  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

main();
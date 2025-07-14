# Agentic RevOps Testing Framework

Comprehensive testing framework for the Agentic RevOps system, including unit tests, integration tests, end-to-end tests, and performance benchmarks.

## 🏗️ Test Structure

```
tests/
├── unit/               # Unit tests for individual components
│   ├── swarm/         # Swarm component tests
│   ├── database/      # Database layer tests
│   └── hitl/          # HITL system tests
├── integration/        # Integration tests
│   ├── swarm/         # Swarm integration tests
│   └── database/      # Database integration tests
├── e2e/               # End-to-end workflow tests
├── performance/       # Performance benchmarks
├── mocks/             # Mock services and utilities
├── utils/             # Testing utilities
└── setup/             # Test setup and configuration
```

## 🚀 Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Performance Tests
```bash
npm run test:performance
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### CI Mode
```bash
npm run test:ci
```

## 📊 Coverage Requirements

- **Global Coverage**: 85% minimum
- **Critical Components** (Queen, Consensus): 95% minimum
- **New Code**: Must include tests

## 🧪 Test Categories

### Unit Tests
Test individual components in isolation:
- Agent behavior
- Database operations
- HITL processes
- Utility functions

### Integration Tests
Test component interactions:
- Database with repositories
- Swarm with agents
- HITL with workflow engine

### End-to-End Tests
Test complete workflows:
- Revenue analysis pipeline
- CRM synchronization
- Human approval workflows
- Multi-agent decisions

### Performance Tests
Measure system performance:
- Decision latency
- Throughput under load
- Memory usage
- Scalability limits

## 🛠️ Testing Utilities

### TestDatabaseHelper
Manages test database setup:
```typescript
const testHelper = new TestDatabaseHelper();
await testHelper.setupTestDatabase();
await testHelper.seedBasicData();
// ... run tests
await testHelper.teardownTestDatabase();
```

### TestSwarmHelper
Helps test swarm functionality:
```typescript
const swarmHelper = new TestSwarmHelper();
const agents = swarmHelper.createTestSwarm(5);
swarmHelper.simulateAgentFailure('agent-1');
await swarmHelper.waitForCondition(() => condition);
```

### MockAPIServer
Mocks external API endpoints:
```typescript
const mockServer = new MockAPIServer();
await mockServer.start(3001);
mockServer.addEndpoint('/api/data', {
  method: 'GET',
  response: { data: 'test' }
});
// ... run tests
await mockServer.stop();
```

### PerformanceProfiler
Measures operation performance:
```typescript
const profiler = new PerformanceProfiler();
profiler.start('operation');
// ... perform operation
const metrics = profiler.stop('operation');
console.log(`Duration: ${metrics.duration}ms`);
```

### MemoryMonitor
Tracks memory usage:
```typescript
const monitor = new MemoryMonitor();
monitor.startTracking('test-operation');
// ... perform operation
const metrics = monitor.stopTracking('test-operation');
console.log(`Memory delta: ${metrics.delta} bytes`);
```

## 📝 Writing Tests

### Unit Test Example
```typescript
describe('QueenAgent', () => {
  let queen: QueenAgent;
  
  beforeEach(() => {
    queen = new QueenAgent('test-queen');
  });
  
  it('should make decisions based on consensus', async () => {
    const decision = await queen.makeDecision({
      type: 'test',
      votes: [
        { agentId: 'a1', vote: 'yes', confidence: 0.9 },
        { agentId: 'a2', vote: 'yes', confidence: 0.8 }
      ]
    });
    
    expect(decision.result).toBe('yes');
    expect(decision.confidence).toBeGreaterThan(0.8);
  });
});
```

### Integration Test Example
```typescript
describe('Database Integration', () => {
  let dbService: DatabaseService;
  let testHelper: TestDatabaseHelper;
  
  beforeAll(async () => {
    testHelper = new TestDatabaseHelper();
    await testHelper.setupTestDatabase();
    
    dbService = new DatabaseService();
    await dbService.initialize();
  });
  
  afterAll(async () => {
    await testHelper.teardownTestDatabase();
  });
  
  it('should handle transactions correctly', async () => {
    await dbService.transaction(async (tx) => {
      const org = await tx.organizations.create({...});
      const swarm = await tx.swarmConfigurations.create({...});
      return { org, swarm };
    });
  });
});
```

### Performance Test Example
```typescript
describe('Performance', () => {
  it('should process decisions quickly', async () => {
    const profiler = new PerformanceProfiler();
    
    profiler.start('decision-batch');
    const promises = Array(100).fill(null).map(() => 
      swarm.processDecision({ type: 'perf-test' })
    );
    await Promise.all(promises);
    const metrics = profiler.stop('decision-batch');
    
    expect(metrics.duration).toBeLessThan(5000); // 5s for 100 decisions
  });
});
```

## 🔍 Debugging Tests

### Enable Verbose Logging
```bash
DEBUG=* npm test
```

### Run Single Test File
```bash
npm test -- tests/unit/swarm/QueenAgent.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should handle consensus"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## 📈 Performance Benchmarks

### Current Targets
- **Decision Latency**: < 100ms average
- **Throughput**: > 100 decisions/second
- **Memory**: < 100MB for 1000 concurrent operations
- **Database Writes**: > 100 records/second
- **Workflow Execution**: < 2s per workflow

### Running Benchmarks
```bash
npm run test:performance
```

Results are saved to `test-results/performance-report.json`

## 🤝 Contributing Tests

1. **Write tests for new features**: All new code must include tests
2. **Follow naming conventions**: `ComponentName.test.ts`
3. **Use descriptive test names**: "should [expected behavior] when [condition]"
4. **Clean up resources**: Always clean up in `afterEach`/`afterAll`
5. **Mock external dependencies**: Use mocks for external services
6. **Test edge cases**: Include error scenarios and boundary conditions

## 🚨 CI/CD Integration

Tests run automatically on:
- Pull request creation
- Commits to main branch
- Scheduled nightly runs

CI pipeline:
1. Linting
2. Type checking
3. Unit tests
4. Integration tests
5. E2E tests (staging environment)
6. Performance tests (nightly only)
7. Coverage report generation

## 📋 Test Maintenance

### Regular Tasks
- Review and update flaky tests
- Monitor test execution times
- Update mocks when APIs change
- Review coverage reports
- Archive old performance baselines

### Performance Regression Detection
Performance tests compare against baseline:
```bash
npm run test:performance -- --compare-baseline
```

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check test database permissions
   - Verify connection string in test environment

2. **Timeout Errors**
   - Increase Jest timeout: `jest.setTimeout(30000)`
   - Check for blocking operations
   - Verify async/await usage

3. **Memory Leaks in Tests**
   - Ensure proper cleanup in afterEach
   - Check for event listener removal
   - Use memory profiler to identify leaks

4. **Flaky Tests**
   - Add retry logic for network operations
   - Use proper wait conditions
   - Avoid time-dependent assertions

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Performance Testing Guide](https://docs.google.com/document/d/performance-guide)
- [Mock Service Patterns](https://martinfowler.com/articles/mocksArentStubs.html)
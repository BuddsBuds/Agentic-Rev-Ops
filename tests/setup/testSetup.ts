/**
 * Global Test Setup for Agentic RevOps
 * Configures test environment with comprehensive monitoring and validation
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// Test environment configuration
declare global {
  var testStartTime: number;
  var testMetrics: Map<string, any>;
  var mockEventBus: EventEmitter;
  var testCleanupTasks: Array<() => Promise<void>>;
}

// Initialize global test environment
beforeAll(async () => {
  console.log('🧪 Initializing Agentic RevOps Test Environment...');
  
  // Set up global test metrics
  global.testMetrics = new Map();
  global.testCleanupTasks = [];
  
  // Mock event bus for testing
  global.mockEventBus = new EventEmitter();
  global.mockEventBus.setMaxListeners(100);
  
  // Configure test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
  process.env.DISABLE_EXTERNAL_CALLS = 'true';
  
  // Increase event listener limits for complex testing
  EventEmitter.defaultMaxListeners = 50;
  
  // Set up memory leak detection
  const initialMemory = process.memoryUsage();
  global.testMetrics.set('initialMemory', initialMemory);
  
  console.log('✅ Test environment initialized');
});

// Clean up after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Execute cleanup tasks
  for (const cleanup of global.testCleanupTasks) {
    try {
      await cleanup();
    } catch (error) {
      console.warn('Cleanup task failed:', error);
    }
  }
  
  // Check for memory leaks
  const finalMemory = process.memoryUsage();
  const initialMemory = global.testMetrics.get('initialMemory');
  
  if (finalMemory.heapUsed > initialMemory.heapUsed * 2) {
    console.warn('⚠️ Potential memory leak detected');
    console.warn('Initial heap:', initialMemory.heapUsed);
    console.warn('Final heap:', finalMemory.heapUsed);
  }
  
  // Clean up event listeners
  global.mockEventBus.removeAllListeners();
  
  console.log('✅ Test environment cleaned up');
});

// Set up for each test
beforeEach(() => {
  global.testStartTime = performance.now();
  
  // Reset mock event bus
  global.mockEventBus.removeAllListeners();
  
  // Clear any existing timers
  jest.clearAllTimers();
});

// Clean up after each test
afterEach(async () => {
  const testDuration = performance.now() - global.testStartTime;
  
  // Log slow tests
  if (testDuration > 5000) { // 5 seconds
    console.warn(`⚠️ Slow test detected: ${testDuration.toFixed(2)}ms`);
  }
  
  // Ensure no pending timers
  jest.runOnlyPendingTimers();
  jest.clearAllTimers();
  
  // Check for unhandled promises
  await new Promise(resolve => process.nextTick(resolve));
});

// Utility function to add cleanup tasks
export function addTestCleanup(cleanup: () => Promise<void>): void {
  global.testCleanupTasks.push(cleanup);
}

// Performance tracking utilities
export function startPerformanceTest(): number {
  return performance.now();
}

export function endPerformanceTest(startTime: number, testName: string): number {
  const duration = performance.now() - startTime;
  global.testMetrics.set(`performance.${testName}`, duration);
  return duration;
}

// Memory usage tracking
export function checkMemoryUsage(testName: string): void {
  const usage = process.memoryUsage();
  global.testMetrics.set(`memory.${testName}`, usage);
}

// Event tracking for testing
export function trackEvent(eventName: string, data?: any): void {
  global.mockEventBus.emit('test:event-tracked', { eventName, data, timestamp: Date.now() });
}

// Test metrics collection
export function getTestMetrics(): Map<string, any> {
  return global.testMetrics;
}

// Clean up specific resources
export async function cleanupTestResources(): Promise<void> {
  // Clean up any test databases, files, or connections
  global.testMetrics.clear();
}
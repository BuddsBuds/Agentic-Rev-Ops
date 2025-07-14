import { DatabaseManager } from '@/core/database/DatabaseManager';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

// Mock the pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };

  return {
    Pool: jest.fn(() => mockPool),
    mockClient,
    mockPool,
  };
});

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const pg = require('pg');
    mockPool = pg.mockPool;
    mockClient = pg.mockClient;
    dbManager = DatabaseManager.getInstance();
  });

  afterEach(async () => {
    await dbManager.disconnect();
    // Reset singleton instance
    (DatabaseManager as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseManager.getInstance();
      const instance2 = DatabaseManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection Management', () => {
    it('should connect to database successfully', async () => {
      const result = await dbManager.connect();
      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await dbManager.connect();
      expect(result).toBe(false);
    });

    it('should disconnect properly', async () => {
      await dbManager.connect();
      await dbManager.disconnect();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await dbManager.connect();
    });

    it('should execute queries successfully', async () => {
      const mockResult = { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };
      mockClient.query.mockResolvedValueOnce(mockResult);

      const result = await dbManager.query('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should handle query errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(dbManager.query('SELECT * FROM invalid_table'))
        .rejects.toThrow('Query failed');
    });

    it('should handle query timeouts', async () => {
      mockClient.query.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 100);
        });
      });

      await expect(dbManager.query('SELECT pg_sleep(10)'))
        .rejects.toThrow('Query timeout');
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await dbManager.connect();
    });

    it('should handle transactions successfully', async () => {
      const result = await dbManager.transaction(async (client) => {
        await client.query('INSERT INTO users (name) VALUES ($1)', ['Test User']);
        await client.query('UPDATE users SET active = true WHERE name = $1', ['Test User']);
        return { success: true };
      });

      expect(result).toEqual({ success: true });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on transaction error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')); // INSERT

      await expect(dbManager.transaction(async (client) => {
        await client.query('INSERT INTO users (name) VALUES ($1)', ['Test User']);
      })).rejects.toThrow('Insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Connection Pool Management', () => {
    it('should monitor pool health', async () => {
      await dbManager.connect();
      const health = await dbManager.getPoolHealth();

      expect(health).toEqual({
        totalConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        healthy: true,
      });
    });

    it('should handle pool errors', async () => {
      const errorHandler = jest.fn();
      dbManager.on('error', errorHandler);

      await dbManager.connect();
      const poolErrorHandler = mockPool.on.mock.calls.find(call => call[0] === 'error')?.[1];
      
      if (poolErrorHandler) {
        poolErrorHandler(new Error('Pool error'));
        expect(errorHandler).toHaveBeenCalledWith(new Error('Pool error'));
      }
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await dbManager.connect();
    });

    it('should track query performance', async () => {
      const performanceData: any[] = [];
      dbManager.on('queryComplete', (data) => performanceData.push(data));

      mockClient.query.mockResolvedValueOnce({ rows: [] });
      await dbManager.query('SELECT 1');

      expect(performanceData).toHaveLength(1);
      expect(performanceData[0]).toMatchObject({
        query: 'SELECT 1',
        duration: expect.any(Number),
        success: true,
      });
    });

    it('should track failed query performance', async () => {
      const performanceData: any[] = [];
      dbManager.on('queryComplete', (data) => performanceData.push(data));

      mockClient.query.mockRejectedValueOnce(new Error('Query failed'));
      try {
        await dbManager.query('SELECT invalid');
      } catch (e) {
        // Expected error
      }

      expect(performanceData).toHaveLength(1);
      expect(performanceData[0]).toMatchObject({
        query: 'SELECT invalid',
        duration: expect.any(Number),
        success: false,
        error: 'Query failed',
      });
    });
  });
});
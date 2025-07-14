import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import bodyParser from 'body-parser';

/**
 * Mock API Server for testing external integrations
 */
export class MockAPIServer {
  private app: Express;
  private server: Server | null = null;
  private endpoints: Map<string, MockEndpoint> = new Map();
  private requestLog: RequestLog[] = [];

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        this.requestLog.push({
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          headers: req.headers,
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        });
      });

      next();
    });
  }

  private setupRoutes(): void {
    // Dynamic route handler
    this.app.all('*', (req: Request, res: Response) => {
      const key = `${req.method}:${req.path}`;
      const endpoint = this.endpoints.get(key);

      if (!endpoint) {
        return res.status(404).json({
          error: 'Endpoint not found',
          message: `No mock configured for ${key}`,
        });
      }

      // Simulate latency if configured
      const delay = endpoint.latency || 0;
      
      setTimeout(() => {
        // Check if should fail
        if (endpoint.failureRate && Math.random() < endpoint.failureRate) {
          return res.status(endpoint.errorStatus || 500).json({
            error: 'Simulated failure',
            message: endpoint.errorMessage || 'Mock server simulated failure',
          });
        }

        // Return configured response
        if (endpoint.responseHeaders) {
          Object.entries(endpoint.responseHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }

        res.status(endpoint.statusCode || 200).json(endpoint.response);
      }, delay);
    });
  }

  /**
   * Add a mock endpoint
   */
  addEndpoint(path: string, config: MockEndpointConfig): void {
    const key = `${config.method || 'GET'}:${path}`;
    this.endpoints.set(key, {
      path,
      method: config.method || 'GET',
      response: config.response,
      statusCode: config.statusCode,
      latency: config.latency,
      failureRate: config.failureRate,
      errorStatus: config.errorStatus,
      errorMessage: config.errorMessage,
      responseHeaders: config.responseHeaders,
    });
  }

  /**
   * Remove a mock endpoint
   */
  removeEndpoint(path: string, method: string = 'GET'): void {
    const key = `${method}:${path}`;
    this.endpoints.delete(key);
  }

  /**
   * Clear all endpoints
   */
  clearEndpoints(): void {
    this.endpoints.clear();
  }

  /**
   * Get request log
   */
  getRequestLog(): RequestLog[] {
    return [...this.requestLog];
  }

  /**
   * Clear request log
   */
  clearRequestLog(): void {
    this.requestLog = [];
  }

  /**
   * Get requests for a specific endpoint
   */
  getRequestsFor(path: string, method: string = 'GET'): RequestLog[] {
    return this.requestLog.filter(log => 
      log.path === path && log.method === method
    );
  }

  /**
   * Start the mock server
   */
  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        console.log(`Mock API server started on port ${port}`);
        resolve();
      }).on('error', reject);
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock API server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Configure CRM endpoints
   */
  setupCRMEndpoints(): void {
    // Salesforce endpoints
    this.addEndpoint('/crm/auth/token', {
      method: 'POST',
      response: {
        access_token: 'mock-sf-token',
        instance_url: 'https://mock.salesforce.com',
        token_type: 'Bearer',
      },
    });

    this.addEndpoint('/crm/contacts', {
      method: 'GET',
      response: {
        totalSize: 3,
        records: [
          {
            Id: 'contact-1',
            Name: 'John Doe',
            Email: 'john@example.com',
            AccountId: 'account-1',
          },
          {
            Id: 'contact-2',
            Name: 'Jane Smith',
            Email: 'jane@example.com',
            AccountId: 'account-2',
          },
          {
            Id: 'contact-3',
            Name: 'Bob Johnson',
            Email: 'bob@example.com',
            AccountId: 'account-1',
          },
        ],
      },
    });

    this.addEndpoint('/crm/opportunities', {
      method: 'GET',
      response: {
        totalSize: 2,
        records: [
          {
            Id: 'opp-1',
            Name: 'Big Deal',
            Amount: 100000,
            StageName: 'Negotiation',
            CloseDate: '2024-06-30',
          },
          {
            Id: 'opp-2',
            Name: 'Medium Deal',
            Amount: 50000,
            StageName: 'Qualification',
            CloseDate: '2024-07-15',
          },
        ],
      },
    });
  }

  /**
   * Configure task management endpoints
   */
  setupTaskManagementEndpoints(): void {
    // Asana endpoints
    this.addEndpoint('/asana/workspaces', {
      method: 'GET',
      response: {
        data: [
          {
            gid: 'workspace-1',
            name: 'Test Workspace',
            resource_type: 'workspace',
          },
        ],
      },
    });

    this.addEndpoint('/asana/tasks', {
      method: 'GET',
      response: {
        data: [
          {
            gid: 'task-1',
            name: 'Complete integration',
            completed: false,
            due_on: '2024-05-01',
          },
          {
            gid: 'task-2',
            name: 'Review PR',
            completed: true,
            due_on: '2024-04-28',
          },
        ],
      },
    });

    this.addEndpoint('/asana/tasks', {
      method: 'POST',
      response: {
        data: {
          gid: 'task-new',
          name: 'New Task',
          completed: false,
          created_at: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Configure analytics endpoints
   */
  setupAnalyticsEndpoints(): void {
    this.addEndpoint('/analytics/revenue', {
      method: 'GET',
      response: {
        period: 'monthly',
        data: [
          { month: '2024-01', revenue: 120000, growth: 0.05 },
          { month: '2024-02', revenue: 125000, growth: 0.04 },
          { month: '2024-03', revenue: 135000, growth: 0.08 },
        ],
        total: 380000,
        averageGrowth: 0.057,
      },
    });

    this.addEndpoint('/analytics/metrics', {
      method: 'GET',
      response: {
        metrics: {
          conversionRate: 0.25,
          averageDealSize: 15000,
          salesCycleLength: 45,
          customerAcquisitionCost: 5000,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Simulate API degradation
   */
  simulateDegradation(path: string, config: DegradationConfig): void {
    const key = `${config.method || 'GET'}:${path}`;
    const endpoint = this.endpoints.get(key);
    
    if (endpoint) {
      endpoint.latency = config.latency;
      endpoint.failureRate = config.failureRate;
      endpoint.errorStatus = config.errorStatus;
    }
  }

  /**
   * Reset endpoint to normal behavior
   */
  resetEndpoint(path: string, method: string = 'GET'): void {
    const key = `${method}:${path}`;
    const endpoint = this.endpoints.get(key);
    
    if (endpoint) {
      endpoint.latency = 0;
      endpoint.failureRate = 0;
      delete endpoint.errorStatus;
      delete endpoint.errorMessage;
    }
  }
}

// Type definitions
interface MockEndpoint {
  path: string;
  method: string;
  response: any;
  statusCode?: number;
  latency?: number;
  failureRate?: number;
  errorStatus?: number;
  errorMessage?: string;
  responseHeaders?: Record<string, string>;
}

interface MockEndpointConfig {
  method?: string;
  response: any;
  statusCode?: number;
  latency?: number;
  failureRate?: number;
  errorStatus?: number;
  errorMessage?: string;
  responseHeaders?: Record<string, string>;
}

interface RequestLog {
  method: string;
  path: string;
  query: any;
  body: any;
  headers: any;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

interface DegradationConfig {
  method?: string;
  latency?: number;
  failureRate?: number;
  errorStatus?: number;
}
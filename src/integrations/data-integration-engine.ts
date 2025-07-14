// Data Integration Engine for Agentic Revenue Operations
// Extends existing horizon-scanning data sources with CRM and marketing automation

import { EventEmitter } from 'events';
import { DataSourceManager } from '../horizon-scanning/data-sources';
import { CRMIntegrationManager } from './crm/crm-integration';
import { MarketingAutomationManager } from './marketing-automation/marketing-integration';
import { DataPipelineEngine } from './data-pipelines/pipeline-engine';
import { DataTransformationEngine, TransformationRule } from './transformation/data-transformer';
import { RealtimeDataProcessor } from './data-pipelines/realtime-processor';

// Enhanced data source interface extending horizon scanning
export interface EnhancedDataSource {
  id: string;
  name: string;
  type: 'crm' | 'marketing' | 'social' | 'news' | 'regulatory' | 'financial' | 'api' | 'websocket' | 'database';
  category: 'customer-data' | 'lead-intelligence' | 'market-signals' | 'revenue-data' | 'behavioral-data';
  priority: 'critical' | 'high' | 'medium' | 'low';
  updateFrequency: number;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  transformationRules?: TransformationRule[];
  syncStrategy: 'real-time' | 'batch' | 'hybrid';
  dataSchema: DataSchema;
}

// TransformationRule is imported from data-transformer

export interface DataSchema {
  fields: DataField[];
  relationships?: DataRelationship[];
  constraints?: DataConstraint[];
}

export interface DataField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  description?: string;
  validation?: ValidationRule[];
}

export interface DataRelationship {
  sourceField: string;
  targetSource: string;
  targetField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface DataConstraint {
  field: string;
  constraint: 'unique' | 'not-null' | 'range' | 'format';
  parameters?: any;
}

export interface ValidationRule {
  type: 'regex' | 'range' | 'enum' | 'custom';
  value: any;
  message?: string;
}

export interface AuthConfig {
  type: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'certificate';
  credentials: Record<string, string>;
  refreshInterval?: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstCapacity: number;
  concurrentConnections?: number;
}

// Main Data Integration Engine
export class DataIntegrationEngine extends EventEmitter {
  private horizonScanning: DataSourceManager;
  private crmIntegration: CRMIntegrationManager;
  private marketingIntegration: MarketingAutomationManager;
  private pipelineEngine: DataPipelineEngine;
  private dataTransformer: DataTransformationEngine;
  private realtimeProcessor: RealtimeDataProcessor;
  
  private enhancedSources: Map<string, EnhancedDataSource> = new Map();
  private dataFlows: Map<string, DataFlow> = new Map();
  private syncStates: Map<string, SyncState> = new Map();

  constructor() {
    super();
    this.horizonScanning = new DataSourceManager();
    this.crmIntegration = new CRMIntegrationManager();
    this.marketingIntegration = new MarketingAutomationManager();
    this.pipelineEngine = new DataPipelineEngine();
    this.dataTransformer = new DataTransformationEngine();
    this.realtimeProcessor = new RealtimeDataProcessor();
    
    this.initializeEnhancedSources();
    this.setupEventHandlers();
  }

  private initializeEnhancedSources(): void {
    // CRM Data Sources
    this.registerEnhancedSource({
      id: 'salesforce-crm',
      name: 'Salesforce CRM',
      type: 'crm',
      category: 'customer-data',
      priority: 'critical',
      updateFrequency: 300000, // 5 minutes
      authentication: {
        type: 'oauth2',
        credentials: {
          clientId: process.env.SALESFORCE_CLIENT_ID || '',
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
          refreshToken: process.env.SALESFORCE_REFRESH_TOKEN || ''
        },
        refreshInterval: 3600000 // 1 hour
      },
      rateLimit: {
        requestsPerMinute: 100,
        burstCapacity: 20,
        concurrentConnections: 10
      },
      syncStrategy: 'hybrid',
      dataSchema: {
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'accountName', type: 'string', required: true },
          { name: 'revenue', type: 'number', required: false },
          { name: 'stage', type: 'string', required: true },
          { name: 'probability', type: 'number', required: false },
          { name: 'closeDate', type: 'date', required: false },
          { name: 'lastActivity', type: 'date', required: false },
          { name: 'contactInfo', type: 'object', required: false }
        ],
        relationships: [
          {
            sourceField: 'accountId',
            targetSource: 'hubspot-crm',
            targetField: 'companyId',
            type: 'one-to-one'
          }
        ]
      },
      transformationRules: [
        {
          sourceField: 'Amount',
          targetField: 'revenue',
          transformation: 'normalize',
          parameters: { currency: 'USD' }
        },
        {
          sourceField: 'StageName',
          targetField: 'stage',
          transformation: 'map',
          parameters: {
            mapping: {
              'Prospecting': 'lead',
              'Qualification': 'qualified',
              'Proposal': 'proposal',
              'Closed Won': 'won',
              'Closed Lost': 'lost'
            }
          }
        }
      ]
    });

    this.registerEnhancedSource({
      id: 'hubspot-crm',
      name: 'HubSpot CRM',
      type: 'crm',
      category: 'customer-data',
      priority: 'critical',
      updateFrequency: 300000,
      authentication: {
        type: 'api-key',
        credentials: { key: process.env.HUBSPOT_API_KEY || '' }
      },
      rateLimit: {
        requestsPerMinute: 100,
        burstCapacity: 10
      },
      syncStrategy: 'real-time',
      dataSchema: {
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'companyName', type: 'string', required: true },
          { name: 'dealValue', type: 'number', required: false },
          { name: 'dealStage', type: 'string', required: true },
          { name: 'lastContactDate', type: 'date', required: false },
          { name: 'leadScore', type: 'number', required: false }
        ]
      }
    });

    // Marketing Automation Sources
    this.registerEnhancedSource({
      id: 'marketo-marketing',
      name: 'Marketo Marketing Automation',
      type: 'marketing',
      category: 'lead-intelligence',
      priority: 'high',
      updateFrequency: 600000, // 10 minutes
      authentication: {
        type: 'oauth2',
        credentials: {
          clientId: process.env.MARKETO_CLIENT_ID || '',
          clientSecret: process.env.MARKETO_CLIENT_SECRET || ''
        }
      },
      syncStrategy: 'batch',
      dataSchema: {
        fields: [
          { name: 'leadId', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
          { name: 'score', type: 'number', required: false },
          { name: 'engagementLevel', type: 'string', required: false },
          { name: 'lastEmailOpen', type: 'date', required: false },
          { name: 'campaignResponses', type: 'array', required: false }
        ]
      }
    });

    this.registerEnhancedSource({
      id: 'pardot-marketing',
      name: 'Pardot Marketing Automation',
      type: 'marketing',
      category: 'behavioral-data',
      priority: 'high',
      updateFrequency: 900000, // 15 minutes
      authentication: {
        type: 'oauth2',
        credentials: {
          clientId: process.env.PARDOT_CLIENT_ID || '',
          clientSecret: process.env.PARDOT_CLIENT_SECRET || ''
        }
      },
      syncStrategy: 'hybrid',
      dataSchema: {
        fields: [
          { name: 'prospectId', type: 'string', required: true },
          { name: 'grade', type: 'string', required: false },
          { name: 'profile', type: 'string', required: false },
          { name: 'activities', type: 'array', required: false },
          { name: 'formSubmissions', type: 'array', required: false }
        ]
      }
    });

    // Revenue Intelligence Sources
    this.registerEnhancedSource({
      id: 'stripe-payments',
      name: 'Stripe Payment Processing',
      type: 'api',
      category: 'revenue-data',
      priority: 'critical',
      updateFrequency: 60000, // 1 minute for payment data
      authentication: {
        type: 'api-key',
        credentials: { key: process.env.STRIPE_SECRET_KEY || '' }
      },
      rateLimit: {
        requestsPerMinute: 100,
        burstCapacity: 25
      },
      syncStrategy: 'real-time',
      dataSchema: {
        fields: [
          { name: 'transactionId', type: 'string', required: true },
          { name: 'amount', type: 'number', required: true },
          { name: 'currency', type: 'string', required: true },
          { name: 'customerId', type: 'string', required: true },
          { name: 'status', type: 'string', required: true },
          { name: 'timestamp', type: 'date', required: true }
        ]
      }
    });

    // Customer Support Sources
    this.registerEnhancedSource({
      id: 'zendesk-support',
      name: 'Zendesk Support',
      type: 'api',
      category: 'customer-data',
      priority: 'medium',
      updateFrequency: 1800000, // 30 minutes
      authentication: {
        type: 'api-key',
        credentials: { key: process.env.ZENDESK_API_KEY || '' }
      },
      syncStrategy: 'batch',
      dataSchema: {
        fields: [
          { name: 'ticketId', type: 'string', required: true },
          { name: 'customerId', type: 'string', required: true },
          { name: 'priority', type: 'string', required: true },
          { name: 'status', type: 'string', required: true },
          { name: 'sentiment', type: 'number', required: false },
          { name: 'resolutionTime', type: 'number', required: false }
        ]
      }
    });
  }

  registerEnhancedSource(source: EnhancedDataSource): void {
    this.enhancedSources.set(source.id, source);
    this.syncStates.set(source.id, {
      status: 'disconnected',
      lastSync: null,
      errorCount: 0,
      dataCount: 0
    });
  }

  async initializeAllSources(): Promise<void> {
    // Initialize existing horizon scanning sources
    await this.horizonScanning.connectSource('bloomberg-api');
    await this.horizonScanning.connectSource('reuters-connect');
    await this.horizonScanning.connectSource('twitter-stream');

    // Initialize enhanced data sources
    const sourceConnections = Array.from(this.enhancedSources.values()).map(
      source => this.connectEnhancedSource(source.id)
    );

    await Promise.allSettled(sourceConnections);
    
    // Start real-time data processing
    this.startRealtimeProcessing();
    
    this.emit('integration:initialized');
  }

  private async connectEnhancedSource(sourceId: string): Promise<void> {
    const source = this.enhancedSources.get(sourceId);
    if (!source) throw new Error(`Enhanced source ${sourceId} not found`);

    try {
      this.updateSyncState(sourceId, { status: 'connecting' });

      switch (source.type) {
        case 'crm':
          await this.crmIntegration.connect(source);
          break;
        case 'marketing':
          await this.marketingIntegration.connect(source);
          break;
        case 'api':
          await this.connectAPISource(source);
          break;
        case 'database':
          await this.connectDatabaseSource(source);
          break;
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }

      this.updateSyncState(sourceId, { 
        status: 'connected',
        lastSync: new Date()
      });

      // Set up sync strategy
      await this.setupSyncStrategy(source);

      this.emit('source:connected', { sourceId, source });

    } catch (error) {
      this.updateSyncState(sourceId, { 
        status: 'error',
        errorCount: this.syncStates.get(sourceId)!.errorCount + 1
      });
      
      this.emit('source:error', { sourceId, error });
      throw error;
    }
  }

  private async setupSyncStrategy(source: EnhancedDataSource): Promise<void> {
    switch (source.syncStrategy) {
      case 'real-time':
        await this.setupRealtimeSync(source);
        break;
      case 'batch':
        await this.setupBatchSync(source);
        break;
      case 'hybrid':
        await this.setupHybridSync(source);
        break;
    }
  }

  private async setupRealtimeSync(source: EnhancedDataSource): Promise<void> {
    // Set up webhooks or websocket connections for real-time data
    if (source.type === 'crm') {
      await this.crmIntegration.setupWebhooks(source.id);
    } else if (source.type === 'marketing') {
      await this.marketingIntegration.setupWebhooks(source.id);
    }

    // Set up real-time data flow
    const dataFlow: DataFlow = {
      sourceId: source.id,
      type: 'streaming',
      processor: this.realtimeProcessor,
      transformations: source.transformationRules || [],
      destinations: ['unified-data-store', 'analytics-engine']
    };

    this.dataFlows.set(`${source.id}-realtime`, dataFlow);
  }

  private async setupBatchSync(source: EnhancedDataSource): Promise<void> {
    // Set up scheduled batch processing
    const syncData = async () => {
      try {
        const data = await this.fetchBatchData(source);
        const transformedData = await this.dataTransformer.transform(data, source.transformationRules || []);
        
        await this.pipelineEngine.processBatch(transformedData, {
          sourceId: source.id,
          timestamp: new Date(),
          metadata: { batchSize: data.length }
        });

        this.updateSyncState(source.id, {
          lastSync: new Date(),
          dataCount: this.syncStates.get(source.id)!.dataCount + data.length
        });

      } catch (error) {
        this.emit('sync:error', { sourceId: source.id, error });
      }
    };

    // Schedule batch sync
    setInterval(syncData, source.updateFrequency);
    
    // Initial sync
    syncData();
  }

  private async setupHybridSync(source: EnhancedDataSource): Promise<void> {
    // Combine real-time and batch strategies
    await this.setupRealtimeSync(source);
    await this.setupBatchSync(source);
  }

  private async fetchBatchData(source: EnhancedDataSource): Promise<any[]> {
    switch (source.type) {
      case 'crm':
        return this.crmIntegration.fetchData(source.id);
      case 'marketing':
        return this.marketingIntegration.fetchData(source.id);
      case 'api':
        return this.fetchAPIData(source);
      default:
        return [];
    }
  }

  private async connectAPISource(source: EnhancedDataSource): Promise<void> {
    // Generic API connection logic
    const testEndpoint = this.getAPIEndpoint(source, '/health');
    const headers = this.getAuthHeaders(source);
    
    const response = await fetch(testEndpoint, { headers });
    if (!response.ok) {
      throw new Error(`API connection failed: ${response.statusText}`);
    }
  }

  private async connectDatabaseSource(source: EnhancedDataSource): Promise<void> {
    // Database connection logic would go here
    // Implementation depends on specific database type
    throw new Error('Database sources not yet implemented');
  }

  private async fetchAPIData(source: EnhancedDataSource): Promise<any[]> {
    const endpoint = this.getAPIEndpoint(source, '/data');
    const headers = this.getAuthHeaders(source);
    
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`API fetch failed: ${response.statusText}`);
    }
    
    return response.json() as Promise<any[]>;
  }

  private getAPIEndpoint(source: EnhancedDataSource, path: string): string {
    const baseUrls: Record<string, string> = {
      'stripe-payments': 'https://api.stripe.com/v1',
      'zendesk-support': `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`
    };
    
    return baseUrls[source.id] + path;
  }

  private getAuthHeaders(source: EnhancedDataSource): Record<string, string> {
    if (!source.authentication) return {};

    const { type, credentials } = source.authentication;
    switch (type) {
      case 'api-key':
        if (source.id === 'stripe-payments') {
          return { 'Authorization': `Bearer ${credentials.key}` };
        }
        return { 'X-API-Key': credentials.key };
      case 'bearer':
        return { 'Authorization': `Bearer ${credentials.token}` };
      case 'oauth2':
        return { 'Authorization': `Bearer ${credentials.accessToken}` };
      case 'basic':
        const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        return { 'Authorization': `Basic ${encoded}` };
      default:
        return {};
    }
  }

  private startRealtimeProcessing(): void {
    // Set up event handlers for real-time data processing
    this.horizonScanning.on('data:received', (data: any) => {
      this.realtimeProcessor.process(data);
    });

    this.crmIntegration.on('data:received', (data: any) => {
      this.realtimeProcessor.process(data);
    });

    this.marketingIntegration.on('data:received', (data: any) => {
      this.realtimeProcessor.process(data);
    });

    this.realtimeProcessor.on('data:processed', (processedData: any) => {
      this.emit('data:unified', processedData);
    });
  }

  private setupEventHandlers(): void {
    // Handle CRM integration events
    this.crmIntegration.on('data:received', (data) => {
      this.emit('crm:data', data);
    });

    this.crmIntegration.on('sync:complete', (result) => {
      this.emit('crm:sync:complete', result);
    });

    // Handle marketing automation events
    this.marketingIntegration.on('data:received', (data) => {
      this.emit('marketing:data', data);
    });

    this.marketingIntegration.on('campaign:triggered', (event) => {
      this.emit('marketing:campaign:triggered', event);
    });

    // Handle data pipeline events
    this.pipelineEngine.on('batch:processed', (result) => {
      this.emit('pipeline:batch:processed', result);
    });

    this.pipelineEngine.on('error', (error) => {
      this.emit('pipeline:error', error);
    });
  }

  private updateSyncState(sourceId: string, updates: Partial<SyncState>): void {
    const currentState = this.syncStates.get(sourceId)!;
    this.syncStates.set(sourceId, { ...currentState, ...updates });
  }

  // Public API methods
  async getSyncStatus(): Promise<Map<string, SyncState>> {
    return new Map(this.syncStates);
  }

  async getDataSourceMetrics(sourceId: string): Promise<DataSourceMetrics> {
    const source = this.enhancedSources.get(sourceId);
    const syncState = this.syncStates.get(sourceId);
    
    if (!source || !syncState) {
      throw new Error(`Source ${sourceId} not found`);
    }

    return {
      sourceId,
      sourceName: source.name,
      status: syncState.status,
      lastSync: syncState.lastSync,
      dataCount: syncState.dataCount,
      errorCount: syncState.errorCount,
      averageSyncTime: await this.calculateAverageSyncTime(sourceId),
      dataQualityScore: await this.calculateDataQualityScore(sourceId)
    };
  }

  async unifyCustomerData(customerId: string): Promise<UnifiedCustomerProfile> {
    // Gather data from all sources for a specific customer
    const crmData = await this.crmIntegration.getCustomerData(customerId);
    const marketingData = await this.marketingIntegration.getCustomerData(customerId);
    const supportData = await this.getSupportData(customerId);
    const transactionData = await this.getTransactionData(customerId);

    // Use data transformer to create unified profile
    return this.dataTransformer.unifyCustomerProfile({
      customerId,
      crmData,
      marketingData,
      supportData,
      transactionData
    });
  }

  private async calculateAverageSyncTime(sourceId: string): Promise<number> {
    // Implementation would calculate average sync time from historical data
    return 0; // Placeholder
  }

  private async calculateDataQualityScore(sourceId: string): Promise<number> {
    // Implementation would assess data quality based on various metrics
    return 0.85; // Placeholder
  }

  private async getSupportData(customerId: string): Promise<any[]> {
    // Fetch support data for customer
    return []; // Placeholder
  }

  private async getTransactionData(customerId: string): Promise<any[]> {
    // Fetch transaction data for customer
    return []; // Placeholder
  }
}

// Supporting interfaces
interface DataFlow {
  sourceId: string;
  type: 'streaming' | 'batch' | 'hybrid';
  processor: any;
  transformations: TransformationRule[];
  destinations: string[];
}

interface SyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  lastSync: Date | null;
  errorCount: number;
  dataCount: number;
}

interface DataSourceMetrics {
  sourceId: string;
  sourceName: string;
  status: string;
  lastSync: Date | null;
  dataCount: number;
  errorCount: number;
  averageSyncTime: number;
  dataQualityScore: number;
}

interface UnifiedCustomerProfile {
  customerId: string;
  personalInfo: any;
  engagementHistory: any[];
  transactionHistory: any[];
  supportHistory: any[];
  predictiveScores: any;
  segmentation: any;
}

export default DataIntegrationEngine;
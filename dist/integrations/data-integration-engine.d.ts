import { EventEmitter } from 'events';
import { TransformationRule } from './transformation/data-transformer';
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
export declare class DataIntegrationEngine extends EventEmitter {
    private horizonScanning;
    private crmIntegration;
    private marketingIntegration;
    private pipelineEngine;
    private dataTransformer;
    private realtimeProcessor;
    private enhancedSources;
    private dataFlows;
    private syncStates;
    constructor();
    private initializeEnhancedSources;
    registerEnhancedSource(source: EnhancedDataSource): void;
    initializeAllSources(): Promise<void>;
    private connectEnhancedSource;
    private setupSyncStrategy;
    private setupRealtimeSync;
    private setupBatchSync;
    private setupHybridSync;
    private fetchBatchData;
    private connectAPISource;
    private connectDatabaseSource;
    private fetchAPIData;
    private getAPIEndpoint;
    private getAuthHeaders;
    private startRealtimeProcessing;
    private setupEventHandlers;
    private updateSyncState;
    getSyncStatus(): Promise<Map<string, SyncState>>;
    getDataSourceMetrics(sourceId: string): Promise<DataSourceMetrics>;
    unifyCustomerData(customerId: string): Promise<UnifiedCustomerProfile>;
    private calculateAverageSyncTime;
    private calculateDataQualityScore;
    private getSupportData;
    private getTransactionData;
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
//# sourceMappingURL=data-integration-engine.d.ts.map
import { EventEmitter } from 'events';
export interface Integration {
    id: string;
    name: string;
    type: string;
    status: 'connected' | 'disconnected' | 'error';
    config: any;
}
export interface IntegrationManager {
    registerIntegration(integration: Integration): void;
    connect(integrationId: string): Promise<void>;
    disconnect(integrationId: string): Promise<void>;
    sendData(integrationId: string, data: any): Promise<any>;
    getIntegrations(): Integration[];
    initialize(): Promise<void>;
}
export declare class WorkflowIntegrationManager extends EventEmitter implements IntegrationManager {
    private integrations;
    private connections;
    registerIntegration(integration: Integration): void;
    connect(integrationId: string): Promise<void>;
    disconnect(integrationId: string): Promise<void>;
    sendData(integrationId: string, data: any): Promise<any>;
    getIntegrations(): Integration[];
    private processIntegrationData;
    private sendWebhook;
    private sendAPI;
    private saveToDatabase;
    isConnected(integrationId: string): boolean;
    reconnect(integrationId: string): Promise<void>;
    testConnection(integrationId: string): Promise<boolean>;
    initialize(): Promise<void>;
}
//# sourceMappingURL=integration-manager.d.ts.map
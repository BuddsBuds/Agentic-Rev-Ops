import { EventEmitter } from 'events';
export interface CRMIntegration {
    name: string;
    version: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    syncData(data: any): Promise<any>;
}
export declare class CRMIntegrationManager extends EventEmitter implements CRMIntegration {
    name: string;
    version: string;
    private connected;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    syncData(data: any): Promise<any>;
    fetchContacts(params: any): Promise<any[]>;
    updateContact(id: string, data: any): Promise<any>;
    createLead(data: any): Promise<any>;
    setupWebhooks(config: any): Promise<void>;
    fetchData(params: any): Promise<any[]>;
}
//# sourceMappingURL=crm-integration.d.ts.map
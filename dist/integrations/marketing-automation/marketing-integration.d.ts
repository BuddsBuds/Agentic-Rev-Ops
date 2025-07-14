import { EventEmitter } from 'events';
export interface MarketingAutomationIntegration {
    name: string;
    version: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    triggerCampaign(campaignId: string, params: any): Promise<any>;
}
export declare class MarketingAutomationManager extends EventEmitter implements MarketingAutomationIntegration {
    name: string;
    version: string;
    private connected;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    triggerCampaign(campaignId: string, params: any): Promise<any>;
    createSegment(criteria: any): Promise<any>;
    trackEvent(event: any): Promise<void>;
    getAnalytics(params: any): Promise<any>;
    setupWebhooks(config: any): Promise<void>;
    fetchData(params: any): Promise<any[]>;
}
//# sourceMappingURL=marketing-integration.d.ts.map
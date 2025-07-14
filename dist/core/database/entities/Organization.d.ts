import { BaseEntity, BaseEntityData } from './base';
import { DatabaseConnectionManager } from '../connection';
export interface OrganizationData extends BaseEntityData {
    name: string;
    domain?: string;
    subscription_tier: 'basic' | 'professional' | 'enterprise';
    settings: Record<string, any>;
    billing_info?: {
        plan: string;
        billingCycle: 'monthly' | 'annual';
        nextBillingDate?: Date;
        paymentMethod?: string;
    };
    usage_metrics?: {
        agentsUsed: number;
        decisionsCount: number;
        dataVolume: number;
        apiCalls: number;
    };
}
export declare class Organization extends BaseEntity<OrganizationData> {
    constructor(db: DatabaseConnectionManager, data?: Partial<OrganizationData>);
    protected createInstance(data: OrganizationData): this;
    protected validate(): void;
    protected beforeSave(): Promise<void>;
    getUsers(): Promise<any[]>;
    getClients(): Promise<any[]>;
    getSwarmConfigurations(): Promise<any[]>;
    getAnalytics(dateRange?: {
        start: Date;
        end: Date;
    }): Promise<any>;
    updateUsageMetrics(metrics: Partial<OrganizationData['usage_metrics']>): Promise<void>;
    canCreateAgents(requestedCount?: number): boolean;
    getSubscriptionLimits(): {
        maxAgents: number;
        maxDecisions: number;
        dataRetentionDays: number;
        features: string[];
    };
    private getMaxAgentsForTier;
    private getMaxDecisionsForTier;
    private getDataRetentionForTier;
    private getFeaturesForTier;
    static findByDomain(db: DatabaseConnectionManager, domain: string): Promise<Organization | null>;
    getUsageReport(): Promise<any>;
    private isOverLimit;
    private getUsageRecommendations;
}
export default Organization;
//# sourceMappingURL=Organization.d.ts.map
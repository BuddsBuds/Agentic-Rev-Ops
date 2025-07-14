import { BaseRepository } from './BaseRepository';
import { DatabaseConnectionManager } from '../connection';
import { Organization, OrganizationData } from '../entities/Organization';
export declare class OrganizationRepository extends BaseRepository<OrganizationData> {
    constructor(db: DatabaseConnectionManager);
    findByDomain(domain: string): Promise<Organization | null>;
    findBySubscriptionTier(tier: string): Promise<Organization[]>;
    findHighUsageOrganizations(threshold?: number): Promise<any[]>;
    getDashboardData(organizationId: string): Promise<any>;
    getUsageAnalytics(organizationId: string, startDate: Date, endDate: Date): Promise<any>;
    updateSubscriptionTier(organizationId: string, newTier: string): Promise<Organization | null>;
    getOrganizationsRequiringAttention(): Promise<any[]>;
    cleanupExpiredTrials(): Promise<number>;
    getSubscriptionStats(): Promise<any>;
    private getMaxAgentsForTier;
    private getDataRetentionForTier;
    private getFeaturesForTier;
}
export default OrganizationRepository;
//# sourceMappingURL=OrganizationRepository.d.ts.map
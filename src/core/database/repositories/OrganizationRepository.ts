/**
 * Organization Repository
 * Specialized data access methods for Organization entities
 */

import { BaseRepository } from './BaseRepository';
import { DatabaseConnectionManager } from '../connection';
import { Organization, OrganizationData } from '../entities/Organization';

export class OrganizationRepository extends BaseRepository<OrganizationData> {
  constructor(db: DatabaseConnectionManager) {
    super(db, {
      tableName: 'organizations',
      schema: 'core',
      entityClass: Organization
    });
  }

  /**
   * Find organization by domain
   */
  async findByDomain(domain: string): Promise<Organization | null> {
    return this.findOne({ where: { domain } });
  }

  /**
   * Find organizations by subscription tier
   */
  async findBySubscriptionTier(tier: string): Promise<Organization[]> {
    return this.find({ 
      where: { subscription_tier: tier },
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Get organizations with usage above threshold
   */
  async findHighUsageOrganizations(threshold: number = 0.8): Promise<any[]> {
    const query = `
      SELECT 
        o.*,
        (o.usage_metrics->>'agentsUsed')::int as agents_used,
        CASE o.subscription_tier
          WHEN 'basic' THEN 5
          WHEN 'professional' THEN 20
          WHEN 'enterprise' THEN 100
        END as max_agents,
        (o.usage_metrics->>'agentsUsed')::float / 
        CASE o.subscription_tier
          WHEN 'basic' THEN 5
          WHEN 'professional' THEN 20
          WHEN 'enterprise' THEN 100
        END as usage_ratio
      FROM ${this.schema}.${this.tableName} o
      WHERE 
        o.deleted_at IS NULL
        AND (o.usage_metrics->>'agentsUsed')::float / 
        CASE o.subscription_tier
          WHEN 'basic' THEN 5
          WHEN 'professional' THEN 20
          WHEN 'enterprise' THEN 100
        END >= $1
      ORDER BY usage_ratio DESC
    `;
    
    const result = await this.executeQuery(query, [threshold], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get organization dashboard data
   */
  async getDashboardData(organizationId: string): Promise<any> {
    const queries = await Promise.all([
      // User metrics
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active THEN 1 END) as active_users,
          COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as weekly_active_users
        FROM core.users 
        WHERE organization_id = $1 AND deleted_at IS NULL
      `, [organizationId], { useReadReplica: true }),
      
      // Client metrics
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_clients,
          AVG(health_score) as avg_health_score,
          COUNT(CASE WHEN health_score < 0.3 THEN 1 END) as at_risk_clients,
          COUNT(CASE WHEN contract_end_date < NOW() + INTERVAL '30 days' THEN 1 END) as expiring_contracts
        FROM core.clients 
        WHERE organization_id = $1 AND deleted_at IS NULL
      `, [organizationId], { useReadReplica: true }),
      
      // Swarm metrics
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_swarms,
          COUNT(CASE WHEN is_active THEN 1 END) as active_swarms,
          SUM((metrics->>'total_decisions')::int) as total_decisions,
          AVG((metrics->>'agent_satisfaction')::float) as avg_satisfaction
        FROM swarm.swarm_configurations 
        WHERE organization_id = $1 AND deleted_at IS NULL
      `, [organizationId], { useReadReplica: true }),
      
      // Revenue metrics
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_opportunities,
          SUM(CASE WHEN stage = 'won' THEN value_usd ELSE 0 END) as won_revenue,
          SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN value_usd ELSE 0 END) as pipeline_value,
          AVG(probability) as avg_probability
        FROM core.opportunities o
        JOIN core.clients c ON o.client_id = c.id
        WHERE c.organization_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'
      `, [organizationId], { useReadReplica: true })
    ]);

    return {
      users: queries[0].rows[0],
      clients: queries[1].rows[0],
      swarms: queries[2].rows[0],
      revenue: queries[3].rows[0]
    };
  }

  /**
   * Get usage analytics for billing
   */
  async getUsageAnalytics(organizationId: string, startDate: Date, endDate: Date): Promise<any> {
    const queries = await Promise.all([
      // Agent usage over time
      this.executeQuery(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as agents_created
        FROM swarm.agents a
        JOIN swarm.swarm_configurations sc ON a.swarm_id = sc.id
        WHERE 
          sc.organization_id = $1 
          AND a.created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [organizationId, startDate, endDate], { useReadReplica: true }),
      
      // Decision volume
      this.executeQuery(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as decisions_made
        FROM swarm.decisions d
        JOIN swarm.swarm_configurations sc ON d.swarm_id = sc.id
        WHERE 
          sc.organization_id = $1 
          AND d.created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [organizationId, startDate, endDate], { useReadReplica: true }),
      
      // Data volume
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_records,
          SUM(pg_column_size(data)) as total_bytes
        FROM integrations.unified_data
        WHERE 
          organization_id = $1 
          AND created_at BETWEEN $2 AND $3
      `, [organizationId, startDate, endDate], { useReadReplica: true }),
      
      // API usage
      this.executeQuery(`
        SELECT 
          DATE(window_start) as date,
          SUM(requests_count) as api_calls
        FROM integrations.api_usage au
        JOIN integrations.data_sources ds ON au.data_source_id = ds.id
        WHERE 
          ds.organization_id = $1 
          AND au.window_start BETWEEN $2 AND $3
        GROUP BY DATE(window_start)
        ORDER BY date
      `, [organizationId, startDate, endDate], { useReadReplica: true })
    ]);

    return {
      agentUsage: queries[0].rows,
      decisionVolume: queries[1].rows,
      dataVolume: queries[2].rows[0],
      apiUsage: queries[3].rows
    };
  }

  /**
   * Update organization limits based on tier
   */
  async updateSubscriptionTier(organizationId: string, newTier: string): Promise<Organization | null> {
    const org = await this.findById(organizationId);
    if (!org) return null;
    
    org.set('subscription_tier', newTier as any);
    
    // Update settings with new limits
    const settings = org.get('settings') || {};
    settings.maxAgents = this.getMaxAgentsForTier(newTier);
    settings.dataRetentionDays = this.getDataRetentionForTier(newTier);
    settings.features = this.getFeaturesForTier(newTier);
    
    org.set('settings', settings);
    await org.save();
    
    return org;
  }

  /**
   * Get organizations requiring attention
   */
  async getOrganizationsRequiringAttention(): Promise<any[]> {
    const query = `
      SELECT 
        o.*,
        CASE 
          WHEN (o.usage_metrics->>'agentsUsed')::float / 
               CASE o.subscription_tier
                 WHEN 'basic' THEN 5
                 WHEN 'professional' THEN 20
                 WHEN 'enterprise' THEN 100
               END > 0.9 THEN 'over_limit'
          WHEN (o.usage_metrics->>'decisionsCount')::int > 
               CASE o.subscription_tier
                 WHEN 'basic' THEN 800
                 WHEN 'professional' THEN 8000
                 WHEN 'enterprise' THEN 999999
               END THEN 'approaching_decision_limit'
          WHEN EXISTS (
            SELECT 1 FROM core.clients c 
            WHERE c.organization_id = o.id 
            AND c.health_score < 0.3 
            AND c.deleted_at IS NULL
          ) THEN 'clients_at_risk'
          ELSE 'healthy'
        END as attention_reason
      FROM ${this.schema}.${this.tableName} o
      WHERE 
        o.deleted_at IS NULL
        AND (
          (o.usage_metrics->>'agentsUsed')::float / 
          CASE o.subscription_tier
            WHEN 'basic' THEN 5
            WHEN 'professional' THEN 20
            WHEN 'enterprise' THEN 100
          END > 0.9
          OR (o.usage_metrics->>'decisionsCount')::int > 
             CASE o.subscription_tier
               WHEN 'basic' THEN 800
               WHEN 'professional' THEN 8000
               WHEN 'enterprise' THEN 999999
             END
          OR EXISTS (
            SELECT 1 FROM core.clients c 
            WHERE c.organization_id = o.id 
            AND c.health_score < 0.3 
            AND c.deleted_at IS NULL
          )
        )
      ORDER BY 
        CASE attention_reason
          WHEN 'over_limit' THEN 1
          WHEN 'approaching_decision_limit' THEN 2
          WHEN 'clients_at_risk' THEN 3
          ELSE 4
        END,
        o.created_at DESC
    `;
    
    const result = await this.executeQuery(query, [], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Cleanup expired trial organizations
   */
  async cleanupExpiredTrials(): Promise<number> {
    const query = `
      UPDATE ${this.schema}.${this.tableName}
      SET 
        deleted_at = NOW(),
        settings = settings || '{"trial_expired": true}'::jsonb
      WHERE 
        subscription_tier = 'basic'
        AND created_at < NOW() - INTERVAL '30 days'
        AND (settings->>'trial_extended')::boolean IS NOT TRUE
        AND deleted_at IS NULL
      RETURNING id
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.length;
  }

  /**
   * Get subscription tier statistics
   */
  async getSubscriptionStats(): Promise<any> {
    const query = `
      SELECT 
        subscription_tier,
        COUNT(*) as count,
        AVG((usage_metrics->>'agentsUsed')::int) as avg_agents_used,
        AVG((usage_metrics->>'decisionsCount')::int) as avg_decisions,
        SUM((usage_metrics->>'dataVolume')::bigint) as total_data_volume
      FROM ${this.schema}.${this.tableName}
      WHERE deleted_at IS NULL
      GROUP BY subscription_tier
      ORDER BY 
        CASE subscription_tier
          WHEN 'enterprise' THEN 1
          WHEN 'professional' THEN 2
          WHEN 'basic' THEN 3
        END
    `;
    
    const result = await this.executeQuery(query, [], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Helper methods for subscription limits
   */
  private getMaxAgentsForTier(tier: string): number {
    switch (tier) {
      case 'basic': return 5;
      case 'professional': return 20;
      case 'enterprise': return 100;
      default: return 5;
    }
  }

  private getDataRetentionForTier(tier: string): number {
    switch (tier) {
      case 'basic': return 30;
      case 'professional': return 90;
      case 'enterprise': return 365;
      default: return 30;
    }
  }

  private getFeaturesForTier(tier: string): string[] {
    const baseFeatures = ['basic-swarm', 'decision-tracking'];
    
    switch (tier) {
      case 'basic':
        return baseFeatures;
      case 'professional':
        return [...baseFeatures, 'advanced-analytics', 'integrations', 'custom-agents'];
      case 'enterprise':
        return [...baseFeatures, 'advanced-analytics', 'integrations', 'custom-agents', 
                'priority-support', 'custom-deployment', 'advanced-security'];
      default:
        return baseFeatures;
    }
  }
}

export default OrganizationRepository;
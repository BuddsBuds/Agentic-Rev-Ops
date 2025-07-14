/**
 * Organization Entity Model
 * Represents organizations/tenants in the multi-tenant system
 */

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

export class Organization extends BaseEntity<OrganizationData> {
  constructor(db: DatabaseConnectionManager, data?: Partial<OrganizationData>) {
    super(db, 'organizations', 'core', data);
  }

  /**
   * Create new instance from data
   */
  protected createInstance(data: OrganizationData): this {
    return new Organization(this.db, data) as this;
  }

  /**
   * Validate organization data
   */
  protected validate(): void {
    const data = this.getData();
    
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Organization name is required');
    }
    
    if (data.name.length > 255) {
      throw new Error('Organization name must be less than 255 characters');
    }
    
    if (data.domain && !/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(data.domain)) {
      throw new Error('Invalid domain format');
    }

    if (!['basic', 'professional', 'enterprise'].includes(data.subscription_tier!)) {
      throw new Error('Invalid subscription tier');
    }
  }

  /**
   * Before save hook
   */
  protected async beforeSave(): Promise<void> {
    this.validate();
    
    // Set default settings if not provided
    if (!this.get('settings')) {
      this.set('settings', {
        autoApprovalThreshold: 0.8,
        maxAgents: this.getMaxAgentsForTier(),
        dataRetentionDays: this.getDataRetentionForTier(),
        features: this.getFeaturesForTier()
      });
    }
  }

  /**
   * Get users in this organization
   */
  async getUsers(): Promise<any[]> {
    const query = `
      SELECT * FROM core.users 
      WHERE organization_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [this.get('id')], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get clients for this organization
   */
  async getClients(): Promise<any[]> {
    const query = `
      SELECT * FROM core.clients 
      WHERE organization_id = $1 AND deleted_at IS NULL
      ORDER BY health_score DESC, name ASC
    `;
    const result = await this.query(query, [this.get('id')], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get swarm configurations
   */
  async getSwarmConfigurations(): Promise<any[]> {
    const query = `
      SELECT * FROM swarm.swarm_configurations 
      WHERE organization_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [this.get('id')], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get organization analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<any> {
    const params = [this.get('id')];
    let dateFilter = '';
    
    if (dateRange) {
      dateFilter = ' AND created_at BETWEEN $2 AND $3';
      params.push(dateRange.start, dateRange.end);
    }

    const queries = await Promise.all([
      // Total decisions
      this.query(`
        SELECT COUNT(*) as total_decisions 
        FROM swarm.decisions d
        JOIN swarm.swarm_configurations sc ON d.swarm_id = sc.id
        WHERE sc.organization_id = $1${dateFilter}
      `, params, { useReadReplica: true }),
      
      // Total clients
      this.query(`
        SELECT COUNT(*) as total_clients
        FROM core.clients
        WHERE organization_id = $1 AND deleted_at IS NULL${dateFilter}
      `, params, { useReadReplica: true }),
      
      // Revenue metrics
      this.query(`
        SELECT 
          COUNT(*) as total_opportunities,
          SUM(CASE WHEN stage = 'won' THEN value_usd ELSE 0 END) as won_revenue,
          SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN value_usd ELSE 0 END) as pipeline_value
        FROM core.opportunities o
        JOIN core.clients c ON o.client_id = c.id
        WHERE c.organization_id = $1${dateFilter}
      `, params, { useReadReplica: true }),
      
      // Agent activity
      this.query(`
        SELECT 
          COUNT(DISTINCT a.id) as active_agents,
          AVG(a.performance_score) as avg_performance
        FROM swarm.agents a
        JOIN swarm.swarm_configurations sc ON a.swarm_id = sc.id
        WHERE sc.organization_id = $1 AND a.status = 'active'
      `, params, { useReadReplica: true })
    ]);

    return {
      totalDecisions: parseInt(queries[0].rows[0]?.total_decisions || '0'),
      totalClients: parseInt(queries[1].rows[0]?.total_clients || '0'),
      totalOpportunities: parseInt(queries[2].rows[0]?.total_opportunities || '0'),
      wonRevenue: parseInt(queries[2].rows[0]?.won_revenue || '0'),
      pipelineValue: parseInt(queries[2].rows[0]?.pipeline_value || '0'),
      activeAgents: parseInt(queries[3].rows[0]?.active_agents || '0'),
      avgPerformance: parseFloat(queries[3].rows[0]?.avg_performance || '0.5')
    };
  }

  /**
   * Update usage metrics
   */
  async updateUsageMetrics(metrics: Partial<OrganizationData['usage_metrics']>): Promise<void> {
    const currentMetrics = this.get('usage_metrics') || {};
    const updatedMetrics = { ...currentMetrics, ...metrics };
    
    this.set('usage_metrics', updatedMetrics);
    await this.save();
  }

  /**
   * Check if organization can create more agents
   */
  canCreateAgents(requestedCount: number = 1): boolean {
    const currentMetrics = this.get('usage_metrics');
    const maxAgents = this.getMaxAgentsForTier();
    const currentAgents = currentMetrics?.agentsUsed || 0;
    
    return (currentAgents + requestedCount) <= maxAgents;
  }

  /**
   * Get subscription limits
   */
  getSubscriptionLimits(): {
    maxAgents: number;
    maxDecisions: number;
    dataRetentionDays: number;
    features: string[];
  } {
    return {
      maxAgents: this.getMaxAgentsForTier(),
      maxDecisions: this.getMaxDecisionsForTier(),
      dataRetentionDays: this.getDataRetentionForTier(),
      features: this.getFeaturesForTier()
    };
  }

  /**
   * Get max agents for subscription tier
   */
  private getMaxAgentsForTier(): number {
    const tier = this.get('subscription_tier');
    switch (tier) {
      case 'basic': return 5;
      case 'professional': return 20;
      case 'enterprise': return 100;
      default: return 5;
    }
  }

  /**
   * Get max decisions for subscription tier
   */
  private getMaxDecisionsForTier(): number {
    const tier = this.get('subscription_tier');
    switch (tier) {
      case 'basic': return 1000;
      case 'professional': return 10000;
      case 'enterprise': return -1; // unlimited
      default: return 1000;
    }
  }

  /**
   * Get data retention period for tier
   */
  private getDataRetentionForTier(): number {
    const tier = this.get('subscription_tier');
    switch (tier) {
      case 'basic': return 30;
      case 'professional': return 90;
      case 'enterprise': return 365;
      default: return 30;
    }
  }

  /**
   * Get features for subscription tier
   */
  private getFeaturesForTier(): string[] {
    const tier = this.get('subscription_tier');
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

  /**
   * Find organization by domain
   */
  static async findByDomain(db: DatabaseConnectionManager, domain: string): Promise<Organization | null> {
    const org = new Organization(db);
    return org.findOne({ where: { domain } });
  }

  /**
   * Get organization usage report
   */
  async getUsageReport(): Promise<any> {
    const limits = this.getSubscriptionLimits();
    const metrics = this.get('usage_metrics') || {};
    
    return {
      organization: {
        id: this.get('id'),
        name: this.get('name'),
        tier: this.get('subscription_tier')
      },
      usage: {
        agents: {
          used: metrics.agentsUsed || 0,
          limit: limits.maxAgents,
          percentage: Math.round(((metrics.agentsUsed || 0) / limits.maxAgents) * 100)
        },
        decisions: {
          used: metrics.decisionsCount || 0,
          limit: limits.maxDecisions,
          percentage: limits.maxDecisions === -1 ? 0 : 
            Math.round(((metrics.decisionsCount || 0) / limits.maxDecisions) * 100)
        },
        dataVolume: {
          used: metrics.dataVolume || 0,
          unit: 'MB'
        },
        apiCalls: {
          used: metrics.apiCalls || 0,
          monthly: true
        }
      },
      limits,
      isOverLimit: this.isOverLimit(),
      recommendations: this.getUsageRecommendations()
    };
  }

  /**
   * Check if organization is over limits
   */
  private isOverLimit(): boolean {
    const metrics = this.get('usage_metrics') || {};
    const limits = this.getSubscriptionLimits();
    
    return (metrics.agentsUsed || 0) > limits.maxAgents ||
           (limits.maxDecisions !== -1 && (metrics.decisionsCount || 0) > limits.maxDecisions);
  }

  /**
   * Get usage recommendations
   */
  private getUsageRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.get('usage_metrics') || {};
    const limits = this.getSubscriptionLimits();
    
    if ((metrics.agentsUsed || 0) > limits.maxAgents * 0.8) {
      recommendations.push('Consider upgrading your plan for more agents');
    }
    
    if (limits.maxDecisions !== -1 && (metrics.decisionsCount || 0) > limits.maxDecisions * 0.8) {
      recommendations.push('Approaching decision limit - consider upgrading');
    }
    
    if ((metrics.dataVolume || 0) > 1000) {
      recommendations.push('High data volume - consider archiving old data');
    }
    
    return recommendations;
  }
}

export default Organization;
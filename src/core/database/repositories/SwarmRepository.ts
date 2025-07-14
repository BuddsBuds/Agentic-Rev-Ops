/**
 * Swarm Repository
 * Specialized data access methods for SwarmConfiguration entities and related swarm data
 */

import { BaseRepository } from './BaseRepository';
import { DatabaseConnectionManager } from '../connection';
import { SwarmConfiguration, SwarmConfigurationData } from '../entities/SwarmConfiguration';

export interface SwarmMetrics {
  swarmId: string;
  swarmName: string;
  topology: string;
  agentCount: number;
  activeAgents: number;
  totalDecisions: number;
  successfulDecisions: number;
  avgConfidence: number;
  avgResponseTime: number;
  healthScore: number;
}

export interface DecisionAnalytics {
  decisionId: string;
  decisionType: string;
  confidence: number;
  participationRate: number;
  executionTime: number;
  outcome: 'success' | 'failure' | 'pending';
  agentVotes: number;
  humanApprovalRequired: boolean;
}

export class SwarmRepository extends BaseRepository<SwarmConfigurationData> {
  constructor(db: DatabaseConnectionManager) {
    super(db, {
      tableName: 'swarm_configurations',
      schema: 'swarm',
      entityClass: SwarmConfiguration
    });
  }

  /**
   * Find swarms by organization
   */
  async findByOrganization(organizationId: string, activeOnly: boolean = false): Promise<SwarmConfiguration[]> {
    const where: any = { organization_id: organizationId };
    if (activeOnly) {
      where.is_active = true;
    }
    
    return this.find({
      where,
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Find swarms by topology
   */
  async findByTopology(topology: string): Promise<SwarmConfiguration[]> {
    return this.find({
      where: { topology, is_active: true },
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Get swarm performance metrics
   */
  async getSwarmMetrics(swarmId?: string): Promise<SwarmMetrics[]> {
    let whereClause = 'WHERE sc.deleted_at IS NULL';
    const params: any[] = [];
    
    if (swarmId) {
      whereClause += ' AND sc.id = $1';
      params.push(swarmId);
    }
    
    const query = `
      SELECT 
        sc.id as swarm_id,
        sc.name as swarm_name,
        sc.topology,
        COUNT(a.id) as agent_count,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_agents,
        COUNT(d.id) as total_decisions,
        COUNT(CASE WHEN d.executed_at IS NOT NULL THEN 1 END) as successful_decisions,
        COALESCE(AVG(d.confidence_score), 0) as avg_confidence,
        COALESCE(AVG(EXTRACT(EPOCH FROM (d.executed_at - d.created_at)) * 1000), 0) as avg_response_time,
        CASE 
          WHEN COUNT(a.id) = 0 THEN 0
          ELSE (
            (COUNT(CASE WHEN a.status = 'active' THEN 1 END)::float / COUNT(a.id) * 0.4) +
            (COALESCE(AVG(d.confidence_score), 0.5) * 0.3) +
            (COALESCE(AVG(a.performance_score), 0.5) * 0.3)
          )
        END as health_score
      FROM swarm.swarm_configurations sc
      LEFT JOIN swarm.agents a ON sc.id = a.swarm_id AND a.deleted_at IS NULL
      LEFT JOIN swarm.decisions d ON sc.id = d.swarm_id AND d.created_at > NOW() - INTERVAL '30 days'
      ${whereClause}
      GROUP BY sc.id, sc.name, sc.topology
      ORDER BY health_score DESC, sc.created_at DESC
    `;
    
    const result = await this.executeQuery(query, params, { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get decision analytics
   */
  async getDecisionAnalytics(
    swarmId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<DecisionAnalytics[]> {
    let dateFilter = '';
    const params = [swarmId];
    
    if (startDate && endDate) {
      dateFilter = ' AND d.created_at BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }
    
    const query = `
      SELECT 
        d.id as decision_id,
        d.decision_type,
        d.confidence_score as confidence,
        d.participation_rate,
        COALESCE(EXTRACT(EPOCH FROM (d.executed_at - d.created_at)) * 1000, 0) as execution_time,
        CASE 
          WHEN d.executed_at IS NOT NULL THEN 'success'
          WHEN d.created_at < NOW() - INTERVAL '1 hour' AND d.executed_at IS NULL THEN 'failure'
          ELSE 'pending'
        END as outcome,
        COUNT(av.id) as agent_votes,
        d.requires_human_approval as human_approval_required
      FROM swarm.decisions d
      LEFT JOIN swarm.agent_votes av ON d.id = av.decision_id
      WHERE d.swarm_id = $1 ${dateFilter}
      GROUP BY d.id, d.decision_type, d.confidence_score, d.participation_rate, 
               d.executed_at, d.created_at, d.requires_human_approval
      ORDER BY d.created_at DESC
      LIMIT ${limit}
    `;
    
    const result = await this.executeQuery(query, params, { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get agent performance within swarms
   */
  async getAgentPerformance(swarmId?: string): Promise<any[]> {
    let whereClause = 'WHERE a.deleted_at IS NULL';
    const params: any[] = [];
    
    if (swarmId) {
      whereClause += ' AND a.swarm_id = $1';
      params.push(swarmId);
    }
    
    const query = `
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.type as agent_type,
        a.swarm_id,
        sc.name as swarm_name,
        a.performance_score,
        a.weight,
        a.status,
        COUNT(av.id) as total_votes,
        AVG(av.confidence) as avg_vote_confidence,
        COUNT(CASE WHEN d.executed_at IS NOT NULL AND av.option = d.winning_option THEN 1 END) as successful_votes,
        a.last_active_at
      FROM swarm.agents a
      JOIN swarm.swarm_configurations sc ON a.swarm_id = sc.id
      LEFT JOIN swarm.agent_votes av ON a.id = av.agent_id
      LEFT JOIN swarm.decisions d ON av.decision_id = d.id
      ${whereClause}
      GROUP BY a.id, a.name, a.type, a.swarm_id, sc.name, a.performance_score, 
               a.weight, a.status, a.last_active_at
      ORDER BY a.performance_score DESC, a.last_active_at DESC
    `;
    
    const result = await this.executeQuery(query, params, { useReadReplica: true });
    return result.rows;
  }

  /**
   * Get swarm memory analytics
   */
  async getMemoryAnalytics(swarmId: string): Promise<any> {
    const queries = await Promise.all([
      // Memory distribution by type
      this.executeQuery(`
        SELECT 
          entry_type,
          COUNT(*) as count,
          AVG(relevance) as avg_relevance
        FROM swarm.memory_entries 
        WHERE swarm_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY entry_type
        ORDER BY count DESC
      `, [swarmId], { useReadReplica: true }),
      
      // Memory growth over time
      this.executeQuery(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as memories_created
        FROM swarm.memory_entries 
        WHERE swarm_id = $1 AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [swarmId], { useReadReplica: true }),
      
      // Top tags
      this.executeQuery(`
        SELECT 
          unnest(tags) as tag,
          COUNT(*) as frequency
        FROM swarm.memory_entries 
        WHERE swarm_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY tag
        ORDER BY frequency DESC
        LIMIT 10
      `, [swarmId], { useReadReplica: true }),
      
      // Memory health
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_memories,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 END) as expired_memories,
          AVG(relevance) as avg_relevance,
          COUNT(CASE WHEN relevance > 0.8 THEN 1 END) as high_relevance_memories
        FROM swarm.memory_entries 
        WHERE swarm_id = $1
      `, [swarmId], { useReadReplica: true })
    ]);

    return {
      distribution: queries[0].rows,
      growth: queries[1].rows,
      topTags: queries[2].rows,
      health: queries[3].rows[0]
    };
  }

  /**
   * Get neural patterns analysis
   */
  async getNeuralPatterns(swarmId: string): Promise<any[]> {
    const query = `
      SELECT 
        np.id,
        np.pattern_type,
        np.occurrences,
        np.success_rate,
        np.confidence,
        np.last_occurrence,
        np.pattern_data,
        CASE 
          WHEN np.success_rate > 0.8 AND np.occurrences > 5 THEN 'strong'
          WHEN np.success_rate > 0.6 AND np.occurrences > 3 THEN 'moderate'
          WHEN np.success_rate > 0.4 THEN 'weak'
          ELSE 'unreliable'
        END as pattern_strength
      FROM swarm.neural_patterns np
      WHERE np.swarm_id = $1
      ORDER BY np.success_rate DESC, np.occurrences DESC
    `;
    
    const result = await this.executeQuery(query, [swarmId], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Create decision with full context
   */
  async createDecisionWithContext(
    swarmId: string,
    decisionData: {
      decision_type: string;
      context: any;
      requires_human_approval?: boolean;
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<string> {
    return this.db.transaction(async () => {
      // Create decision
      const decisionQuery = `
        INSERT INTO swarm.decisions (id, swarm_id, decision_type, context, requires_human_approval)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const decisionId = crypto.randomUUID();
      await this.executeQuery(decisionQuery, [
        decisionId,
        swarmId,
        decisionData.decision_type,
        JSON.stringify(decisionData.context),
        decisionData.requires_human_approval || false
      ]);
      
      // Create HITL review if required
      if (decisionData.requires_human_approval) {
        const reviewQuery = `
          INSERT INTO audit.hitl_reviews (id, organization_id, swarm_id, decision_id, review_type, context, priority)
          SELECT $1, sc.organization_id, $2, $3, 'approval', $4, $5
          FROM swarm.swarm_configurations sc
          WHERE sc.id = $2
        `;
        
        const reviewId = crypto.randomUUID();
        await this.executeQuery(reviewQuery, [
          reviewId,
          swarmId,
          decisionId,
          JSON.stringify({
            decision_type: decisionData.decision_type,
            requires_review: true
          }),
          decisionData.priority || 'medium'
        ]);
      }
      
      return decisionId;
    });
  }

  /**
   * Get swarm collaboration metrics
   */
  async getCollaborationMetrics(swarmId: string): Promise<any> {
    const queries = await Promise.all([
      // Agent interaction frequency
      this.executeQuery(`
        SELECT 
          a1.name as agent1,
          a2.name as agent2,
          COUNT(*) as interaction_count
        FROM swarm.agent_votes av1
        JOIN swarm.agent_votes av2 ON av1.decision_id = av2.decision_id AND av1.agent_id != av2.agent_id
        JOIN swarm.agents a1 ON av1.agent_id = a1.id
        JOIN swarm.agents a2 ON av2.agent_id = a2.id
        WHERE a1.swarm_id = $1 AND a2.swarm_id = $1
        GROUP BY a1.id, a1.name, a2.id, a2.name
        ORDER BY interaction_count DESC
        LIMIT 20
      `, [swarmId], { useReadReplica: true }),
      
      // Consensus patterns
      this.executeQuery(`
        SELECT 
          d.decision_type,
          AVG(d.participation_rate) as avg_participation,
          AVG(d.confidence_score) as avg_confidence,
          COUNT(*) as decision_count
        FROM swarm.decisions d
        WHERE d.swarm_id = $1 AND d.created_at > NOW() - INTERVAL '30 days'
        GROUP BY d.decision_type
        ORDER BY decision_count DESC
      `, [swarmId], { useReadReplica: true }),
      
      // Agent specialization analysis
      this.executeQuery(`
        SELECT 
          a.type as agent_type,
          d.decision_type,
          COUNT(*) as participation_count,
          AVG(av.confidence) as avg_confidence,
          COUNT(CASE WHEN d.winning_option = av.option THEN 1 END) as winning_votes
        FROM swarm.agent_votes av
        JOIN swarm.agents a ON av.agent_id = a.id
        JOIN swarm.decisions d ON av.decision_id = d.id
        WHERE a.swarm_id = $1 AND d.created_at > NOW() - INTERVAL '30 days'
        GROUP BY a.type, d.decision_type
        HAVING COUNT(*) > 1
        ORDER BY avg_confidence DESC
      `, [swarmId], { useReadReplica: true })
    ]);

    return {
      interactions: queries[0].rows,
      consensus: queries[1].rows,
      specialization: queries[2].rows
    };
  }

  /**
   * Optimize swarm performance
   */
  async optimizeSwarm(swarmId: string): Promise<{
    recommendations: string[];
    metrics: any;
    changes: any;
  }> {
    const metrics = await this.getSwarmMetrics(swarmId);
    const swarmMetric = metrics.find(m => m.swarmId === swarmId);
    
    if (!swarmMetric) {
      throw new Error('Swarm not found');
    }
    
    const recommendations: string[] = [];
    const changes: any = {};
    
    // Analyze agent utilization
    if (swarmMetric.activeAgents < swarmMetric.agentCount * 0.5) {
      recommendations.push('Remove inactive agents to improve efficiency');
    } else if (swarmMetric.activeAgents === swarmMetric.agentCount && swarmMetric.avgResponseTime > 5000) {
      recommendations.push('Consider adding more agents to reduce response time');
    }
    
    // Analyze decision quality
    if (swarmMetric.avgConfidence < 0.7) {
      recommendations.push('Increase voting threshold to improve decision quality');
      changes.voting_threshold = 0.8;
    }
    
    // Analyze health score
    if (swarmMetric.healthScore < 0.6) {
      recommendations.push('Swarm health is poor - consider retraining agents');
    }
    
    return {
      recommendations,
      metrics: swarmMetric,
      changes
    };
  }

  /**
   * Archive old decisions and memory entries
   */
  async archiveOldData(swarmId: string, olderThanDays: number = 90): Promise<{
    decisionsArchived: number;
    memoriesArchived: number;
  }> {
    return this.db.transaction(async () => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      // Archive old decisions
      const decisionsResult = await this.executeQuery(`
        UPDATE swarm.decisions 
        SET deleted_at = NOW() 
        WHERE swarm_id = $1 AND created_at < $2 AND deleted_at IS NULL
        RETURNING id
      `, [swarmId, cutoffDate]);
      
      // Archive old memory entries
      const memoriesResult = await this.executeQuery(`
        DELETE FROM swarm.memory_entries 
        WHERE swarm_id = $1 AND created_at < $2
        RETURNING id
      `, [swarmId, cutoffDate]);
      
      return {
        decisionsArchived: decisionsResult.rows.length,
        memoriesArchived: memoriesResult.rows.length
      };
    });
  }

  /**
   * Get swarm health report
   */
  async getHealthReport(swarmId: string): Promise<any> {
    const metrics = await this.getSwarmMetrics(swarmId);
    const collaboration = await this.getCollaborationMetrics(swarmId);
    const memory = await this.getMemoryAnalytics(swarmId);
    const patterns = await this.getNeuralPatterns(swarmId);
    
    const swarmMetric = metrics.find(m => m.swarmId === swarmId);
    
    return {
      overall: swarmMetric,
      collaboration,
      memory,
      patterns: {
        total: patterns.length,
        strong: patterns.filter(p => p.pattern_strength === 'strong').length,
        moderate: patterns.filter(p => p.pattern_strength === 'moderate').length,
        weak: patterns.filter(p => p.pattern_strength === 'weak').length
      },
      recommendations: this.generateHealthRecommendations(swarmMetric, collaboration, memory)
    };
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(
    metrics: any,
    collaboration: any,
    memory: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics?.healthScore < 0.5) {
      recommendations.push('Overall swarm health is poor - immediate attention required');
    }
    
    if (metrics?.avgConfidence < 0.6) {
      recommendations.push('Decision confidence is low - consider agent retraining');
    }
    
    if (collaboration?.consensus?.length === 0) {
      recommendations.push('No recent consensus patterns - check agent coordination');
    }
    
    if (memory?.health?.avg_relevance < 0.5) {
      recommendations.push('Memory relevance is low - consider memory cleanup');
    }
    
    if (memory?.health?.total_memories > 1000) {
      recommendations.push('High memory usage - consider archiving old entries');
    }
    
    return recommendations;
  }
}

export default SwarmRepository;
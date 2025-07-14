"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmConfiguration = void 0;
const base_1 = require("./base");
class SwarmConfiguration extends base_1.BaseEntity {
    constructor(db, data) {
        super(db, 'swarm_configurations', 'swarm', data);
    }
    createInstance(data) {
        return new SwarmConfiguration(this.db, data);
    }
    validate() {
        const data = this.getData();
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Swarm name is required');
        }
        if (!data.organization_id) {
            throw new Error('Organization ID is required');
        }
        if (!['hierarchical', 'mesh', 'ring', 'star'].includes(data.topology)) {
            throw new Error('Invalid topology type');
        }
        if (!['consensus', 'majority', 'weighted', 'adaptive'].includes(data.strategy)) {
            throw new Error('Invalid strategy type');
        }
        if (data.max_agents <= 0 || data.max_agents > 100) {
            throw new Error('Max agents must be between 1 and 100');
        }
        if (data.voting_threshold < 0 || data.voting_threshold > 1) {
            throw new Error('Voting threshold must be between 0 and 1');
        }
        if (data.auto_execution_threshold < 0 || data.auto_execution_threshold > 1) {
            throw new Error('Auto execution threshold must be between 0 and 1');
        }
    }
    async beforeSave() {
        this.validate();
        if (!this.get('configuration')) {
            this.set('configuration', this.getDefaultConfiguration());
        }
        if (!this.get('metrics')) {
            this.set('metrics', {
                total_decisions: 0,
                successful_decisions: 0,
                avg_response_time: 0,
                agent_satisfaction: 0.5
            });
        }
    }
    async getAgents() {
        const query = `
      SELECT 
        id as agent_id,
        type as agent_type,
        capabilities,
        weight,
        status,
        performance_score
      FROM swarm.agents 
      WHERE swarm_id = $1 AND deleted_at IS NULL
      ORDER BY weight DESC, created_at ASC
    `;
        const result = await this.query(query, [this.get('id')], { useReadReplica: true });
        return result.rows;
    }
    async addAgent(agentConfig) {
        const currentAgents = await this.getAgents();
        if (currentAgents.length >= this.get('max_agents')) {
            throw new Error('Swarm is at maximum capacity');
        }
        const query = `
      INSERT INTO swarm.agents (id, swarm_id, name, type, capabilities, weight, status, performance_score)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', 0.5)
      RETURNING id
    `;
        const agentId = crypto.randomUUID();
        const result = await this.query(query, [
            agentId,
            this.get('id'),
            agentConfig.name,
            agentConfig.type,
            JSON.stringify(agentConfig.capabilities),
            agentConfig.weight || 1.0
        ]);
        return result.rows[0].id;
    }
    async removeAgent(agentId) {
        const query = `
      UPDATE swarm.agents 
      SET deleted_at = NOW() 
      WHERE id = $1 AND swarm_id = $2
    `;
        await this.query(query, [agentId, this.get('id')]);
    }
    async getDecisions(limit = 50) {
        const query = `
      SELECT 
        d.*,
        COUNT(av.id) as vote_count,
        AVG(av.confidence) as avg_confidence
      FROM swarm.decisions d
      LEFT JOIN swarm.agent_votes av ON d.id = av.decision_id
      WHERE d.swarm_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT $2
    `;
        const result = await this.query(query, [this.get('id'), limit], { useReadReplica: true });
        return result.rows;
    }
    async createDecision(decisionData) {
        const query = `
      INSERT INTO swarm.decisions (id, swarm_id, decision_type, context, requires_human_approval)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
        const decisionId = crypto.randomUUID();
        const result = await this.query(query, [
            decisionId,
            this.get('id'),
            decisionData.decision_type,
            JSON.stringify(decisionData.context),
            decisionData.requires_human_approval || false
        ]);
        return result.rows[0].id;
    }
    async getMemoryEntries(query_params) {
        let query = `
      SELECT * FROM swarm.memory_entries 
      WHERE swarm_id = $1
    `;
        const params = [this.get('id')];
        let paramIndex = 2;
        if (query_params?.entry_type) {
            query += ` AND entry_type = $${paramIndex++}`;
            params.push(query_params.entry_type);
        }
        if (query_params?.relevance_threshold) {
            query += ` AND relevance >= $${paramIndex++}`;
            params.push(query_params.relevance_threshold);
        }
        query += ` ORDER BY relevance DESC, created_at DESC`;
        if (query_params?.limit) {
            query += ` LIMIT $${paramIndex++}`;
            params.push(query_params.limit);
        }
        const result = await this.query(query, params, { useReadReplica: true });
        return result.rows;
    }
    async storeMemory(memoryData) {
        const query = `
      INSERT INTO swarm.memory_entries (id, swarm_id, entry_type, content, relevance, tags, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
        const memoryId = crypto.randomUUID();
        const result = await this.query(query, [
            memoryId,
            this.get('id'),
            memoryData.entry_type,
            JSON.stringify(memoryData.content),
            memoryData.relevance || 0.5,
            memoryData.tags || [],
            memoryData.expires_at
        ]);
        return result.rows[0].id;
    }
    async getPerformanceMetrics() {
        const queries = await Promise.all([
            this.query(`
        SELECT 
          COUNT(*) as total_decisions,
          COUNT(CASE WHEN executed_at IS NOT NULL THEN 1 END) as executed_decisions,
          AVG(confidence_score) as avg_confidence,
          AVG(participation_rate) as avg_participation
        FROM swarm.decisions 
        WHERE swarm_id = $1
      `, [this.get('id')], { useReadReplica: true }),
            this.query(`
        SELECT 
          COUNT(*) as total_agents,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents,
          AVG(performance_score) as avg_performance
        FROM swarm.agents 
        WHERE swarm_id = $1 AND deleted_at IS NULL
      `, [this.get('id')], { useReadReplica: true }),
            this.query(`
        SELECT 
          COUNT(*) as total_memories,
          AVG(relevance) as avg_relevance
        FROM swarm.memory_entries 
        WHERE swarm_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
      `, [this.get('id')], { useReadReplica: true }),
            this.query(`
        SELECT 
          COUNT(*) as total_patterns,
          AVG(success_rate) as avg_pattern_success,
          AVG(confidence) as avg_pattern_confidence
        FROM swarm.neural_patterns 
        WHERE swarm_id = $1
      `, [this.get('id')], { useReadReplica: true })
        ]);
        return {
            decisions: queries[0].rows[0],
            agents: queries[1].rows[0],
            memory: queries[2].rows[0],
            patterns: queries[3].rows[0],
            overall_health: this.calculateSwarmHealth(queries)
        };
    }
    async updateConfiguration(updates) {
        const currentConfig = this.get('configuration') || {};
        this.set('configuration', { ...currentConfig, ...updates });
        await this.save();
    }
    async activate() {
        this.set('is_active', true);
        await this.save();
        const query = `
      INSERT INTO audit.activity_logs (organization_id, action, entity_type, entity_id, details)
      VALUES ($1, 'activate', 'swarm', $2, $3)
    `;
        await this.query(query, [
            this.get('organization_id'),
            this.get('id'),
            JSON.stringify({ swarm_name: this.get('name') })
        ]);
    }
    async deactivate() {
        this.set('is_active', false);
        await this.save();
        const query = `
      UPDATE swarm.agents 
      SET status = 'disabled' 
      WHERE swarm_id = $1
    `;
        await this.query(query, [this.get('id')]);
        const logQuery = `
      INSERT INTO audit.activity_logs (organization_id, action, entity_type, entity_id, details)
      VALUES ($1, 'deactivate', 'swarm', $2, $3)
    `;
        await this.query(logQuery, [
            this.get('organization_id'),
            this.get('id'),
            JSON.stringify({ swarm_name: this.get('name') })
        ]);
    }
    async clone(newName) {
        const clonedData = { ...this.getData() };
        delete clonedData.id;
        delete clonedData.created_at;
        delete clonedData.updated_at;
        clonedData.name = newName;
        clonedData.is_active = false;
        const cloned = new SwarmConfiguration(this.db, clonedData);
        await cloned.save();
        return cloned;
    }
    async getTopologyData() {
        const agents = await this.getAgents();
        const topology = this.get('topology');
        const nodes = agents.map(agent => ({
            id: agent.agent_id,
            type: agent.agent_type,
            weight: agent.weight,
            status: agent.status,
            capabilities: agent.capabilities
        }));
        const edges = this.generateTopologyEdges(nodes, topology);
        return {
            topology,
            nodes,
            edges,
            metadata: {
                total_agents: nodes.length,
                active_agents: nodes.filter(n => n.status === 'active').length,
                avg_weight: nodes.reduce((sum, n) => sum + n.weight, 0) / nodes.length
            }
        };
    }
    async optimize() {
        const metrics = await this.getPerformanceMetrics();
        const suggestions = [];
        const changes = {};
        if (metrics.decisions.avg_confidence < 0.7) {
            suggestions.push('Consider increasing voting threshold for higher confidence decisions');
            changes.voting_threshold = Math.min(this.get('voting_threshold') + 0.1, 0.9);
        }
        if (metrics.agents.active_agents < this.get('max_agents') * 0.5) {
            suggestions.push('Swarm is under-utilized - consider adding more agents or reducing max_agents');
            changes.max_agents = Math.max(metrics.agents.active_agents * 2, 3);
        }
        if (metrics.agents.avg_performance < 0.6) {
            suggestions.push('Agent performance is below optimal - consider retraining or replacing underperforming agents');
        }
        if (metrics.memory.total_memories > 1000) {
            suggestions.push('High memory usage - consider enabling compression or reducing retention');
            changes.configuration = {
                ...this.get('configuration'),
                learning_settings: {
                    ...this.get('configuration')?.learning_settings,
                    memory_retention_days: 30
                }
            };
        }
        return { suggestions, changes };
    }
    getDefaultConfiguration() {
        return {
            coordination_rules: {
                min_participation: 0.5,
                consensus_threshold: 0.7,
                timeout_minutes: 30
            },
            communication_protocols: ['direct', 'broadcast', 'hierarchical'],
            learning_settings: {
                pattern_detection: true,
                adaptive_thresholds: true,
                memory_retention_days: 90
            },
            security_settings: {
                require_human_approval: false,
                approval_roles: ['admin', 'manager'],
                sensitive_actions: ['delete', 'financial', 'security']
            },
            performance_settings: {
                timeout_ms: 300000,
                retry_attempts: 3,
                parallel_execution: true
            }
        };
    }
    calculateSwarmHealth(metrics) {
        const decisions = metrics[0].rows[0];
        const agents = metrics[1].rows[0];
        const memory = metrics[2].rows[0];
        const patterns = metrics[3].rows[0];
        let health = 0.5;
        if (decisions.total_decisions > 0) {
            const decisionHealth = ((decisions.avg_confidence || 0.5) * 0.5 +
                (decisions.avg_participation || 0.5) * 0.3 +
                ((decisions.executed_decisions / decisions.total_decisions) || 0.5) * 0.2);
            health += decisionHealth * 0.3;
        }
        if (agents.total_agents > 0) {
            const agentHealth = (((agents.active_agents / agents.total_agents) || 0.5) * 0.6 +
                (agents.avg_performance || 0.5) * 0.4);
            health += agentHealth * 0.4;
        }
        if (memory.total_memories > 0) {
            const memoryHealth = Math.min((memory.avg_relevance || 0.5) * 1.2, 1.0);
            health += memoryHealth * 0.2;
        }
        if (patterns.total_patterns > 0) {
            const patternHealth = (patterns.avg_pattern_success || 0.5);
            health += patternHealth * 0.1;
        }
        return Math.min(health, 1.0);
    }
    generateTopologyEdges(nodes, topology) {
        const edges = [];
        switch (topology) {
            case 'hierarchical':
                const coordinator = nodes.find(n => n.type === 'coordinator') || nodes[0];
                nodes.forEach(node => {
                    if (node.id !== coordinator.id) {
                        edges.push({
                            from: coordinator.id,
                            to: node.id,
                            type: 'hierarchical'
                        });
                    }
                });
                break;
            case 'mesh':
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        edges.push({
                            from: nodes[i].id,
                            to: nodes[j].id,
                            type: 'mesh'
                        });
                    }
                }
                break;
            case 'ring':
                for (let i = 0; i < nodes.length; i++) {
                    const nextIndex = (i + 1) % nodes.length;
                    edges.push({
                        from: nodes[i].id,
                        to: nodes[nextIndex].id,
                        type: 'ring'
                    });
                }
                break;
            case 'star':
                const hub = nodes.find(n => n.type === 'coordinator') || nodes[0];
                nodes.forEach(node => {
                    if (node.id !== hub.id) {
                        edges.push({
                            from: hub.id,
                            to: node.id,
                            type: 'star'
                        });
                    }
                });
                break;
        }
        return edges;
    }
    static async findByOrganization(db, organizationId, activeOnly = false) {
        const swarm = new SwarmConfiguration(db);
        const where = { organization_id: organizationId };
        if (activeOnly) {
            where.is_active = true;
        }
        return swarm.find({
            where,
            orderBy: 'created_at DESC'
        });
    }
}
exports.SwarmConfiguration = SwarmConfiguration;
exports.default = SwarmConfiguration;
//# sourceMappingURL=SwarmConfiguration.js.map
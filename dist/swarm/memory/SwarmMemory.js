"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmMemory = void 0;
const events_1 = require("events");
class SwarmMemory extends events_1.EventEmitter {
    config;
    memory;
    decisionHistory;
    patterns;
    indices;
    constructor(config) {
        super();
        this.config = {
            maxEntries: config.maxEntries || 10000,
            compressionEnabled: config.compressionEnabled ?? true,
            patternDetectionEnabled: config.patternDetectionEnabled ?? true,
            ...config
        };
        this.memory = new Map();
        this.decisionHistory = [];
        this.patterns = new Map();
        this.indices = {
            byType: new Map(),
            byTag: new Map(),
            byDate: new Map()
        };
        this.startCleanupInterval();
    }
    async initialize() {
        await this.loadPersistedMemory();
        if (this.config.patternDetectionEnabled) {
        }
        this.emit('memory:initialized', {
            entryCount: this.memory.size,
            patternCount: this.patterns.size
        });
    }
    async storeDecision(decision) {
        const entry = {
            id: `mem_decision_${decision.id}`,
            type: 'decision',
            content: decision,
            timestamp: new Date(),
            relevance: 1.0,
            tags: [
                decision.type,
                `majority-${decision.majority.legitimacy}`,
                `participation-${Math.round(decision.majority.participation.participationRate * 100)}`
            ]
        };
        await this.store(entry);
        this.decisionHistory.push(decision);
        if (this.config.patternDetectionEnabled) {
            await this.detectPatterns(entry);
        }
    }
    async storeAgentReport(report) {
        const entry = {
            id: `mem_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'agent-report',
            content: report,
            timestamp: new Date(),
            relevance: report.confidence || 0.5,
            tags: [
                report.agentType,
                report.topic,
                `confidence-${Math.round((report.confidence || 0.5) * 100)}`
            ]
        };
        await this.store(entry);
    }
    async store(entry) {
        if (this.memory.size >= this.config.maxEntries) {
            await this.evictOldestEntries(Math.floor(this.config.maxEntries * 0.1));
        }
        this.memory.set(entry.id, entry);
        this.updateIndices(entry);
        if (this.config.compressionEnabled && this.memory.size % 100 === 0) {
            await this.compressMemory();
        }
        this.emit('memory:stored', { entryId: entry.id, type: entry.type });
    }
    async retrieve(query) {
        let candidates = new Set();
        if (!query.type && !query.tags?.length) {
            candidates = new Set(this.memory.keys());
        }
        if (query.type) {
            const typeEntries = this.indices.byType.get(query.type);
            if (typeEntries) {
                if (candidates.size === 0) {
                    candidates = new Set(typeEntries);
                }
                else {
                    candidates = new Set([...candidates].filter(id => typeEntries.has(id)));
                }
            }
        }
        if (query.tags && query.tags.length > 0) {
            for (const tag of query.tags) {
                const tagEntries = this.indices.byTag.get(tag);
                if (tagEntries) {
                    if (candidates.size === 0) {
                        candidates = new Set(tagEntries);
                    }
                    else {
                        candidates = new Set([...candidates].filter(id => tagEntries.has(id)));
                    }
                }
            }
        }
        let results = [];
        for (const id of candidates) {
            const entry = this.memory.get(id);
            if (!entry)
                continue;
            if (query.startDate && entry.timestamp < query.startDate)
                continue;
            if (query.endDate && entry.timestamp > query.endDate)
                continue;
            if (query.relevanceThreshold && entry.relevance < query.relevanceThreshold)
                continue;
            results.push(entry);
        }
        results.sort((a, b) => {
            const relevanceDiff = b.relevance - a.relevance;
            if (Math.abs(relevanceDiff) > 0.1)
                return relevanceDiff;
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
        if (query.limit) {
            results = results.slice(0, query.limit);
        }
        return results;
    }
    async getDecisionHistory() {
        return [...this.decisionHistory];
    }
    async findSimilarDecisions(type, context) {
        const similar = [];
        for (const decision of this.decisionHistory) {
            if (decision.type === type) {
                const similarity = this.calculateSimilarity(decision.majority.winner.value, context);
                if (similarity > 0.7) {
                    similar.push({
                        decision,
                        similarity,
                        successful: this.wasDecisionSuccessful(decision)
                    });
                }
            }
        }
        similar.sort((a, b) => b.similarity - a.similarity);
        return similar.slice(0, 5);
    }
    async analyzeDecisionPatterns(decisions) {
        const patterns = [];
        const grouped = new Map();
        for (const decision of decisions) {
            const key = `${decision.type}_${decision.majority.winner.id}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(decision);
        }
        for (const [key, group] of grouped) {
            if (group.length >= 3) {
                const successCount = group.filter(d => this.wasDecisionSuccessful(d)).length;
                patterns.push({
                    id: `pattern_${key}`,
                    type: 'decision-pattern',
                    occurrences: group.length,
                    successRate: successCount / group.length,
                    context: {
                        decisionType: group[0].type,
                        winningOption: group[0].majority.winner
                    }
                });
            }
        }
        return patterns;
    }
    async getHealthStatus() {
        const entries = Array.from(this.memory.values());
        const timestamps = entries.map(e => e.timestamp.getTime());
        return {
            status: this.calculateHealthStatus(),
            usage: this.memory.size / this.config.maxEntries,
            entryCount: this.memory.size,
            oldestEntry: timestamps.length > 0 ?
                new Date(Math.min(...timestamps)) : undefined,
            newestEntry: timestamps.length > 0 ?
                new Date(Math.max(...timestamps)) : undefined,
            compressionRatio: this.config.compressionEnabled ?
                this.getCompressionRatio() : undefined
        };
    }
    updateIndices(entry) {
        if (!this.indices.byType.has(entry.type)) {
            this.indices.byType.set(entry.type, new Set());
        }
        this.indices.byType.get(entry.type).add(entry.id);
        for (const tag of entry.tags) {
            if (!this.indices.byTag.has(tag)) {
                this.indices.byTag.set(tag, new Set());
            }
            this.indices.byTag.get(tag).add(entry.id);
        }
        const dateKey = entry.timestamp.toISOString().split('T')[0];
        if (!this.indices.byDate.has(dateKey)) {
            this.indices.byDate.set(dateKey, new Set());
        }
        this.indices.byDate.get(dateKey).add(entry.id);
    }
    async detectPatterns(entry) {
        if (entry.type !== 'decision')
            return;
        const recentDecisions = await this.retrieve({
            type: 'decision',
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            limit: 50
        });
        const patterns = await this.analyzeDecisionPatterns(recentDecisions.map(e => e.content));
        for (const pattern of patterns) {
            this.patterns.set(pattern.id, pattern);
            if (pattern.successRate > 0.8) {
                this.emit('memory:pattern-detected', pattern);
            }
        }
    }
    async evictOldestEntries(count) {
        const entries = Array.from(this.memory.entries())
            .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
        for (let i = 0; i < Math.min(count, entries.length); i++) {
            const [id, entry] = entries[i];
            this.memory.delete(id);
            this.removeFromIndices(entry);
        }
        this.emit('memory:evicted', { count });
    }
    removeFromIndices(entry) {
        this.indices.byType.get(entry.type)?.delete(entry.id);
        for (const tag of entry.tags) {
            this.indices.byTag.get(tag)?.delete(entry.id);
        }
        const dateKey = entry.timestamp.toISOString().split('T')[0];
        this.indices.byDate.get(dateKey)?.delete(entry.id);
    }
    async compressMemory() {
        const compressed = 0;
        if (compressed > 0) {
            this.emit('memory:compressed', { entriesCompressed: compressed });
        }
    }
    calculateSimilarity(context1, context2) {
        const str1 = JSON.stringify(context1);
        const str2 = JSON.stringify(context2);
        if (str1 === str2)
            return 1.0;
        const keys1 = Object.keys(context1 || {});
        const keys2 = Object.keys(context2 || {});
        const commonKeys = keys1.filter(k => keys2.includes(k));
        if (keys1.length === 0 || keys2.length === 0)
            return 0;
        return commonKeys.length / Math.max(keys1.length, keys2.length);
    }
    wasDecisionSuccessful(decision) {
        return decision.majority.legitimacy === 'valid' &&
            decision.majority.participation.participationRate > 0.7;
    }
    calculateHealthStatus() {
        const usage = this.memory.size / this.config.maxEntries;
        if (usage < 0.7)
            return 'healthy';
        if (usage < 0.9)
            return 'degraded';
        return 'critical';
    }
    getCompressionRatio() {
        return 1.0;
    }
    async loadPersistedMemory() {
    }
    startCleanupInterval() {
        setInterval(() => {
            const cutoffDate = new Date(Date.now() - this.config.retentionPeriod);
            for (const [id, entry] of this.memory) {
                if (entry.timestamp < cutoffDate) {
                    this.memory.delete(id);
                    this.removeFromIndices(entry);
                }
            }
        }, 60 * 60 * 1000);
    }
}
exports.SwarmMemory = SwarmMemory;
//# sourceMappingURL=SwarmMemory.js.map
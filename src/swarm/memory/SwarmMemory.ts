/**
 * Swarm Memory System
 * Persistent memory storage and retrieval for swarm decision-making
 */

import { EventEmitter } from 'events';
import { QueenDecision } from '../queen/QueenAgent';
import { MemoryEntry, Pattern } from '../types';

export interface SwarmMemoryConfig {
  retentionPeriod: number; // milliseconds
  maxEntries?: number;
  compressionEnabled?: boolean;
  patternDetectionEnabled?: boolean;
}

export interface MemoryQuery {
  type?: string;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  relevanceThreshold?: number;
  limit?: number;
}

export interface MemoryHealth {
  status: 'healthy' | 'degraded' | 'critical';
  usage: number; // 0-1
  entryCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  compressionRatio?: number;
}

export interface DecisionPattern {
  pattern: string;
  frequency: number;
  avgSuccessRate: number;
  contexts: Record<string, any>[];
  recommendations: string[];
}

export class SwarmMemory extends EventEmitter {
  private config: SwarmMemoryConfig;
  private memory: Map<string, MemoryEntry>;
  private decisionHistory: QueenDecision[];
  private patterns: Map<string, Pattern>;
  private indices: {
    byType: Map<string, Set<string>>;
    byTag: Map<string, Set<string>>;
    byDate: Map<string, Set<string>>; // YYYY-MM-DD -> entry IDs
  };
  
  constructor(config: SwarmMemoryConfig) {
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
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Initialize memory system
   */
  async initialize(): Promise<void> {
    // Load persisted memory if available
    await this.loadPersistedMemory();
    
    // Initialize pattern detection
    if (this.config.patternDetectionEnabled) {
      // Pattern detection is initialized on-demand
    }
    
    this.emit('memory:initialized', {
      entryCount: this.memory.size,
      patternCount: this.patterns.size
    });
  }

  /**
   * Store a decision in memory
   */
  async storeDecision(decision: QueenDecision): Promise<void> {
    const entry: MemoryEntry = {
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
    
    // Detect patterns if enabled
    if (this.config.patternDetectionEnabled) {
      await this.detectPatterns(entry);
    }
  }

  /**
   * Store an agent report
   */
  async storeAgentReport(report: any): Promise<void> {
    const entry: MemoryEntry = {
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

  /**
   * Store a general memory entry
   */
  async store(entry: MemoryEntry): Promise<void> {
    // Check memory limits
    if (this.memory.size >= this.config.maxEntries!) {
      await this.evictOldestEntries(Math.floor(this.config.maxEntries! * 0.1)); // Evict 10%
    }
    
    // Store entry
    this.memory.set(entry.id, entry);
    
    // Update indices
    this.updateIndices(entry);
    
    // Compress if enabled
    if (this.config.compressionEnabled && this.memory.size % 100 === 0) {
      await this.compressMemory();
    }
    
    this.emit('memory:stored', { entryId: entry.id, type: entry.type });
  }

  /**
   * Retrieve memories based on query
   */
  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    let candidates = new Set<string>();
    
    // Start with all entries if no filters
    if (!query.type && !query.tags?.length) {
      candidates = new Set(this.memory.keys());
    }
    
    // Filter by type
    if (query.type) {
      const typeEntries = this.indices.byType.get(query.type);
      if (typeEntries) {
        if (candidates.size === 0) {
          candidates = new Set(typeEntries);
        } else {
          candidates = new Set([...candidates].filter(id => typeEntries.has(id)));
        }
      }
    }
    
    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        const tagEntries = this.indices.byTag.get(tag);
        if (tagEntries) {
          if (candidates.size === 0) {
            candidates = new Set(tagEntries);
          } else {
            candidates = new Set([...candidates].filter(id => tagEntries.has(id)));
          }
        }
      }
    }
    
    // Convert to entries and apply additional filters
    let results: MemoryEntry[] = [];
    
    for (const id of candidates) {
      const entry = this.memory.get(id);
      if (!entry) continue;
      
      // Date filter
      if (query.startDate && entry.timestamp < query.startDate) continue;
      if (query.endDate && entry.timestamp > query.endDate) continue;
      
      // Relevance filter
      if (query.relevanceThreshold && entry.relevance < query.relevanceThreshold) continue;
      
      results.push(entry);
    }
    
    // Sort by relevance and timestamp
    results.sort((a, b) => {
      const relevanceDiff = b.relevance - a.relevance;
      if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }

  /**
   * Get decision history
   */
  async getDecisionHistory(): Promise<QueenDecision[]> {
    return [...this.decisionHistory];
  }

  /**
   * Find similar decisions
   */
  async findSimilarDecisions(
    type: string,
    context: any
  ): Promise<any[]> {
    const similar: any[] = [];
    
    for (const decision of this.decisionHistory) {
      if (decision.type === type) {
        // Calculate similarity score
        const similarity = this.calculateSimilarity(
          decision.majority.winner.value,
          context
        );
        
        if (similarity > 0.7) {
          similar.push({
            decision,
            similarity,
            successful: this.wasDecisionSuccessful(decision)
          });
        }
      }
    }
    
    // Sort by similarity
    similar.sort((a, b) => b.similarity - a.similarity);
    
    return similar.slice(0, 5); // Return top 5
  }

  /**
   * Analyze decision patterns
   */
  async analyzeDecisionPatterns(
    decisions: QueenDecision[]
  ): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // Group decisions by type and outcome
    const grouped = new Map<string, QueenDecision[]>();
    
    for (const decision of decisions) {
      const key = `${decision.type}_${decision.majority.winner.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(decision);
    }
    
    // Create patterns from groups
    for (const [key, group] of grouped) {
      if (group.length >= 3) { // Minimum 3 occurrences for a pattern
        const successCount = group.filter(d => 
          this.wasDecisionSuccessful(d)
        ).length;
        
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

  /**
   * Get memory health status
   */
  async getHealthStatus(): Promise<MemoryHealth> {
    const entries = Array.from(this.memory.values());
    const timestamps = entries.map(e => e.timestamp.getTime());
    
    return {
      status: this.calculateHealthStatus(),
      usage: this.memory.size / this.config.maxEntries!,
      entryCount: this.memory.size,
      oldestEntry: timestamps.length > 0 ? 
        new Date(Math.min(...timestamps)) : undefined,
      newestEntry: timestamps.length > 0 ? 
        new Date(Math.max(...timestamps)) : undefined,
      compressionRatio: this.config.compressionEnabled ? 
        this.getCompressionRatio() : undefined
    };
  }

  /**
   * Update indices for fast retrieval
   */
  private updateIndices(entry: MemoryEntry): void {
    // Type index
    if (!this.indices.byType.has(entry.type)) {
      this.indices.byType.set(entry.type, new Set());
    }
    this.indices.byType.get(entry.type)!.add(entry.id);
    
    // Tag indices
    for (const tag of entry.tags) {
      if (!this.indices.byTag.has(tag)) {
        this.indices.byTag.set(tag, new Set());
      }
      this.indices.byTag.get(tag)!.add(entry.id);
    }
    
    // Date index
    const dateKey = entry.timestamp.toISOString().split('T')[0];
    if (!this.indices.byDate.has(dateKey)) {
      this.indices.byDate.set(dateKey, new Set());
    }
    this.indices.byDate.get(dateKey)!.add(entry.id);
  }

  /**
   * Detect patterns in memory
   */
  private async detectPatterns(entry: MemoryEntry): Promise<void> {
    if (entry.type !== 'decision') return;
    
    // Look for similar recent decisions
    const recentDecisions = await this.retrieve({
      type: 'decision',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 50
    });
    
    // Analyze for patterns
    const patterns = await this.analyzeDecisionPatterns(
      recentDecisions.map(e => e.content as QueenDecision)
    );
    
    // Update pattern map
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern);
      
      if (pattern.successRate > 0.8) {
        this.emit('memory:pattern-detected', pattern);
      }
    }
  }

  /**
   * Evict oldest entries to free space
   */
  private async evictOldestEntries(count: number): Promise<void> {
    const entries = Array.from(this.memory.entries())
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [id, entry] = entries[i];
      this.memory.delete(id);
      
      // Clean up indices
      this.removeFromIndices(entry);
    }
    
    this.emit('memory:evicted', { count });
  }

  /**
   * Remove entry from indices
   */
  private removeFromIndices(entry: MemoryEntry): void {
    // Type index
    this.indices.byType.get(entry.type)?.delete(entry.id);
    
    // Tag indices
    for (const tag of entry.tags) {
      this.indices.byTag.get(tag)?.delete(entry.id);
    }
    
    // Date index
    const dateKey = entry.timestamp.toISOString().split('T')[0];
    this.indices.byDate.get(dateKey)?.delete(entry.id);
  }

  /**
   * Compress memory to save space
   */
  private async compressMemory(): Promise<void> {
    // Aggregate similar entries
    const compressed = 0; // Placeholder for compression logic
    
    if (compressed > 0) {
      this.emit('memory:compressed', { entriesCompressed: compressed });
    }
  }

  /**
   * Calculate similarity between contexts
   */
  private calculateSimilarity(context1: any, context2: any): number {
    // Simple similarity calculation - could be enhanced
    const str1 = JSON.stringify(context1);
    const str2 = JSON.stringify(context2);
    
    if (str1 === str2) return 1.0;
    
    // Calculate based on common properties
    const keys1 = Object.keys(context1 || {});
    const keys2 = Object.keys(context2 || {});
    const commonKeys = keys1.filter(k => keys2.includes(k));
    
    if (keys1.length === 0 || keys2.length === 0) return 0;
    
    return commonKeys.length / Math.max(keys1.length, keys2.length);
  }

  /**
   * Check if a decision was successful
   */
  private wasDecisionSuccessful(decision: QueenDecision): boolean {
    // Simplified success check - would need actual implementation tracking
    return decision.majority.legitimacy === 'valid' &&
           decision.majority.participation.participationRate > 0.7;
  }

  /**
   * Calculate health status
   */
  private calculateHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const usage = this.memory.size / this.config.maxEntries!;
    
    if (usage < 0.7) return 'healthy';
    if (usage < 0.9) return 'degraded';
    return 'critical';
  }

  /**
   * Get compression ratio
   */
  private getCompressionRatio(): number {
    // Placeholder for actual compression ratio calculation
    return 1.0;
  }

  /**
   * Load persisted memory from storage
   */
  private async loadPersistedMemory(): Promise<void> {
    // Would load from actual storage in production
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const cutoffDate = new Date(Date.now() - this.config.retentionPeriod);
      
      for (const [id, entry] of this.memory) {
        if (entry.timestamp < cutoffDate) {
          this.memory.delete(id);
          this.removeFromIndices(entry);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}
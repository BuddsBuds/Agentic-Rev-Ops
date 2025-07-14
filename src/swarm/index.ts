/**
 * Agentic RevOps Swarm System
 * Main entry point for the swarm-based revenue operations system
 */

export { QueenAgent } from './queen/QueenAgent';
export { MajorityEngine } from './consensus/MajorityEngine';
export { SwarmMemory } from './memory/SwarmMemory';

// Base classes
export { BaseAgent } from './agents/BaseAgent';

// Specialized agents
export { CRMAgent } from './agents/CRMAgent';
export { MarketingAgent } from './agents/MarketingAgent';
export { AnalyticsAgent } from './agents/AnalyticsAgent';

// Demo and visualization
export { SwarmDemo } from './demo/SwarmDemo';
export { SwarmVisualizer } from './visualization/SwarmVisualizer';

// Types
export * from './types';

// Main orchestrator class
export class RevOpsSwarm {
  private static instance: RevOpsSwarm;
  
  private constructor() {
    // Singleton pattern
  }

  static getInstance(): RevOpsSwarm {
    if (!RevOpsSwarm.instance) {
      RevOpsSwarm.instance = new RevOpsSwarm();
    }
    return RevOpsSwarm.instance;
  }

  /**
   * Initialize a new swarm with specified configuration
   */
  async createSwarm(config: {
    swarmId?: string;
    votingThreshold?: number;
    maxAgents?: number;
    enableVisualization?: boolean;
  }): Promise<SwarmInstance> {
    const swarmId = config.swarmId || `swarm_${Date.now()}`;
    
    // Create Queen
    const queen = new QueenAgent({
      swarmId,
      majorityThreshold: config.votingThreshold || 0.5,
      decisionTimeout: 30000,
      memoryRetention: 7 * 24 * 60 * 60 * 1000,
      tieBreakerRole: true
    });
    
    await queen.initialize();
    
    // Create visualization if enabled
    let visualizer;
    if (config.enableVisualization) {
      const { SwarmVisualizer } = await import('./visualization/SwarmVisualizer');
      visualizer = new SwarmVisualizer();
    }
    
    return {
      swarmId,
      queen,
      agents: new Map(),
      visualizer,
      
      async addAgent(agent: any): Promise<void> {
        await agent.initialize();
        queen.registerAgent(agent);
        this.agents.set(agent.getId(), agent);
        
        if (visualizer) {
          visualizer.registerAgent(
            agent.getId(),
            agent.getType(),
            agent.config.name
          );
        }
      },
      
      async makeDecision(topic: string, context: any): Promise<any> {
        return queen.makeStrategicDecision(topic, context);
      },
      
      async handleEmergency(situation: string, severity: 'high' | 'critical', context: any): Promise<any> {
        return queen.handleEmergency(situation, severity, context);
      },
      
      async getHealth(): Promise<any> {
        return queen.monitorSwarmHealth();
      },
      
      visualize(): void {
        if (visualizer) {
          visualizer.displaySwarmState();
        }
      }
    };
  }

  /**
   * Create a pre-configured RevOps swarm
   */
  async createRevOpsSwarm(options: {
    enableCRM?: boolean;
    enableMarketing?: boolean;
    enableAnalytics?: boolean;
    enableVisualization?: boolean;
  } = {}): Promise<SwarmInstance> {
    const swarm = await this.createSwarm({
      enableVisualization: options.enableVisualization
    });
    
    // Add default RevOps agents
    if (options.enableCRM !== false) {
      const { CRMAgent } = await import('./agents/CRMAgent');
      const crmAgent = new CRMAgent({
        id: `crm_${swarm.swarmId}`,
        name: 'CRM Specialist',
        capabilities: [],
        votingWeight: 1.2
      });
      await swarm.addAgent(crmAgent);
    }
    
    if (options.enableMarketing !== false) {
      const { MarketingAgent } = await import('./agents/MarketingAgent');
      const marketingAgent = new MarketingAgent({
        id: `marketing_${swarm.swarmId}`,
        name: 'Marketing Expert',
        capabilities: [],
        votingWeight: 1.1
      });
      await swarm.addAgent(marketingAgent);
    }
    
    if (options.enableAnalytics !== false) {
      const { AnalyticsAgent } = await import('./agents/AnalyticsAgent');
      const analyticsAgent = new AnalyticsAgent({
        id: `analytics_${swarm.swarmId}`,
        name: 'Analytics Master',
        capabilities: [],
        votingWeight: 1.3
      });
      await swarm.addAgent(analyticsAgent);
    }
    
    return swarm;
  }
}

// Type definitions
interface SwarmInstance {
  swarmId: string;
  queen: QueenAgent;
  agents: Map<string, any>;
  visualizer?: any;
  addAgent(agent: any): Promise<void>;
  makeDecision(topic: string, context: any): Promise<any>;
  handleEmergency(situation: string, severity: 'high' | 'critical', context: any): Promise<any>;
  getHealth(): Promise<any>;
  visualize(): void;
}

// Export singleton instance
export const revOpsSwarm = RevOpsSwarm.getInstance();
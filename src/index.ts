/**
 * Agentic Revenue Operations System
 * Main entry point for the application
 */

import { QueenAgent } from './swarm/queen/QueenAgent';
import { SwarmCoordinator } from './swarm/coordination/SwarmCoordinator';
import { CRMAgent } from './agents/specialized/CRMAgent';
import { MarketingAgent } from './agents/specialized/MarketingAgent';
import { AnalyticsAgent } from './agents/specialized/AnalyticsAgent';
import { SwarmMemory } from './swarm/memory/SwarmMemory';
import { MajorityEngine } from './swarm/consensus/MajorityEngine';
import { CommunicationProtocol } from './swarm/communication/CommunicationProtocol';
import { SwarmVisualizer } from './swarm/visualization/SwarmVisualizer';
import { HITLSystem } from './workflow/hitl/HITLSystem';
import { WorkflowSystem } from './workflow/WorkflowSystem';
import { DatabaseService } from './core/database/DatabaseService';

export interface AgenticRevOpsConfig {
  swarm?: {
    queenConfig?: any;
    majorityConfig?: any;
    memoryConfig?: any;
  };
  database?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  };
  hitl?: {
    enabled?: boolean;
    operators?: any[];
  };
  workflow?: {
    enabled?: boolean;
    features?: any;
  };
}

export class AgenticRevOpsSystem {
  private queen: QueenAgent;
  private coordinator: SwarmCoordinator;
  private memory: SwarmMemory;
  private majority: MajorityEngine;
  private protocol: CommunicationProtocol;
  private visualizer: SwarmVisualizer;
  private hitl?: HITLSystem;
  private workflow?: WorkflowSystem;
  private database?: DatabaseService;

  constructor(config: AgenticRevOpsConfig = {}) {
    // Initialize core components
    this.memory = new SwarmMemory(config.swarm?.memoryConfig);
    this.majority = new MajorityEngine(config.swarm?.majorityConfig);
    this.protocol = new CommunicationProtocol();
    this.visualizer = new SwarmVisualizer();
    
    // Initialize Queen
    this.queen = new QueenAgent(config.swarm?.queenConfig);
    
    // Initialize coordinator
    this.coordinator = new SwarmCoordinator({
      memory: this.memory,
      protocol: this.protocol,
      visualizer: this.visualizer
    });

    // Initialize optional systems
    if (config.hitl?.enabled !== false) {
      this.hitl = new HITLSystem(config.hitl);
    }

    if (config.workflow?.enabled !== false) {
      this.workflow = new WorkflowSystem(config.workflow);
    }
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Agentic RevOps System...');
    
    // Initialize database if configured
    if (this.database) {
      await this.database.initialize();
      console.log('✅ Database initialized');
    }

    // Initialize core agents
    const crmAgent = new CRMAgent('crm-specialist');
    const marketingAgent = new MarketingAgent('marketing-specialist');
    const analyticsAgent = new AnalyticsAgent('analytics-specialist');

    // Register agents with coordinator
    this.coordinator.registerAgent(crmAgent);
    this.coordinator.registerAgent(marketingAgent);
    this.coordinator.registerAgent(analyticsAgent);

    // Initialize HITL system
    if (this.hitl) {
      await this.hitl.initialize();
      console.log('✅ HITL system initialized');
    }

    // Initialize workflow system
    if (this.workflow) {
      await this.workflow.initialize();
      console.log('✅ Workflow system initialized');
    }

    console.log('🎯 Agentic RevOps System ready!');
  }

  async processRequest(request: {
    type: 'pipeline-optimization' | 'lead-qualification' | 'revenue-forecasting' | 'campaign-analysis';
    description: string;
    context?: any;
  }): Promise<any> {
    return await this.queen.makeStrategicDecision(request);
  }

  getSystemStatus(): any {
    return {
      queen: this.queen.getStatus(),
      coordinator: this.coordinator.getSystemStatus(),
      memory: this.memory.getStatus(),
      visualizer: this.visualizer.getSystemHealth(),
      hitl: this.hitl?.getSystemStatus(),
      workflow: this.workflow?.getSystemStatus()
    };
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Agentic RevOps System...');
    
    if (this.workflow) {
      await this.workflow.shutdown();
    }
    
    if (this.hitl) {
      await this.hitl.shutdown();
    }
    
    if (this.database) {
      await this.database.disconnect();
    }
    
    console.log('✅ System shutdown complete');
  }
}

// Main entry point
export default AgenticRevOpsSystem;

// Named exports
export {
  QueenAgent,
  SwarmCoordinator,
  CRMAgent,
  MarketingAgent,
  AnalyticsAgent,
  SwarmMemory,
  MajorityEngine,
  CommunicationProtocol,
  SwarmVisualizer,
  HITLSystem,
  WorkflowSystem,
  DatabaseService
};
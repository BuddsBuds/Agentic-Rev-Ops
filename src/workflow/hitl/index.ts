// Human-in-the-Loop (HITL) System - Main Export Module
// Comprehensive HITL management system for Agentic RevOps platform

// Core System
export { HITLSystem, type HITLSystemConfig, type HITLSystemStatus } from './HITLSystem';

// Core Components
export { 
  HITLOrchestrator, 
  type HITLDecision, 
  type AgentRecommendation,
  type HITLConfiguration 
} from './core/HITLOrchestrator';

export { 
  ReviewWorkflowEngine,
  type ReviewWorkflow,
  type WorkflowExecution,
  type ReviewStage
} from './review/ReviewWorkflowEngine';

export { 
  TaskDelegationManager,
  type DelegatedTask,
  type HumanOperator,
  type DelegationStrategy
} from './delegation/TaskDelegationManager';

export { 
  ProgressTracker,
  type ProgressSnapshot,
  type TrackingConfiguration,
  type SystemStatus
} from './tracking/ProgressTracker';

export { 
  SwarmIntegration,
  type HITLSwarmConfig,
  type SwarmDecisionRequest,
  type HITLResponse
} from './integration/SwarmIntegration';

// Interfaces
export { 
  HumanInTheLoopManager,
  type HITLManager,
  type HumanReviewRequest
} from './interfaces/hitl-manager';

// Demo and Examples
export { HITLDemo, runHITLDemo } from './examples/HITLDemo';

// Type definitions for external use
export interface HITLSystemInitConfig {
  swarmMemory: any;
  swarmCoordinator: any;
  systemConfig?: Partial<HITLSystemConfig>;
}

/**
 * Initialize and create a complete HITL system
 * 
 * @param config System initialization configuration
 * @returns Configured and initialized HITL system
 */
export async function createHITLSystem(config: HITLSystemInitConfig): Promise<HITLSystem> {
  const system = new HITLSystem(
    config.swarmMemory,
    config.swarmCoordinator,
    config.systemConfig
  );
  
  await system.initialize();
  return system;
}

/**
 * Create a demo HITL system for testing and demonstration
 * 
 * @returns Demo HITL system instance
 */
export async function createDemoHITLSystem(): Promise<HITLSystem> {
  // This would typically import actual implementations
  // For demo purposes, we'll create mock implementations
  const mockSwarmMemory = {
    store: async (key: string, value: any) => { /* mock implementation */ },
    retrieve: async (key: string) => { /* mock implementation */ },
    delete: async (key: string) => { /* mock implementation */ }
  };

  const mockSwarmCoordinator = {
    on: (event: string, handler: Function) => { /* mock implementation */ },
    emit: (event: string, data: any) => { /* mock implementation */ },
    executeDecision: async (decision: any) => { /* mock implementation */ },
    executeRecommendation: async (recommendation: any) => { /* mock implementation */ },
    applyAgentOverride: async (override: any) => { /* mock implementation */ },
    emergencyOverride: async (override: any) => { /* mock implementation */ },
    notifyAgent: async (agentId: string, notification: any) => { /* mock implementation */ },
    initiateRetraining: async (data: any) => { /* mock implementation */ },
    handleCriticalAlert: async (alert: any) => { /* mock implementation */ }
  };

  const demoConfig = {
    orchestrator: {
      autoApprovalThreshold: 0.85,
      escalationThreshold: 0.6,
      reviewTimeoutMinutes: 30,
      criticalDecisionRequiresApproval: true,
      financialImpactThreshold: 25000,
      enableLearningFromDecisions: true
    },
    tracking: {
      snapshotInterval: 2,
      alertThresholds: {
        timeOverrun: 20,
        qualityBelow: 3.5,
        riskAbove: 'medium',
        stakeholderSatisfactionBelow: 3.5
      }
    },
    swarmIntegration: {
      enableAutomaticDecisionRouting: true,
      confidenceThresholds: {
        autoApprove: 0.9,
        requireHuman: 0.7,
        escalate: 0.5
      }
    },
    systemSettings: {
      name: 'Demo HITL System',
      version: '1.0.0-demo',
      environment: 'development' as const,
      logLevel: 'info' as const,
      enableTelemetry: true,
      backupEnabled: true,
      maintenanceMode: false
    }
  };

  return createHITLSystem({
    swarmMemory: mockSwarmMemory,
    swarmCoordinator: mockSwarmCoordinator,
    systemConfig: demoConfig
  });
}

/**
 * HITL System feature flags and capabilities
 */
export const HITLCapabilities = {
  DECISION_ORCHESTRATION: 'decision_orchestration',
  TASK_DELEGATION: 'task_delegation',
  WORKFLOW_MANAGEMENT: 'workflow_management',
  PROGRESS_TRACKING: 'progress_tracking',
  SWARM_INTEGRATION: 'swarm_integration',
  LEARNING_ADAPTATION: 'learning_adaptation',
  EMERGENCY_OVERRIDE: 'emergency_override',
  REAL_TIME_MONITORING: 'real_time_monitoring'
} as const;

/**
 * Default HITL system configuration
 */
export const DefaultHITLConfig: HITLSystemConfig = {
  orchestrator: {
    autoApprovalThreshold: 0.9,
    escalationThreshold: 0.5,
    reviewTimeoutMinutes: 120,
    criticalDecisionRequiresApproval: true,
    financialImpactThreshold: 50000,
    enableLearningFromDecisions: true
  },
  tracking: {
    snapshotInterval: 5,
    alertThresholds: {
      timeOverrun: 25,
      qualityBelow: 3,
      riskAbove: 'high',
      stakeholderSatisfactionBelow: 3
    },
    escalationRules: [],
    reportingSchedule: [],
    retentionPolicy: {
      snapshotRetentionDays: 30,
      detailedRetentionDays: 90,
      archiveAfterDays: 365
    }
  },
  swarmIntegration: {
    enableAutomaticDecisionRouting: true,
    confidenceThresholds: {
      autoApprove: 0.9,
      requireHuman: 0.7,
      escalate: 0.5
    },
    swarmOverrides: {
      allowEmergencyOverride: true,
      emergencyOverrideRoles: ['senior-manager', 'director', 'executive'],
      maxOverrideWindow: 60
    },
    learningConfig: {
      enableLearningFromDecisions: true,
      retrainThreshold: 50,
      adaptThresholds: true
    },
    integrationPoints: {
      agentHooks: true,
      memoryIntegration: true,
      realTimeMonitoring: true,
      coordinatorIntegration: true
    }
  },
  enableComponents: {
    orchestrator: true,
    delegation: true,
    workflows: true,
    tracking: true,
    swarmIntegration: true
  },
  systemSettings: {
    name: 'HITL System',
    version: '1.0.0',
    environment: 'production',
    logLevel: 'info',
    enableTelemetry: true,
    backupEnabled: true,
    maintenanceMode: false
  }
};

/**
 * Quick-start helper functions
 */
export const HITLQuickStart = {
  /**
   * Create a minimal HITL system for basic human oversight
   */
  createBasicSystem: async (swarmMemory: any, swarmCoordinator: any) => {
    return createHITLSystem({
      swarmMemory,
      swarmCoordinator,
      systemConfig: {
        enableComponents: {
          orchestrator: true,
          delegation: false,
          workflows: false,
          tracking: true,
          swarmIntegration: true
        },
        systemSettings: {
          name: 'Basic HITL System',
          version: '1.0.0-basic',
          environment: 'development',
          logLevel: 'info'
        }
      }
    });
  },

  /**
   * Create a full-featured HITL system for production use
   */
  createProductionSystem: async (swarmMemory: any, swarmCoordinator: any) => {
    return createHITLSystem({
      swarmMemory,
      swarmCoordinator,
      systemConfig: DefaultHITLConfig
    });
  },

  /**
   * Create a development/testing HITL system
   */
  createDevelopmentSystem: async (swarmMemory: any, swarmCoordinator: any) => {
    return createHITLSystem({
      swarmMemory,
      swarmCoordinator,
      systemConfig: {
        ...DefaultHITLConfig,
        tracking: {
          ...DefaultHITLConfig.tracking,
          snapshotInterval: 1, // More frequent for development
          alertThresholds: {
            timeOverrun: 15,
            qualityBelow: 2.5,
            riskAbove: 'medium',
            stakeholderSatisfactionBelow: 2.5
          }
        },
        systemSettings: {
          ...DefaultHITLConfig.systemSettings,
          environment: 'development',
          logLevel: 'debug'
        }
      }
    });
  }
};

/**
 * HITL System utilities
 */
export const HITLUtils = {
  /**
   * Validate HITL system configuration
   */
  validateConfig: (config: Partial<HITLSystemConfig>): boolean => {
    // Basic validation logic
    if (config.orchestrator?.autoApprovalThreshold && 
        (config.orchestrator.autoApprovalThreshold < 0 || config.orchestrator.autoApprovalThreshold > 1)) {
      return false;
    }
    
    if (config.tracking?.snapshotInterval && config.tracking.snapshotInterval < 1) {
      return false;
    }
    
    return true;
  },

  /**
   * Generate system health report
   */
  generateHealthReport: async (system: HITLSystem): Promise<any> => {
    const status = system.getSystemStatus();
    const analytics = system.getSystemAnalytics();
    
    return {
      timestamp: new Date(),
      systemHealth: status.status,
      performanceScore: status.metrics.performanceScore,
      componentHealth: Object.values(status.components)
        .map(comp => ({ name: comp.name, status: comp.status })),
      keyMetrics: {
        decisions: status.metrics.totalDecisions,
        tasks: status.metrics.totalTasks,
        workflows: status.metrics.totalWorkflows,
        successRate: status.metrics.successRate
      },
      alerts: status.alerts.length,
      recommendations: HITLUtils.generateHealthRecommendations(status)
    };
  },

  /**
   * Generate health-based recommendations
   */
  generateHealthRecommendations: (status: HITLSystemStatus): string[] => {
    const recommendations: string[] = [];
    
    if (status.metrics.performanceScore < 70) {
      recommendations.push('System performance is below optimal - consider reviewing workload distribution');
    }
    
    if (status.metrics.currentLoad > 80) {
      recommendations.push('System load is high - consider scaling resources or adjusting thresholds');
    }
    
    if (status.alerts.length > 10) {
      recommendations.push('High number of active alerts - review alert configurations and resolve pending issues');
    }
    
    const degradedComponents = Object.values(status.components)
      .filter(comp => comp.status === 'degraded' || comp.status === 'error');
    
    if (degradedComponents.length > 0) {
      recommendations.push(`${degradedComponents.length} components need attention: ${degradedComponents.map(c => c.name).join(', ')}`);
    }
    
    return recommendations;
  }
};

/**
 * HITL System constants
 */
export const HITLConstants = {
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_AUTO_APPROVAL_THRESHOLD: 0.9,
  DEFAULT_ESCALATION_THRESHOLD: 0.5,
  DEFAULT_REVIEW_TIMEOUT_MINUTES: 120,
  DEFAULT_FINANCIAL_IMPACT_THRESHOLD: 50000,
  
  PRIORITY_LEVELS: ['low', 'medium', 'high', 'critical'] as const,
  RISK_LEVELS: ['low', 'medium', 'high', 'critical'] as const,
  DECISION_TYPES: ['strategic', 'approval', 'validation', 'override', 'escalation'] as const,
  
  COMPONENT_NAMES: {
    ORCHESTRATOR: 'orchestrator',
    DELEGATION: 'delegation',
    WORKFLOWS: 'workflows',
    TRACKING: 'tracking',
    SWARM_INTEGRATION: 'swarmIntegration'
  } as const
};

// Re-export main system class as default
export default HITLSystem;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HITLConstants = exports.HITLUtils = exports.HITLQuickStart = exports.DefaultHITLConfig = exports.HITLCapabilities = exports.runHITLDemo = exports.HITLDemo = exports.HumanInTheLoopManager = exports.SwarmIntegration = exports.ProgressTracker = exports.TaskDelegationManager = exports.ReviewWorkflowEngine = exports.HITLOrchestrator = exports.HITLSystem = void 0;
exports.createHITLSystem = createHITLSystem;
exports.createDemoHITLSystem = createDemoHITLSystem;
var HITLSystem_1 = require("./HITLSystem");
Object.defineProperty(exports, "HITLSystem", { enumerable: true, get: function () { return HITLSystem_1.HITLSystem; } });
var HITLOrchestrator_1 = require("./core/HITLOrchestrator");
Object.defineProperty(exports, "HITLOrchestrator", { enumerable: true, get: function () { return HITLOrchestrator_1.HITLOrchestrator; } });
var ReviewWorkflowEngine_1 = require("./review/ReviewWorkflowEngine");
Object.defineProperty(exports, "ReviewWorkflowEngine", { enumerable: true, get: function () { return ReviewWorkflowEngine_1.ReviewWorkflowEngine; } });
var TaskDelegationManager_1 = require("./delegation/TaskDelegationManager");
Object.defineProperty(exports, "TaskDelegationManager", { enumerable: true, get: function () { return TaskDelegationManager_1.TaskDelegationManager; } });
var ProgressTracker_1 = require("./tracking/ProgressTracker");
Object.defineProperty(exports, "ProgressTracker", { enumerable: true, get: function () { return ProgressTracker_1.ProgressTracker; } });
var SwarmIntegration_1 = require("./integration/SwarmIntegration");
Object.defineProperty(exports, "SwarmIntegration", { enumerable: true, get: function () { return SwarmIntegration_1.SwarmIntegration; } });
var hitl_manager_1 = require("./interfaces/hitl-manager");
Object.defineProperty(exports, "HumanInTheLoopManager", { enumerable: true, get: function () { return hitl_manager_1.HumanInTheLoopManager; } });
var HITLDemo_1 = require("./examples/HITLDemo");
Object.defineProperty(exports, "HITLDemo", { enumerable: true, get: function () { return HITLDemo_1.HITLDemo; } });
Object.defineProperty(exports, "runHITLDemo", { enumerable: true, get: function () { return HITLDemo_1.runHITLDemo; } });
async function createHITLSystem(config) {
    const system = new HITLSystem(config.swarmMemory, config.swarmCoordinator, config.systemConfig);
    await system.initialize();
    return system;
}
async function createDemoHITLSystem() {
    const mockSwarmMemory = {
        store: async (key, value) => { },
        retrieve: async (key) => { },
        delete: async (key) => { }
    };
    const mockSwarmCoordinator = {
        on: (event, handler) => { },
        emit: (event, data) => { },
        executeDecision: async (decision) => { },
        executeRecommendation: async (recommendation) => { },
        applyAgentOverride: async (override) => { },
        emergencyOverride: async (override) => { },
        notifyAgent: async (agentId, notification) => { },
        initiateRetraining: async (data) => { },
        handleCriticalAlert: async (alert) => { }
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
            environment: 'development',
            logLevel: 'info',
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
exports.HITLCapabilities = {
    DECISION_ORCHESTRATION: 'decision_orchestration',
    TASK_DELEGATION: 'task_delegation',
    WORKFLOW_MANAGEMENT: 'workflow_management',
    PROGRESS_TRACKING: 'progress_tracking',
    SWARM_INTEGRATION: 'swarm_integration',
    LEARNING_ADAPTATION: 'learning_adaptation',
    EMERGENCY_OVERRIDE: 'emergency_override',
    REAL_TIME_MONITORING: 'real_time_monitoring'
};
exports.DefaultHITLConfig = {
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
exports.HITLQuickStart = {
    createBasicSystem: async (swarmMemory, swarmCoordinator) => {
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
    createProductionSystem: async (swarmMemory, swarmCoordinator) => {
        return createHITLSystem({
            swarmMemory,
            swarmCoordinator,
            systemConfig: exports.DefaultHITLConfig
        });
    },
    createDevelopmentSystem: async (swarmMemory, swarmCoordinator) => {
        return createHITLSystem({
            swarmMemory,
            swarmCoordinator,
            systemConfig: {
                ...exports.DefaultHITLConfig,
                tracking: {
                    ...exports.DefaultHITLConfig.tracking,
                    snapshotInterval: 1,
                    alertThresholds: {
                        timeOverrun: 15,
                        qualityBelow: 2.5,
                        riskAbove: 'medium',
                        stakeholderSatisfactionBelow: 2.5
                    }
                },
                systemSettings: {
                    ...exports.DefaultHITLConfig.systemSettings,
                    environment: 'development',
                    logLevel: 'debug'
                }
            }
        });
    }
};
exports.HITLUtils = {
    validateConfig: (config) => {
        if (config.orchestrator?.autoApprovalThreshold &&
            (config.orchestrator.autoApprovalThreshold < 0 || config.orchestrator.autoApprovalThreshold > 1)) {
            return false;
        }
        if (config.tracking?.snapshotInterval && config.tracking.snapshotInterval < 1) {
            return false;
        }
        return true;
    },
    generateHealthReport: async (system) => {
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
            recommendations: exports.HITLUtils.generateHealthRecommendations(status)
        };
    },
    generateHealthRecommendations: (status) => {
        const recommendations = [];
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
exports.HITLConstants = {
    DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
    DEFAULT_AUTO_APPROVAL_THRESHOLD: 0.9,
    DEFAULT_ESCALATION_THRESHOLD: 0.5,
    DEFAULT_REVIEW_TIMEOUT_MINUTES: 120,
    DEFAULT_FINANCIAL_IMPACT_THRESHOLD: 50000,
    PRIORITY_LEVELS: ['low', 'medium', 'high', 'critical'],
    RISK_LEVELS: ['low', 'medium', 'high', 'critical'],
    DECISION_TYPES: ['strategic', 'approval', 'validation', 'override', 'escalation'],
    COMPONENT_NAMES: {
        ORCHESTRATOR: 'orchestrator',
        DELEGATION: 'delegation',
        WORKFLOWS: 'workflows',
        TRACKING: 'tracking',
        SWARM_INTEGRATION: 'swarmIntegration'
    }
};
exports.default = HITLSystem;
//# sourceMappingURL=index.js.map
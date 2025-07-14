"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = exports.WorkflowSystem = exports.HITLSystem = exports.SwarmVisualizer = exports.CommunicationProtocol = exports.MajorityEngine = exports.SwarmMemory = exports.AnalyticsAgent = exports.MarketingAgent = exports.CRMAgent = exports.SwarmCoordinator = exports.QueenAgent = exports.AgenticRevOpsSystem = void 0;
const QueenAgent_1 = require("./swarm/queen/QueenAgent");
Object.defineProperty(exports, "QueenAgent", { enumerable: true, get: function () { return QueenAgent_1.QueenAgent; } });
const SwarmCoordinator_1 = require("./swarm/coordination/SwarmCoordinator");
Object.defineProperty(exports, "SwarmCoordinator", { enumerable: true, get: function () { return SwarmCoordinator_1.SwarmCoordinator; } });
const CRMAgent_1 = require("./agents/specialized/CRMAgent");
Object.defineProperty(exports, "CRMAgent", { enumerable: true, get: function () { return CRMAgent_1.CRMAgent; } });
const MarketingAgent_1 = require("./agents/specialized/MarketingAgent");
Object.defineProperty(exports, "MarketingAgent", { enumerable: true, get: function () { return MarketingAgent_1.MarketingAgent; } });
const AnalyticsAgent_1 = require("./agents/specialized/AnalyticsAgent");
Object.defineProperty(exports, "AnalyticsAgent", { enumerable: true, get: function () { return AnalyticsAgent_1.AnalyticsAgent; } });
const SwarmMemory_1 = require("./swarm/memory/SwarmMemory");
Object.defineProperty(exports, "SwarmMemory", { enumerable: true, get: function () { return SwarmMemory_1.SwarmMemory; } });
const MajorityEngine_1 = require("./swarm/consensus/MajorityEngine");
Object.defineProperty(exports, "MajorityEngine", { enumerable: true, get: function () { return MajorityEngine_1.MajorityEngine; } });
const CommunicationProtocol_1 = require("./swarm/communication/CommunicationProtocol");
Object.defineProperty(exports, "CommunicationProtocol", { enumerable: true, get: function () { return CommunicationProtocol_1.CommunicationProtocol; } });
const SwarmVisualizer_1 = require("./swarm/visualization/SwarmVisualizer");
Object.defineProperty(exports, "SwarmVisualizer", { enumerable: true, get: function () { return SwarmVisualizer_1.SwarmVisualizer; } });
const HITLSystem_1 = require("./workflow/hitl/HITLSystem");
Object.defineProperty(exports, "HITLSystem", { enumerable: true, get: function () { return HITLSystem_1.HITLSystem; } });
const WorkflowSystem_1 = require("./workflow/WorkflowSystem");
Object.defineProperty(exports, "WorkflowSystem", { enumerable: true, get: function () { return WorkflowSystem_1.WorkflowSystem; } });
const DatabaseService_1 = require("./core/database/DatabaseService");
Object.defineProperty(exports, "DatabaseService", { enumerable: true, get: function () { return DatabaseService_1.DatabaseService; } });
class AgenticRevOpsSystem {
    queen;
    coordinator;
    memory;
    majority;
    protocol;
    visualizer;
    hitl;
    workflow;
    database;
    constructor(config = {}) {
        this.memory = new SwarmMemory_1.SwarmMemory(config.swarm?.memoryConfig);
        this.majority = new MajorityEngine_1.MajorityEngine(config.swarm?.majorityConfig);
        this.protocol = new CommunicationProtocol_1.CommunicationProtocol();
        this.visualizer = new SwarmVisualizer_1.SwarmVisualizer();
        this.queen = new QueenAgent_1.QueenAgent(config.swarm?.queenConfig);
        this.coordinator = new SwarmCoordinator_1.SwarmCoordinator({
            memory: this.memory,
            protocol: this.protocol,
            visualizer: this.visualizer
        });
        if (config.hitl?.enabled !== false) {
            this.hitl = new HITLSystem_1.HITLSystem(config.hitl);
        }
        if (config.workflow?.enabled !== false) {
            this.workflow = new WorkflowSystem_1.WorkflowSystem(config.workflow);
        }
    }
    async initialize() {
        console.log('🚀 Initializing Agentic RevOps System...');
        if (this.database) {
            await this.database.initialize();
            console.log('✅ Database initialized');
        }
        const crmAgent = new CRMAgent_1.CRMAgent('crm-specialist');
        const marketingAgent = new MarketingAgent_1.MarketingAgent('marketing-specialist');
        const analyticsAgent = new AnalyticsAgent_1.AnalyticsAgent('analytics-specialist');
        this.coordinator.registerAgent(crmAgent);
        this.coordinator.registerAgent(marketingAgent);
        this.coordinator.registerAgent(analyticsAgent);
        if (this.hitl) {
            await this.hitl.initialize();
            console.log('✅ HITL system initialized');
        }
        if (this.workflow) {
            await this.workflow.initialize();
            console.log('✅ Workflow system initialized');
        }
        console.log('🎯 Agentic RevOps System ready!');
    }
    async processRequest(request) {
        return await this.queen.makeStrategicDecision(request);
    }
    getSystemStatus() {
        return {
            queen: this.queen.getStatus(),
            coordinator: this.coordinator.getSystemStatus(),
            memory: this.memory.getStatus(),
            visualizer: this.visualizer.getSystemHealth(),
            hitl: this.hitl?.getSystemStatus(),
            workflow: this.workflow?.getSystemStatus()
        };
    }
    async shutdown() {
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
exports.AgenticRevOpsSystem = AgenticRevOpsSystem;
exports.default = AgenticRevOpsSystem;
//# sourceMappingURL=index.js.map
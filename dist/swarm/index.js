"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.revOpsSwarm = exports.RevOpsSwarm = exports.SwarmVisualizer = exports.SwarmDemo = exports.AnalyticsAgent = exports.MarketingAgent = exports.CRMAgent = exports.BaseAgent = exports.SwarmMemory = exports.MajorityEngine = exports.QueenAgent = void 0;
var QueenAgent_1 = require("./queen/QueenAgent");
Object.defineProperty(exports, "QueenAgent", { enumerable: true, get: function () { return QueenAgent_1.QueenAgent; } });
var MajorityEngine_1 = require("./consensus/MajorityEngine");
Object.defineProperty(exports, "MajorityEngine", { enumerable: true, get: function () { return MajorityEngine_1.MajorityEngine; } });
var SwarmMemory_1 = require("./memory/SwarmMemory");
Object.defineProperty(exports, "SwarmMemory", { enumerable: true, get: function () { return SwarmMemory_1.SwarmMemory; } });
var BaseAgent_1 = require("./agents/BaseAgent");
Object.defineProperty(exports, "BaseAgent", { enumerable: true, get: function () { return BaseAgent_1.BaseAgent; } });
var CRMAgent_1 = require("./agents/CRMAgent");
Object.defineProperty(exports, "CRMAgent", { enumerable: true, get: function () { return CRMAgent_1.CRMAgent; } });
var MarketingAgent_1 = require("./agents/MarketingAgent");
Object.defineProperty(exports, "MarketingAgent", { enumerable: true, get: function () { return MarketingAgent_1.MarketingAgent; } });
var AnalyticsAgent_1 = require("./agents/AnalyticsAgent");
Object.defineProperty(exports, "AnalyticsAgent", { enumerable: true, get: function () { return AnalyticsAgent_1.AnalyticsAgent; } });
var SwarmDemo_1 = require("./demo/SwarmDemo");
Object.defineProperty(exports, "SwarmDemo", { enumerable: true, get: function () { return SwarmDemo_1.SwarmDemo; } });
var SwarmVisualizer_1 = require("./visualization/SwarmVisualizer");
Object.defineProperty(exports, "SwarmVisualizer", { enumerable: true, get: function () { return SwarmVisualizer_1.SwarmVisualizer; } });
__exportStar(require("./types"), exports);
class RevOpsSwarm {
    static instance;
    constructor() {
    }
    static getInstance() {
        if (!RevOpsSwarm.instance) {
            RevOpsSwarm.instance = new RevOpsSwarm();
        }
        return RevOpsSwarm.instance;
    }
    async createSwarm(config) {
        const swarmId = config.swarmId || `swarm_${Date.now()}`;
        const queen = new QueenAgent({
            swarmId,
            majorityThreshold: config.votingThreshold || 0.5,
            decisionTimeout: 30000,
            memoryRetention: 7 * 24 * 60 * 60 * 1000,
            tieBreakerRole: true
        });
        await queen.initialize();
        let visualizer;
        if (config.enableVisualization) {
            const { SwarmVisualizer } = await Promise.resolve().then(() => __importStar(require('./visualization/SwarmVisualizer')));
            visualizer = new SwarmVisualizer();
        }
        return {
            swarmId,
            queen,
            agents: new Map(),
            visualizer,
            async addAgent(agent) {
                await agent.initialize();
                queen.registerAgent(agent);
                this.agents.set(agent.getId(), agent);
                if (visualizer) {
                    visualizer.registerAgent(agent.getId(), agent.getType(), agent.config.name);
                }
            },
            async makeDecision(topic, context) {
                return queen.makeStrategicDecision(topic, context);
            },
            async handleEmergency(situation, severity, context) {
                return queen.handleEmergency(situation, severity, context);
            },
            async getHealth() {
                return queen.monitorSwarmHealth();
            },
            visualize() {
                if (visualizer) {
                    visualizer.displaySwarmState();
                }
            }
        };
    }
    async createRevOpsSwarm(options = {}) {
        const swarm = await this.createSwarm({
            enableVisualization: options.enableVisualization
        });
        if (options.enableCRM !== false) {
            const { CRMAgent } = await Promise.resolve().then(() => __importStar(require('./agents/CRMAgent')));
            const crmAgent = new CRMAgent({
                id: `crm_${swarm.swarmId}`,
                name: 'CRM Specialist',
                capabilities: [],
                votingWeight: 1.2
            });
            await swarm.addAgent(crmAgent);
        }
        if (options.enableMarketing !== false) {
            const { MarketingAgent } = await Promise.resolve().then(() => __importStar(require('./agents/MarketingAgent')));
            const marketingAgent = new MarketingAgent({
                id: `marketing_${swarm.swarmId}`,
                name: 'Marketing Expert',
                capabilities: [],
                votingWeight: 1.1
            });
            await swarm.addAgent(marketingAgent);
        }
        if (options.enableAnalytics !== false) {
            const { AnalyticsAgent } = await Promise.resolve().then(() => __importStar(require('./agents/AnalyticsAgent')));
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
exports.RevOpsSwarm = RevOpsSwarm;
exports.revOpsSwarm = RevOpsSwarm.getInstance();
//# sourceMappingURL=index.js.map
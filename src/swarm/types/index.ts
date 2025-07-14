/**
 * Common type definitions for the swarm system
 */

import { MajorityResult } from '../consensus/MajorityEngine';

export { MajorityResult };

export interface AgentInterface {
  getId(): string;
  getType(): string;
  getStatus(): string;
  generateReport(topic: string, context: any): Promise<AgentReport>;
  receiveResponse(response: any): void;
  on(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, data: any): void;
}

export interface AgentReport {
  recommendation: any;
  confidence: number;
  reasoning: string;
}

export interface SwarmDecision {
  id: string;
  type: string;
  content: string;
  timestamp: Date;
}

export interface SwarmConfig {
  swarmId: string;
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
  maxAgents: number;
  strategy: 'consensus' | 'majority' | 'weighted' | 'adaptive';
}

export interface AgentCapability {
  name: string;
  proficiency: number; // 0-1
  experience: number; // Number of tasks completed
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  status: 'success' | 'failure' | 'partial';
  output: any;
  metrics: TaskMetrics;
}

export interface TaskMetrics {
  duration: number;
  tokensUsed: number;
  accuracy?: number;
  efficiency?: number;
}

export interface MemoryEntry {
  id: string;
  type: 'decision' | 'pattern' | 'agent-report' | 'task-result';
  content: any;
  timestamp: Date;
  relevance: number;
  tags: string[];
}

export interface Pattern {
  id: string;
  type: string;
  occurrences: number;
  successRate: number;
  context: Record<string, any>;
  agentId?: string;
}

export interface SwarmEvent {
  id: string;
  type: string;
  source: string;
  target?: string;
  data: any;
  timestamp: Date;
}

export interface CommunicationMessage {
  id: string;
  from: string;
  to: string | string[]; // Can be broadcast
  type: 'request' | 'response' | 'broadcast' | 'alert';
  content: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}
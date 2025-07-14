import { EventEmitter } from 'events';
import { AgentInterface } from '../types';
export interface Message {
    id: string;
    from: string;
    to: string | string[];
    type: MessageType;
    priority: MessagePriority;
    content: MessageContent;
    metadata: MessageMetadata;
    timestamp: Date;
}
export declare enum MessageType {
    TASK_ASSIGNMENT = "task_assignment",
    TASK_STATUS = "task_status",
    TASK_COMPLETE = "task_complete",
    VOTE_REQUEST = "vote_request",
    VOTE_CAST = "vote_cast",
    DECISION_MADE = "decision_made",
    COLLABORATION_REQUEST = "collaboration_request",
    COLLABORATION_RESPONSE = "collaboration_response",
    SYNC_REQUEST = "sync_request",
    SYNC_DATA = "sync_data",
    STATUS_UPDATE = "status_update",
    REPORT = "report",
    ALERT = "alert",
    QUERY = "query",
    RESPONSE = "response",
    EMERGENCY = "emergency",
    EMERGENCY_RESPONSE = "emergency_response",
    HEARTBEAT = "heartbeat",
    ACKNOWLEDGMENT = "acknowledgment",
    ERROR = "error"
}
export declare enum MessagePriority {
    CRITICAL = "critical",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export interface MessageContent {
    action?: string;
    data?: any;
    query?: string;
    result?: any;
    error?: Error;
}
export interface MessageMetadata {
    correlationId?: string;
    replyTo?: string;
    ttl?: number;
    requiresAck?: boolean;
    encrypted?: boolean;
    compression?: 'none' | 'gzip' | 'lz4';
}
export interface CommunicationChannel {
    id: string;
    type: 'direct' | 'broadcast' | 'multicast';
    participants: Set<string>;
    established: Date;
    messageCount: number;
    lastActivity: Date;
}
export interface ProtocolConfig {
    maxRetries: number;
    retryDelay: number;
    messageTimeout: number;
    maxQueueSize: number;
    enableEncryption: boolean;
    enableCompression: boolean;
}
export declare class CommunicationProtocol extends EventEmitter {
    private agents;
    private channels;
    private messageQueue;
    private pendingAcks;
    private config;
    private messageHandlers;
    constructor(config?: Partial<ProtocolConfig>);
    registerAgent(agent: AgentInterface): void;
    sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<void>;
    createChannel(participants: string[], type?: 'direct' | 'broadcast' | 'multicast'): string;
    sendToChannel(channelId: string, message: Omit<Message, 'id' | 'timestamp' | 'to'>): Promise<void>;
    registerHandler(type: MessageType, handler: MessageHandler): void;
    getStatistics(): CommunicationStats;
    private initializeHandlers;
    private startMessageProcessor;
    private processMessageQueues;
    private deliverMessage;
    private directMessage;
    private broadcastMessage;
    private sendAcknowledgment;
    private trackAcknowledgment;
    private trackBroadcastAcknowledgment;
    private checkPendingAcks;
    private retryMessage;
    private handleAckTimeout;
    private handleDeliveryFailure;
    private validateMessage;
    private setupAgentHandlers;
    private handleAcknowledgment;
    private notifyChannelCreation;
    private shouldCompress;
    private encryptContent;
    private decryptContent;
    private compressContent;
    private decompressContent;
    private generateMessageId;
    private generateChannelId;
}
interface CommunicationStats {
    registeredAgents: number;
    totalChannels: number;
    activeChannels: number;
    queuedMessages: number;
    pendingAcks: number;
}
type MessageHandler = (message: Message, protocol: CommunicationProtocol) => Promise<void>;
export declare function createMessage(from: string, to: string | string[], type: MessageType, content: MessageContent, priority?: MessagePriority): Omit<Message, 'id' | 'timestamp'>;
export declare function createBroadcast(from: string, type: MessageType, content: MessageContent, priority?: MessagePriority): Omit<Message, 'id' | 'timestamp' | 'to'>;
export {};
//# sourceMappingURL=CommunicationProtocol.d.ts.map
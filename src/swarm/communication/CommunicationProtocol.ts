/**
 * Communication Protocol
 * Defines how agents communicate with each other and with the Queen
 */

import { EventEmitter } from 'events';
import { AgentInterface } from '../types';

export interface Message {
  id: string;
  from: string;
  to: string | string[]; // Can be single agent or broadcast
  type: MessageType;
  priority: MessagePriority;
  content: MessageContent;
  metadata: MessageMetadata;
  timestamp: Date;
}

export enum MessageType {
  // Operational Messages
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_STATUS = 'task_status',
  TASK_COMPLETE = 'task_complete',
  
  // Decision Messages
  VOTE_REQUEST = 'vote_request',
  VOTE_CAST = 'vote_cast',
  DECISION_MADE = 'decision_made',
  
  // Coordination Messages
  COLLABORATION_REQUEST = 'collaboration_request',
  COLLABORATION_RESPONSE = 'collaboration_response',
  SYNC_REQUEST = 'sync_request',
  SYNC_DATA = 'sync_data',
  
  // Information Messages
  STATUS_UPDATE = 'status_update',
  REPORT = 'report',
  ALERT = 'alert',
  QUERY = 'query',
  RESPONSE = 'response',
  
  // Emergency Messages
  EMERGENCY = 'emergency',
  EMERGENCY_RESPONSE = 'emergency_response',
  
  // System Messages
  HEARTBEAT = 'heartbeat',
  ACKNOWLEDGMENT = 'acknowledgment',
  ERROR = 'error'
}

export enum MessagePriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface MessageContent {
  action?: string;
  data?: any;
  query?: string;
  result?: any;
  error?: Error;
}

export interface MessageMetadata {
  correlationId?: string; // For tracking related messages
  replyTo?: string; // Message ID this is replying to
  ttl?: number; // Time to live in ms
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

export class CommunicationProtocol extends EventEmitter {
  private agents: Map<string, AgentInterface>;
  private channels: Map<string, CommunicationChannel>;
  private messageQueue: Map<string, Message[]>;
  private pendingAcks: Map<string, PendingAck>;
  private config: ProtocolConfig;
  private messageHandlers: Map<MessageType, MessageHandler[]>;
  
  constructor(config?: Partial<ProtocolConfig>) {
    super();
    
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      messageTimeout: 30000,
      maxQueueSize: 1000,
      enableEncryption: false,
      enableCompression: true,
      ...config
    };
    
    this.agents = new Map();
    this.channels = new Map();
    this.messageQueue = new Map();
    this.pendingAcks = new Map();
    this.messageHandlers = new Map();
    
    this.initializeHandlers();
    this.startMessageProcessor();
  }

  /**
   * Register an agent with the protocol
   */
  registerAgent(agent: AgentInterface): void {
    const agentId = agent.getId();
    this.agents.set(agentId, agent);
    this.messageQueue.set(agentId, []);
    
    // Set up agent message handling
    this.setupAgentHandlers(agent);
    
    this.emit('protocol:agent-registered', { agentId });
  }

  /**
   * Send a message
   */
  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: Message = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date()
    };
    
    // Validate message
    this.validateMessage(fullMessage);
    
    // Apply security if enabled
    if (this.config.enableEncryption && fullMessage.metadata.encrypted !== false) {
      fullMessage.content = this.encryptContent(fullMessage.content);
      fullMessage.metadata.encrypted = true;
    }
    
    // Apply compression if enabled
    if (this.config.enableCompression && this.shouldCompress(fullMessage)) {
      fullMessage.content = this.compressContent(fullMessage.content);
      fullMessage.metadata.compression = 'gzip';
    }
    
    // Route message
    if (Array.isArray(fullMessage.to)) {
      await this.broadcastMessage(fullMessage);
    } else {
      await this.directMessage(fullMessage);
    }
    
    this.emit('protocol:message-sent', {
      messageId: fullMessage.id,
      from: fullMessage.from,
      to: fullMessage.to,
      type: fullMessage.type
    });
  }

  /**
   * Create a communication channel
   */
  createChannel(
    participants: string[],
    type: 'direct' | 'broadcast' | 'multicast' = 'multicast'
  ): string {
    const channelId = this.generateChannelId();
    
    const channel: CommunicationChannel = {
      id: channelId,
      type,
      participants: new Set(participants),
      established: new Date(),
      messageCount: 0,
      lastActivity: new Date()
    };
    
    this.channels.set(channelId, channel);
    
    // Notify participants
    this.notifyChannelCreation(channel);
    
    return channelId;
  }

  /**
   * Send message to channel
   */
  async sendToChannel(channelId: string, message: Omit<Message, 'id' | 'timestamp' | 'to'>): Promise<void> {
    const channel = this.channels.get(channelId);
    
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    
    const participants = Array.from(channel.participants);
    
    await this.sendMessage({
      ...message,
      to: participants
    });
    
    channel.messageCount++;
    channel.lastActivity = new Date();
  }

  /**
   * Register a message handler
   */
  registerHandler(type: MessageType, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Get communication statistics
   */
  getStatistics(): CommunicationStats {
    const totalMessages = Array.from(this.messageQueue.values())
      .reduce((sum, queue) => sum + queue.length, 0);
    
    const activeChannels = Array.from(this.channels.values())
      .filter(ch => Date.now() - ch.lastActivity.getTime() < 300000).length; // Active in last 5 min
    
    return {
      registeredAgents: this.agents.size,
      totalChannels: this.channels.size,
      activeChannels,
      queuedMessages: totalMessages,
      pendingAcks: this.pendingAcks.size
    };
  }

  /**
   * Initialize default handlers
   */
  private initializeHandlers(): void {
    // Heartbeat handler
    this.registerHandler(MessageType.HEARTBEAT, async (message, protocol) => {
      await protocol.sendMessage({
        from: 'protocol',
        to: message.from,
        type: MessageType.ACKNOWLEDGMENT,
        priority: MessagePriority.LOW,
        content: { acknowledged: true },
        metadata: { replyTo: message.id }
      });
    });
    
    // Error handler
    this.registerHandler(MessageType.ERROR, async (message, protocol) => {
      protocol.emit('protocol:error', {
        from: message.from,
        error: message.content.error
      });
    });
  }

  /**
   * Start message processor
   */
  private startMessageProcessor(): void {
    setInterval(() => {
      this.processMessageQueues();
      this.checkPendingAcks();
    }, 100);
  }

  /**
   * Process message queues
   */
  private async processMessageQueues(): Promise<void> {
    for (const [agentId, queue] of this.messageQueue) {
      while (queue.length > 0) {
        const message = queue.shift()!;
        
        try {
          await this.deliverMessage(agentId, message);
        } catch (error) {
          await this.handleDeliveryFailure(message, error);
        }
      }
    }
  }

  /**
   * Deliver message to agent
   */
  private async deliverMessage(agentId: string, message: Message): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    // Decompress if needed
    if (message.metadata.compression) {
      message.content = this.decompressContent(message.content, message.metadata.compression);
    }
    
    // Decrypt if needed
    if (message.metadata.encrypted) {
      message.content = this.decryptContent(message.content);
    }
    
    // Apply handlers
    const handlers = this.messageHandlers.get(message.type) || [];
    for (const handler of handlers) {
      await handler(message, this);
    }
    
    // Deliver to agent
    agent.emit('message', message);
    
    // Send acknowledgment if required
    if (message.metadata.requiresAck) {
      await this.sendAcknowledgment(message);
    }
  }

  /**
   * Direct message to single agent
   */
  private async directMessage(message: Message): Promise<void> {
    const targetQueue = this.messageQueue.get(message.to as string);
    
    if (!targetQueue) {
      throw new Error(`Target agent not found: ${message.to}`);
    }
    
    // Check queue size
    if (targetQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Message queue full for agent: ${message.to}`);
    }
    
    targetQueue.push(message);
    
    // Track acknowledgment if required
    if (message.metadata.requiresAck) {
      this.trackAcknowledgment(message);
    }
  }

  /**
   * Broadcast message to multiple agents
   */
  private async broadcastMessage(message: Message): Promise<void> {
    const targets = message.to as string[];
    
    for (const target of targets) {
      const targetQueue = this.messageQueue.get(target);
      
      if (targetQueue && targetQueue.length < this.config.maxQueueSize) {
        targetQueue.push({ ...message }); // Clone message
      }
    }
    
    // Track acknowledgments if required
    if (message.metadata.requiresAck) {
      this.trackBroadcastAcknowledgment(message, targets);
    }
  }

  /**
   * Send acknowledgment
   */
  private async sendAcknowledgment(originalMessage: Message): Promise<void> {
    await this.sendMessage({
      from: originalMessage.to as string,
      to: originalMessage.from,
      type: MessageType.ACKNOWLEDGMENT,
      priority: MessagePriority.LOW,
      content: {
        acknowledged: true,
        originalMessageId: originalMessage.id
      },
      metadata: {
        replyTo: originalMessage.id
      }
    });
  }

  /**
   * Track acknowledgment
   */
  private trackAcknowledgment(message: Message): void {
    this.pendingAcks.set(message.id, {
      message,
      expectedFrom: [message.to as string],
      receivedFrom: [],
      timestamp: new Date(),
      retries: 0
    });
  }

  /**
   * Track broadcast acknowledgment
   */
  private trackBroadcastAcknowledgment(message: Message, targets: string[]): void {
    this.pendingAcks.set(message.id, {
      message,
      expectedFrom: targets,
      receivedFrom: [],
      timestamp: new Date(),
      retries: 0
    });
  }

  /**
   * Check pending acknowledgments
   */
  private checkPendingAcks(): void {
    const now = Date.now();
    
    for (const [messageId, pending] of this.pendingAcks) {
      const elapsed = now - pending.timestamp.getTime();
      
      if (elapsed > this.config.messageTimeout) {
        if (pending.retries < this.config.maxRetries) {
          this.retryMessage(pending);
        } else {
          this.handleAckTimeout(pending);
        }
      }
    }
  }

  /**
   * Retry message
   */
  private retryMessage(pending: PendingAck): void {
    pending.retries++;
    pending.timestamp = new Date();
    
    // Re-queue message
    const missingAcks = pending.expectedFrom.filter(
      agent => !pending.receivedFrom.includes(agent)
    );
    
    for (const agent of missingAcks) {
      const queue = this.messageQueue.get(agent);
      if (queue) {
        queue.push({ ...pending.message });
      }
    }
    
    this.emit('protocol:message-retry', {
      messageId: pending.message.id,
      retry: pending.retries
    });
  }

  /**
   * Handle acknowledgment timeout
   */
  private handleAckTimeout(pending: PendingAck): void {
    this.pendingAcks.delete(pending.message.id);
    
    this.emit('protocol:ack-timeout', {
      messageId: pending.message.id,
      missingFrom: pending.expectedFrom.filter(
        agent => !pending.receivedFrom.includes(agent)
      )
    });
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(message: Message, error: any): Promise<void> {
    this.emit('protocol:delivery-failure', {
      messageId: message.id,
      error
    });
    
    // Send error message back to sender
    if (message.from !== 'protocol') {
      await this.sendMessage({
        from: 'protocol',
        to: message.from,
        type: MessageType.ERROR,
        priority: MessagePriority.HIGH,
        content: {
          error: error.message,
          originalMessageId: message.id
        },
        metadata: {}
      });
    }
  }

  /**
   * Validate message
   */
  private validateMessage(message: Message): void {
    if (!message.from) {
      throw new Error('Message must have a sender');
    }
    
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('Message must have at least one recipient');
    }
    
    if (!message.type) {
      throw new Error('Message must have a type');
    }
    
    if (!message.priority) {
      throw new Error('Message must have a priority');
    }
  }

  /**
   * Setup agent handlers
   */
  private setupAgentHandlers(agent: AgentInterface): void {
    // Handle agent responses
    agent.on('response', (response) => {
      if (response.type === 'acknowledgment') {
        this.handleAcknowledgment(response);
      }
    });
  }

  /**
   * Handle acknowledgment
   */
  private handleAcknowledgment(response: any): void {
    const pending = this.pendingAcks.get(response.replyTo);
    
    if (pending) {
      pending.receivedFrom.push(response.from);
      
      // Check if all acknowledgments received
      if (pending.receivedFrom.length === pending.expectedFrom.length) {
        this.pendingAcks.delete(response.replyTo);
        
        this.emit('protocol:all-acks-received', {
          messageId: response.replyTo
        });
      }
    }
  }

  /**
   * Notify channel creation
   */
  private notifyChannelCreation(channel: CommunicationChannel): void {
    const notification = {
      from: 'protocol',
      to: Array.from(channel.participants),
      type: MessageType.STATUS_UPDATE,
      priority: MessagePriority.LOW,
      content: {
        action: 'channel_created',
        data: {
          channelId: channel.id,
          type: channel.type
        }
      },
      metadata: {}
    };
    
    this.sendMessage(notification);
  }

  /**
   * Check if content should be compressed
   */
  private shouldCompress(message: Message): boolean {
    const contentSize = JSON.stringify(message.content).length;
    return contentSize > 1024; // Compress if larger than 1KB
  }

  /**
   * Encrypt content
   */
  private encryptContent(content: MessageContent): MessageContent {
    // Placeholder for encryption logic
    return content;
  }

  /**
   * Decrypt content
   */
  private decryptContent(content: MessageContent): MessageContent {
    // Placeholder for decryption logic
    return content;
  }

  /**
   * Compress content
   */
  private compressContent(content: MessageContent): MessageContent {
    // Placeholder for compression logic
    return content;
  }

  /**
   * Decompress content
   */
  private decompressContent(content: MessageContent, compression: string): MessageContent {
    // Placeholder for decompression logic
    return content;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique channel ID
   */
  private generateChannelId(): string {
    return `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type definitions
interface PendingAck {
  message: Message;
  expectedFrom: string[];
  receivedFrom: string[];
  timestamp: Date;
  retries: number;
}

interface CommunicationStats {
  registeredAgents: number;
  totalChannels: number;
  activeChannels: number;
  queuedMessages: number;
  pendingAcks: number;
}

type MessageHandler = (message: Message, protocol: CommunicationProtocol) => Promise<void>;

// Export convenience functions
export function createMessage(
  from: string,
  to: string | string[],
  type: MessageType,
  content: MessageContent,
  priority: MessagePriority = MessagePriority.MEDIUM
): Omit<Message, 'id' | 'timestamp'> {
  return {
    from,
    to,
    type,
    priority,
    content,
    metadata: {}
  };
}

export function createBroadcast(
  from: string,
  type: MessageType,
  content: MessageContent,
  priority: MessagePriority = MessagePriority.MEDIUM
): Omit<Message, 'id' | 'timestamp' | 'to'> {
  return {
    from,
    type,
    priority,
    content,
    metadata: {}
  };
}
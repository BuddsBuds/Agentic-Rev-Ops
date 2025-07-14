"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunicationProtocol = exports.MessagePriority = exports.MessageType = void 0;
exports.createMessage = createMessage;
exports.createBroadcast = createBroadcast;
const events_1 = require("events");
var MessageType;
(function (MessageType) {
    MessageType["TASK_ASSIGNMENT"] = "task_assignment";
    MessageType["TASK_STATUS"] = "task_status";
    MessageType["TASK_COMPLETE"] = "task_complete";
    MessageType["VOTE_REQUEST"] = "vote_request";
    MessageType["VOTE_CAST"] = "vote_cast";
    MessageType["DECISION_MADE"] = "decision_made";
    MessageType["COLLABORATION_REQUEST"] = "collaboration_request";
    MessageType["COLLABORATION_RESPONSE"] = "collaboration_response";
    MessageType["SYNC_REQUEST"] = "sync_request";
    MessageType["SYNC_DATA"] = "sync_data";
    MessageType["STATUS_UPDATE"] = "status_update";
    MessageType["REPORT"] = "report";
    MessageType["ALERT"] = "alert";
    MessageType["QUERY"] = "query";
    MessageType["RESPONSE"] = "response";
    MessageType["EMERGENCY"] = "emergency";
    MessageType["EMERGENCY_RESPONSE"] = "emergency_response";
    MessageType["HEARTBEAT"] = "heartbeat";
    MessageType["ACKNOWLEDGMENT"] = "acknowledgment";
    MessageType["ERROR"] = "error";
})(MessageType || (exports.MessageType = MessageType = {}));
var MessagePriority;
(function (MessagePriority) {
    MessagePriority["CRITICAL"] = "critical";
    MessagePriority["HIGH"] = "high";
    MessagePriority["MEDIUM"] = "medium";
    MessagePriority["LOW"] = "low";
})(MessagePriority || (exports.MessagePriority = MessagePriority = {}));
class CommunicationProtocol extends events_1.EventEmitter {
    agents;
    channels;
    messageQueue;
    pendingAcks;
    config;
    messageHandlers;
    constructor(config) {
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
    registerAgent(agent) {
        const agentId = agent.getId();
        this.agents.set(agentId, agent);
        this.messageQueue.set(agentId, []);
        this.setupAgentHandlers(agent);
        this.emit('protocol:agent-registered', { agentId });
    }
    async sendMessage(message) {
        const fullMessage = {
            ...message,
            id: this.generateMessageId(),
            timestamp: new Date()
        };
        this.validateMessage(fullMessage);
        if (this.config.enableEncryption && fullMessage.metadata.encrypted !== false) {
            fullMessage.content = this.encryptContent(fullMessage.content);
            fullMessage.metadata.encrypted = true;
        }
        if (this.config.enableCompression && this.shouldCompress(fullMessage)) {
            fullMessage.content = this.compressContent(fullMessage.content);
            fullMessage.metadata.compression = 'gzip';
        }
        if (Array.isArray(fullMessage.to)) {
            await this.broadcastMessage(fullMessage);
        }
        else {
            await this.directMessage(fullMessage);
        }
        this.emit('protocol:message-sent', {
            messageId: fullMessage.id,
            from: fullMessage.from,
            to: fullMessage.to,
            type: fullMessage.type
        });
    }
    createChannel(participants, type = 'multicast') {
        const channelId = this.generateChannelId();
        const channel = {
            id: channelId,
            type,
            participants: new Set(participants),
            established: new Date(),
            messageCount: 0,
            lastActivity: new Date()
        };
        this.channels.set(channelId, channel);
        this.notifyChannelCreation(channel);
        return channelId;
    }
    async sendToChannel(channelId, message) {
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
    registerHandler(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }
    getStatistics() {
        const totalMessages = Array.from(this.messageQueue.values())
            .reduce((sum, queue) => sum + queue.length, 0);
        const activeChannels = Array.from(this.channels.values())
            .filter(ch => Date.now() - ch.lastActivity.getTime() < 300000).length;
        return {
            registeredAgents: this.agents.size,
            totalChannels: this.channels.size,
            activeChannels,
            queuedMessages: totalMessages,
            pendingAcks: this.pendingAcks.size
        };
    }
    initializeHandlers() {
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
        this.registerHandler(MessageType.ERROR, async (message, protocol) => {
            protocol.emit('protocol:error', {
                from: message.from,
                error: message.content.error
            });
        });
    }
    startMessageProcessor() {
        setInterval(() => {
            this.processMessageQueues();
            this.checkPendingAcks();
        }, 100);
    }
    async processMessageQueues() {
        for (const [agentId, queue] of this.messageQueue) {
            while (queue.length > 0) {
                const message = queue.shift();
                try {
                    await this.deliverMessage(agentId, message);
                }
                catch (error) {
                    await this.handleDeliveryFailure(message, error);
                }
            }
        }
    }
    async deliverMessage(agentId, message) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (message.metadata.compression) {
            message.content = this.decompressContent(message.content, message.metadata.compression);
        }
        if (message.metadata.encrypted) {
            message.content = this.decryptContent(message.content);
        }
        const handlers = this.messageHandlers.get(message.type) || [];
        for (const handler of handlers) {
            await handler(message, this);
        }
        agent.emit('message', message);
        if (message.metadata.requiresAck) {
            await this.sendAcknowledgment(message);
        }
    }
    async directMessage(message) {
        const targetQueue = this.messageQueue.get(message.to);
        if (!targetQueue) {
            throw new Error(`Target agent not found: ${message.to}`);
        }
        if (targetQueue.length >= this.config.maxQueueSize) {
            throw new Error(`Message queue full for agent: ${message.to}`);
        }
        targetQueue.push(message);
        if (message.metadata.requiresAck) {
            this.trackAcknowledgment(message);
        }
    }
    async broadcastMessage(message) {
        const targets = message.to;
        for (const target of targets) {
            const targetQueue = this.messageQueue.get(target);
            if (targetQueue && targetQueue.length < this.config.maxQueueSize) {
                targetQueue.push({ ...message });
            }
        }
        if (message.metadata.requiresAck) {
            this.trackBroadcastAcknowledgment(message, targets);
        }
    }
    async sendAcknowledgment(originalMessage) {
        await this.sendMessage({
            from: originalMessage.to,
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
    trackAcknowledgment(message) {
        this.pendingAcks.set(message.id, {
            message,
            expectedFrom: [message.to],
            receivedFrom: [],
            timestamp: new Date(),
            retries: 0
        });
    }
    trackBroadcastAcknowledgment(message, targets) {
        this.pendingAcks.set(message.id, {
            message,
            expectedFrom: targets,
            receivedFrom: [],
            timestamp: new Date(),
            retries: 0
        });
    }
    checkPendingAcks() {
        const now = Date.now();
        for (const [messageId, pending] of this.pendingAcks) {
            const elapsed = now - pending.timestamp.getTime();
            if (elapsed > this.config.messageTimeout) {
                if (pending.retries < this.config.maxRetries) {
                    this.retryMessage(pending);
                }
                else {
                    this.handleAckTimeout(pending);
                }
            }
        }
    }
    retryMessage(pending) {
        pending.retries++;
        pending.timestamp = new Date();
        const missingAcks = pending.expectedFrom.filter(agent => !pending.receivedFrom.includes(agent));
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
    handleAckTimeout(pending) {
        this.pendingAcks.delete(pending.message.id);
        this.emit('protocol:ack-timeout', {
            messageId: pending.message.id,
            missingFrom: pending.expectedFrom.filter(agent => !pending.receivedFrom.includes(agent))
        });
    }
    async handleDeliveryFailure(message, error) {
        this.emit('protocol:delivery-failure', {
            messageId: message.id,
            error
        });
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
    validateMessage(message) {
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
    setupAgentHandlers(agent) {
        agent.on('response', (response) => {
            if (response.type === 'acknowledgment') {
                this.handleAcknowledgment(response);
            }
        });
    }
    handleAcknowledgment(response) {
        const pending = this.pendingAcks.get(response.replyTo);
        if (pending) {
            pending.receivedFrom.push(response.from);
            if (pending.receivedFrom.length === pending.expectedFrom.length) {
                this.pendingAcks.delete(response.replyTo);
                this.emit('protocol:all-acks-received', {
                    messageId: response.replyTo
                });
            }
        }
    }
    notifyChannelCreation(channel) {
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
    shouldCompress(message) {
        const contentSize = JSON.stringify(message.content).length;
        return contentSize > 1024;
    }
    encryptContent(content) {
        return content;
    }
    decryptContent(content) {
        return content;
    }
    compressContent(content) {
        return content;
    }
    decompressContent(content, compression) {
        return content;
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateChannelId() {
        return `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.CommunicationProtocol = CommunicationProtocol;
function createMessage(from, to, type, content, priority = MessagePriority.MEDIUM) {
    return {
        from,
        to,
        type,
        priority,
        content,
        metadata: {}
    };
}
function createBroadcast(from, type, content, priority = MessagePriority.MEDIUM) {
    return {
        from,
        type,
        priority,
        content,
        metadata: {}
    };
}
//# sourceMappingURL=CommunicationProtocol.js.map
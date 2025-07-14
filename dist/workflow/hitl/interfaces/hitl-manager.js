"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanInTheLoopManager = void 0;
const events_1 = require("events");
class HumanInTheLoopManager extends events_1.EventEmitter {
    reviewRequests = new Map();
    reviewQueue = [];
    async requestReview(type, context, options) {
        const request = {
            id: Date.now().toString(),
            type,
            context,
            options,
            status: 'pending',
            requestedAt: new Date()
        };
        this.reviewRequests.set(request.id, request);
        this.reviewQueue.push(request.id);
        this.emit('review:requested', request);
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const updatedRequest = this.reviewRequests.get(request.id);
                if (updatedRequest && updatedRequest.status !== 'pending' && updatedRequest.status !== 'in_review') {
                    clearInterval(checkInterval);
                    resolve(updatedRequest);
                }
            }, 100);
        });
    }
    getReviewStatus(requestId) {
        return this.reviewRequests.get(requestId) || null;
    }
    submitResponse(requestId, response) {
        const request = this.reviewRequests.get(requestId);
        if (!request) {
            throw new Error(`Review request ${requestId} not found`);
        }
        if (request.status !== 'pending' && request.status !== 'in_review') {
            throw new Error(`Review request ${requestId} already completed`);
        }
        request.response = response;
        request.respondedAt = new Date();
        switch (request.type) {
            case 'approval':
                request.status = response.approved ? 'approved' : 'rejected';
                break;
            default:
                request.status = 'completed';
        }
        const queueIndex = this.reviewQueue.indexOf(requestId);
        if (queueIndex !== -1) {
            this.reviewQueue.splice(queueIndex, 1);
        }
        this.emit('review:completed', request);
    }
    getPendingReviews() {
        return this.reviewQueue
            .map(id => this.reviewRequests.get(id))
            .filter(request => request && (request.status === 'pending' || request.status === 'in_review'))
            .filter((request) => request !== undefined);
    }
    markInReview(requestId) {
        const request = this.reviewRequests.get(requestId);
        if (request && request.status === 'pending') {
            request.status = 'in_review';
            this.emit('review:started', request);
        }
    }
    cancelReview(requestId) {
        const request = this.reviewRequests.get(requestId);
        if (request && (request.status === 'pending' || request.status === 'in_review')) {
            request.status = 'rejected';
            request.respondedAt = new Date();
            const queueIndex = this.reviewQueue.indexOf(requestId);
            if (queueIndex !== -1) {
                this.reviewQueue.splice(queueIndex, 1);
            }
            this.emit('review:cancelled', request);
        }
    }
    getReviewHistory(limit) {
        const history = Array.from(this.reviewRequests.values())
            .filter(request => request.status !== 'pending' && request.status !== 'in_review')
            .sort((a, b) => (b.respondedAt?.getTime() || 0) - (a.respondedAt?.getTime() || 0));
        return limit ? history.slice(0, limit) : history;
    }
    async initialize() {
        this.emit('hitl:initialized');
    }
    handleResponse(requestId, response) {
        this.submitResponse(requestId, response);
    }
}
exports.HumanInTheLoopManager = HumanInTheLoopManager;
//# sourceMappingURL=hitl-manager.js.map
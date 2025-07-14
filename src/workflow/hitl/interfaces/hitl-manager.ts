// Human-in-the-Loop (HITL) Manager Module
import { EventEmitter } from 'events';

export interface HumanReviewRequest {
  id: string;
  type: 'approval' | 'review' | 'input' | 'decision';
  context: any;
  options?: string[];
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed';
  requestedAt: Date;
  respondedAt?: Date;
  response?: any;
}

export interface HITLManager {
  requestReview(type: string, context: any, options?: string[]): Promise<HumanReviewRequest>;
  getReviewStatus(requestId: string): HumanReviewRequest | null;
  submitResponse(requestId: string, response: any): void;
  getPendingReviews(): HumanReviewRequest[];
  initialize(): Promise<void>;
  handleResponse(requestId: string, response: any): void;
  on(event: string, listener: (...args: any[]) => void): this;
}

export class HumanInTheLoopManager extends EventEmitter implements HITLManager {
  private reviewRequests: Map<string, HumanReviewRequest> = new Map();
  private reviewQueue: string[] = [];

  async requestReview(
    type: 'approval' | 'review' | 'input' | 'decision',
    context: any,
    options?: string[]
  ): Promise<HumanReviewRequest> {
    const request: HumanReviewRequest = {
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
    
    // Return a promise that resolves when the review is complete
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

  getReviewStatus(requestId: string): HumanReviewRequest | null {
    return this.reviewRequests.get(requestId) || null;
  }

  submitResponse(requestId: string, response: any): void {
    const request = this.reviewRequests.get(requestId);
    if (!request) {
      throw new Error(`Review request ${requestId} not found`);
    }

    if (request.status !== 'pending' && request.status !== 'in_review') {
      throw new Error(`Review request ${requestId} already completed`);
    }

    request.response = response;
    request.respondedAt = new Date();
    
    // Update status based on type and response
    switch (request.type) {
      case 'approval':
        request.status = response.approved ? 'approved' : 'rejected';
        break;
      default:
        request.status = 'completed';
    }

    // Remove from queue
    const queueIndex = this.reviewQueue.indexOf(requestId);
    if (queueIndex !== -1) {
      this.reviewQueue.splice(queueIndex, 1);
    }

    this.emit('review:completed', request);
  }

  getPendingReviews(): HumanReviewRequest[] {
    return this.reviewQueue
      .map(id => this.reviewRequests.get(id))
      .filter(request => request && (request.status === 'pending' || request.status === 'in_review'))
      .filter((request): request is HumanReviewRequest => request !== undefined);
  }

  // Additional utility methods
  markInReview(requestId: string): void {
    const request = this.reviewRequests.get(requestId);
    if (request && request.status === 'pending') {
      request.status = 'in_review';
      this.emit('review:started', request);
    }
  }

  cancelReview(requestId: string): void {
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

  getReviewHistory(limit?: number): HumanReviewRequest[] {
    const history = Array.from(this.reviewRequests.values())
      .filter(request => request.status !== 'pending' && request.status !== 'in_review')
      .sort((a, b) => (b.respondedAt?.getTime() || 0) - (a.respondedAt?.getTime() || 0));
    
    return limit ? history.slice(0, limit) : history;
  }

  async initialize(): Promise<void> {
    // Initialize HITL manager components
    this.emit('hitl:initialized');
  }

  handleResponse(requestId: string, response: any): void {
    this.submitResponse(requestId, response);
  }
}
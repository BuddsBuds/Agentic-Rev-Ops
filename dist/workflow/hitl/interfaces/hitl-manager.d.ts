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
export declare class HumanInTheLoopManager extends EventEmitter implements HITLManager {
    private reviewRequests;
    private reviewQueue;
    requestReview(type: 'approval' | 'review' | 'input' | 'decision', context: any, options?: string[]): Promise<HumanReviewRequest>;
    getReviewStatus(requestId: string): HumanReviewRequest | null;
    submitResponse(requestId: string, response: any): void;
    getPendingReviews(): HumanReviewRequest[];
    markInReview(requestId: string): void;
    cancelReview(requestId: string): void;
    getReviewHistory(limit?: number): HumanReviewRequest[];
    initialize(): Promise<void>;
    handleResponse(requestId: string, response: any): void;
}
//# sourceMappingURL=hitl-manager.d.ts.map
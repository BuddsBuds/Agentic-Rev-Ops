import { EventEmitter } from 'events';
export interface DataSource {
    id: string;
    name: string;
    type: 'api' | 'websocket' | 'rss' | 'scraper';
    category: 'news' | 'social' | 'regulatory' | 'financial' | 'research' | 'patent';
    priority: 'critical' | 'high' | 'medium' | 'low';
    updateFrequency: number;
    retryPolicy: RetryPolicy;
    authentication?: AuthConfig;
    rateLimit?: RateLimitConfig;
}
interface RetryPolicy {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
}
interface AuthConfig {
    type: 'api-key' | 'oauth2' | 'basic' | 'bearer';
    credentials: Record<string, string>;
}
interface RateLimitConfig {
    requestsPerMinute: number;
    burstCapacity: number;
}
export declare class DataSourceManager extends EventEmitter {
    private sources;
    private connections;
    private rateLimiters;
    constructor();
    private initializeDefaultSources;
    registerSource(source: DataSource): void;
    connectSource(sourceId: string): Promise<void>;
    private connectWebSocket;
    private validateAPIConnection;
    private validateRSSFeed;
    private initializeScraper;
    private startPolling;
    private fetchData;
    private fetchBloombergData;
    private fetchReutersData;
    private fetchSECFilings;
    private fetchPatentData;
    private fetchResearchPapers;
    private makeAPIRequest;
    private getAuthHeaders;
    private getAPIURL;
    private getWebSocketURL;
    private handleReconnection;
}
export declare class SocialMediaStreamProcessor {
    private sentimentAnalyzer;
    private influencerDatabase;
    processTweet(tweet: any): Promise<SocialSignal>;
    private analyzeSentiment;
    private getInfluencerScore;
    private calculateReach;
    private calculateEngagement;
}
export interface SocialSignal {
    platform: string;
    type: string;
    sentiment: number;
    reach: number;
    engagement: number;
    influencerScore: number;
    timestamp: Date;
    content: string;
    metadata: Record<string, any>;
}
export {};
//# sourceMappingURL=data-sources.d.ts.map
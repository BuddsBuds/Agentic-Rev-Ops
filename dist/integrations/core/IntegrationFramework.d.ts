import { EventEmitter } from 'events';
import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { AuthenticationManager } from '../../core/security/authentication';
import { SwarmMemory } from '../../swarm/memory/SwarmMemory';
import { HITLSystem } from '../../workflow/hitl/HITLSystem';
export interface IntegrationConfig {
    id: string;
    name: string;
    type: 'oauth2' | 'api_key' | 'basic' | 'jwt' | 'custom';
    baseUrl: string;
    authConfig: AuthConfig;
    rateLimiting?: RateLimitConfig;
    retryConfig?: RetryConfig;
    webhookConfig?: WebhookConfig;
    healthCheckEndpoint?: string;
    customHeaders?: Record<string, string>;
    timeout?: number;
    maxConcurrentRequests?: number;
    cacheConfig?: CacheConfig;
}
export interface AuthConfig {
    type: 'oauth2' | 'api_key' | 'basic' | 'jwt' | 'custom';
    oauth2?: OAuth2Config;
    apiKey?: ApiKeyConfig;
    basic?: BasicAuthConfig;
    jwt?: JWTConfig;
    custom?: CustomAuthConfig;
}
export interface OAuth2Config {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
    scopes: string[];
    redirectUri: string;
    grantType: 'authorization_code' | 'client_credentials' | 'refresh_token';
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
}
export interface ApiKeyConfig {
    key: string;
    headerName?: string;
    paramName?: string;
    placement: 'header' | 'query' | 'body';
}
export interface BasicAuthConfig {
    username: string;
    password: string;
}
export interface JWTConfig {
    token: string;
    algorithm?: string;
    expiresAt?: Date;
    refreshToken?: string;
}
export interface CustomAuthConfig {
    handler: (request: AxiosRequestConfig) => Promise<AxiosRequestConfig>;
    refreshHandler?: () => Promise<any>;
}
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    retryAfterMs?: number;
    strategy: 'fixed' | 'sliding' | 'token-bucket';
    respectRetryAfter: boolean;
}
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    retryableStatuses: number[];
    retryableErrors: string[];
}
export interface WebhookConfig {
    endpoint: string;
    secret?: string;
    events: string[];
    headers?: Record<string, string>;
    retryPolicy?: RetryConfig;
}
export interface CacheConfig {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
    strategy: 'lru' | 'lfu' | 'ttl';
    excludePatterns?: RegExp[];
}
export interface IntegrationMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime?: Date;
    rateLimitHits: number;
    cacheHits: number;
    cacheMisses: number;
    activeConnections: number;
}
export interface RequestContext {
    integrationId: string;
    requestId: string;
    startTime: Date;
    metadata?: any;
    retryCount?: number;
    cached?: boolean;
}
export declare abstract class BaseIntegration extends EventEmitter {
    protected config: IntegrationConfig;
    protected client: AxiosInstance;
    protected metrics: IntegrationMetrics;
    protected rateLimitState: Map<string, number>;
    protected requestQueue: Array<() => Promise<any>>;
    protected activeRequests: number;
    protected cache: Map<string, {
        data: any;
        expiresAt: Date;
    }>;
    protected isHealthy: boolean;
    protected lastHealthCheck?: Date;
    constructor(config: IntegrationConfig);
    protected initializeMetrics(): IntegrationMetrics;
    protected createClient(): AxiosInstance;
    protected setupInterceptors(): void;
    protected authenticateRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig>;
    protected authenticateOAuth2(config: AxiosRequestConfig, oauth2Config: OAuth2Config): Promise<AxiosRequestConfig>;
    protected refreshOAuth2Token(oauth2Config: OAuth2Config): Promise<void>;
    protected authenticateApiKey(config: AxiosRequestConfig, apiKeyConfig: ApiKeyConfig): AxiosRequestConfig;
    protected authenticateBasic(config: AxiosRequestConfig, basicConfig: BasicAuthConfig): AxiosRequestConfig;
    protected authenticateJWT(config: AxiosRequestConfig, jwtConfig: JWTConfig): Promise<AxiosRequestConfig>;
    protected handleSuccessResponse(response: AxiosResponse): AxiosResponse;
    protected handleErrorResponse(error: any): Promise<any>;
    protected handleRateLimit(error: any): Promise<any>;
    protected getRetryAfterMs(response: AxiosResponse): number;
    protected shouldRetry(error: any): boolean;
    protected retryRequest(error: any): Promise<any>;
    protected updateRateLimitState(response: AxiosResponse): void;
    protected updateResponseTime(config: any): void;
    protected checkRateLimit(): Promise<boolean>;
    protected withRateLimit<T>(fn: () => Promise<T>): Promise<T>;
    protected processRequestQueue(): void;
    protected getCacheKey(config: AxiosRequestConfig): string;
    protected withCache<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T>;
    protected cleanupCache(): void;
    protected startHealthChecking(): void;
    protected performHealthCheck(): Promise<void>;
    protected delay(ms: number): Promise<void>;
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    getMetrics(): IntegrationMetrics;
    isConnected(): boolean;
    getRateLimitStatus(): {
        remaining?: number;
        reset?: Date;
    };
    clearCache(): void;
    abstract testConnection(): Promise<boolean>;
    abstract initialize(): Promise<void>;
    abstract cleanup(): Promise<void>;
}
export declare class IntegrationManager extends EventEmitter {
    private integrations;
    private swarmMemory;
    private hitlSystem?;
    private authManager?;
    constructor(swarmMemory: SwarmMemory, hitlSystem?: HITLSystem, authManager?: AuthenticationManager);
    registerIntegration(integration: BaseIntegration): Promise<void>;
    unregisterIntegration(integrationId: string): Promise<void>;
    getIntegration(integrationId: string): BaseIntegration | undefined;
    getAllIntegrations(): BaseIntegration[];
    testAllConnections(): Promise<Map<string, boolean>>;
    getMetrics(): Map<string, IntegrationMetrics>;
    cleanup(): Promise<void>;
}
export default IntegrationManager;
//# sourceMappingURL=IntegrationFramework.d.ts.map
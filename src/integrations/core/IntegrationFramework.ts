/**
 * Core Integration Framework for Agentic RevOps
 * Provides unified API integration capabilities with authentication,
 * rate limiting, error handling, and connection management
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
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

export abstract class BaseIntegration extends EventEmitter {
  protected config: IntegrationConfig;
  protected client: AxiosInstance;
  protected metrics: IntegrationMetrics;
  protected rateLimitState: Map<string, number> = new Map();
  protected requestQueue: Array<() => Promise<any>> = new Array();
  protected activeRequests: number = 0;
  protected cache: Map<string, { data: any; expiresAt: Date }> = new Map();
  protected isHealthy: boolean = true;
  protected lastHealthCheck?: Date;

  constructor(config: IntegrationConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.client = this.createClient();
    this.setupInterceptors();
    this.startHealthChecking();
  }

  protected initializeMetrics(): IntegrationMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
      cacheHits: 0,
      cacheMisses: 0,
      activeConnections: 0
    };
  }

  protected createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        'User-Agent': 'Agentic-RevOps/1.0',
        ...this.config.customHeaders
      }
    });
  }

  protected setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => await this.authenticateRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and metrics
    this.client.interceptors.response.use(
      (response) => this.handleSuccessResponse(response),
      (error) => this.handleErrorResponse(error)
    );
  }

  protected async authenticateRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    const authConfig = this.config.authConfig;

    switch (authConfig.type) {
      case 'oauth2':
        return await this.authenticateOAuth2(config, authConfig.oauth2!);
      
      case 'api_key':
        return this.authenticateApiKey(config, authConfig.apiKey!);
      
      case 'basic':
        return this.authenticateBasic(config, authConfig.basic!);
      
      case 'jwt':
        return await this.authenticateJWT(config, authConfig.jwt!);
      
      case 'custom':
        return await authConfig.custom!.handler(config);
      
      default:
        return config;
    }
  }

  protected async authenticateOAuth2(
    config: AxiosRequestConfig, 
    oauth2Config: OAuth2Config
  ): Promise<AxiosRequestConfig> {
    // Check if token needs refresh
    if (oauth2Config.expiresAt && oauth2Config.expiresAt < new Date()) {
      await this.refreshOAuth2Token(oauth2Config);
    }

    if (oauth2Config.accessToken) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${oauth2Config.accessToken}`
      };
    }

    return config;
  }

  protected async refreshOAuth2Token(oauth2Config: OAuth2Config): Promise<void> {
    if (!oauth2Config.refreshToken || !oauth2Config.refreshUrl) {
      throw new Error('Cannot refresh OAuth2 token: missing refresh token or URL');
    }

    try {
      const response = await axios.post(oauth2Config.refreshUrl, {
        grant_type: 'refresh_token',
        refresh_token: oauth2Config.refreshToken,
        client_id: oauth2Config.clientId,
        client_secret: oauth2Config.clientSecret
      });

      oauth2Config.accessToken = response.data.access_token;
      if (response.data.refresh_token) {
        oauth2Config.refreshToken = response.data.refresh_token;
      }
      if (response.data.expires_in) {
        oauth2Config.expiresAt = new Date(Date.now() + response.data.expires_in * 1000);
      }

      this.emit('auth:refreshed', { integrationId: this.config.id });
    } catch (error) {
      this.emit('auth:refresh_failed', { integrationId: this.config.id, error });
      throw error;
    }
  }

  protected authenticateApiKey(
    config: AxiosRequestConfig, 
    apiKeyConfig: ApiKeyConfig
  ): AxiosRequestConfig {
    switch (apiKeyConfig.placement) {
      case 'header':
        config.headers = {
          ...config.headers,
          [apiKeyConfig.headerName || 'X-API-Key']: apiKeyConfig.key
        };
        break;
      
      case 'query':
        config.params = {
          ...config.params,
          [apiKeyConfig.paramName || 'api_key']: apiKeyConfig.key
        };
        break;
      
      case 'body':
        if (config.method?.toLowerCase() !== 'get') {
          config.data = {
            ...config.data,
            [apiKeyConfig.paramName || 'api_key']: apiKeyConfig.key
          };
        }
        break;
    }

    return config;
  }

  protected authenticateBasic(
    config: AxiosRequestConfig, 
    basicConfig: BasicAuthConfig
  ): AxiosRequestConfig {
    const credentials = Buffer.from(`${basicConfig.username}:${basicConfig.password}`).toString('base64');
    
    config.headers = {
      ...config.headers,
      'Authorization': `Basic ${credentials}`
    };

    return config;
  }

  protected async authenticateJWT(
    config: AxiosRequestConfig, 
    jwtConfig: JWTConfig
  ): Promise<AxiosRequestConfig> {
    // Check if token needs refresh
    if (jwtConfig.expiresAt && jwtConfig.expiresAt < new Date() && jwtConfig.refreshToken) {
      // Implement JWT refresh logic based on your auth system
      this.emit('auth:jwt_expired', { integrationId: this.config.id });
    }

    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${jwtConfig.token}`
    };

    return config;
  }

  protected handleSuccessResponse(response: AxiosResponse): AxiosResponse {
    // Update metrics
    this.metrics.successfulRequests++;
    this.updateResponseTime(response.config);

    // Handle rate limit headers
    this.updateRateLimitState(response);

    this.emit('request:success', {
      integrationId: this.config.id,
      status: response.status,
      url: response.config.url
    });

    return response;
  }

  protected async handleErrorResponse(error: any): Promise<any> {
    this.metrics.failedRequests++;

    // Check if it's a rate limit error
    if (error.response?.status === 429) {
      return await this.handleRateLimit(error);
    }

    // Check if request should be retried
    if (this.shouldRetry(error)) {
      return await this.retryRequest(error);
    }

    this.emit('request:failed', {
      integrationId: this.config.id,
      error: error.message,
      status: error.response?.status
    });

    throw error;
  }

  protected async handleRateLimit(error: any): Promise<any> {
    this.metrics.rateLimitHits++;

    const retryAfter = this.getRetryAfterMs(error.response);
    
    this.emit('rate_limit:hit', {
      integrationId: this.config.id,
      retryAfter
    });

    if (this.config.rateLimiting?.respectRetryAfter) {
      await this.delay(retryAfter);
      return await this.client.request(error.config);
    }

    throw error;
  }

  protected getRetryAfterMs(response: AxiosResponse): number {
    const retryAfterHeader = response.headers['retry-after'];
    
    if (!retryAfterHeader) {
      return this.config.rateLimiting?.retryAfterMs || 60000;
    }

    // Check if it's a number (seconds) or date
    const retryAfterNum = Number(retryAfterHeader);
    
    if (!isNaN(retryAfterNum)) {
      return retryAfterNum * 1000;
    }

    // Try to parse as date
    const retryAfterDate = new Date(retryAfterHeader);
    if (!isNaN(retryAfterDate.getTime())) {
      return Math.max(0, retryAfterDate.getTime() - Date.now());
    }

    return this.config.rateLimiting?.retryAfterMs || 60000;
  }

  protected shouldRetry(error: any): boolean {
    if (!this.config.retryConfig) return false;

    const retryConfig = this.config.retryConfig;
    const retryCount = error.config?._retryCount || 0;

    if (retryCount >= retryConfig.maxRetries) return false;

    // Check status codes
    if (error.response?.status && retryConfig.retryableStatuses.includes(error.response.status)) {
      return true;
    }

    // Check error codes
    if (error.code && retryConfig.retryableErrors.includes(error.code)) {
      return true;
    }

    return false;
  }

  protected async retryRequest(error: any): Promise<any> {
    const retryConfig = this.config.retryConfig!;
    const retryCount = error.config._retryCount || 0;
    
    error.config._retryCount = retryCount + 1;

    const delay = Math.min(
      retryConfig.initialDelayMs * Math.pow(retryConfig.backoffFactor, retryCount),
      retryConfig.maxDelayMs
    );

    this.emit('request:retry', {
      integrationId: this.config.id,
      retryCount: retryCount + 1,
      delay
    });

    await this.delay(delay);
    return await this.client.request(error.config);
  }

  protected updateRateLimitState(response: AxiosResponse): void {
    if (!this.config.rateLimiting) return;

    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];

    if (remaining !== undefined) {
      this.rateLimitState.set('remaining', parseInt(remaining));
    }

    if (reset !== undefined) {
      this.rateLimitState.set('reset', parseInt(reset));
    }
  }

  protected updateResponseTime(config: any): void {
    if (!config._startTime) return;

    const responseTime = Date.now() - config._startTime;
    const totalTime = this.metrics.averageResponseTime * this.metrics.totalRequests;
    
    this.metrics.totalRequests++;
    this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRequests;
    this.metrics.lastRequestTime = new Date();
  }

  protected async checkRateLimit(): Promise<boolean> {
    if (!this.config.rateLimiting) return true;

    const rateLimitConfig = this.config.rateLimiting;
    const remaining = this.rateLimitState.get('remaining');

    if (remaining !== undefined && remaining <= 0) {
      const reset = this.rateLimitState.get('reset');
      if (reset && reset * 1000 > Date.now()) {
        return false;
      }
    }

    // Implement token bucket or sliding window logic
    return true;
  }

  protected async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can make a request
    if (!await this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    // Check concurrent request limit
    if (this.config.maxConcurrentRequests && this.activeRequests >= this.config.maxConcurrentRequests) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    this.activeRequests++;
    
    try {
      const result = await fn();
      this.processRequestQueue();
      return result;
    } finally {
      this.activeRequests--;
    }
  }

  protected processRequestQueue(): void {
    if (this.requestQueue.length === 0) return;
    if (this.activeRequests >= (this.config.maxConcurrentRequests || Infinity)) return;

    const nextRequest = this.requestQueue.shift();
    if (nextRequest) {
      nextRequest();
    }
  }

  protected getCacheKey(config: AxiosRequestConfig): string {
    return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
  }

  protected async withCache<T>(
    key: string, 
    fn: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    if (!this.config.cacheConfig?.enabled) {
      return await fn();
    }

    // Check cache
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > new Date()) {
      this.metrics.cacheHits++;
      return cached.data;
    }

    this.metrics.cacheMisses++;

    // Execute function
    const result = await fn();

    // Store in cache
    const expiresAt = new Date(Date.now() + (ttl || this.config.cacheConfig.ttlMs));
    this.cache.set(key, { data: result, expiresAt });

    // Cleanup old cache entries
    this.cleanupCache();

    return result;
  }

  protected cleanupCache(): void {
    if (!this.config.cacheConfig) return;

    const now = new Date();
    const entriesToDelete: string[] = [];

    // Remove expired entries
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) {
        entriesToDelete.push(key);
      }
    }

    // Remove entries if cache is too large
    if (this.cache.size > this.config.cacheConfig.maxSize) {
      const entriesToRemove = this.cache.size - this.config.cacheConfig.maxSize;
      const keys = Array.from(this.cache.keys());
      
      // Simple FIFO for now
      for (let i = 0; i < entriesToRemove; i++) {
        entriesToDelete.push(keys[i]);
      }
    }

    entriesToDelete.forEach(key => this.cache.delete(key));
  }

  protected startHealthChecking(): void {
    if (!this.config.healthCheckEndpoint) return;

    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Check every minute
  }

  protected async performHealthCheck(): Promise<void> {
    if (!this.config.healthCheckEndpoint) return;

    try {
      const response = await this.client.get(this.config.healthCheckEndpoint, {
        timeout: 5000
      });

      this.isHealthy = response.status >= 200 && response.status < 300;
      this.lastHealthCheck = new Date();

      this.emit('health:checked', {
        integrationId: this.config.id,
        healthy: this.isHealthy,
        status: response.status
      });

    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      this.emit('health:check_failed', {
        integrationId: this.config.id,
        error
      });
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods

  public async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    config._startTime = Date.now();

    return await this.withRateLimit(async () => {
      const cacheKey = this.getCacheKey(config);
      
      if (config.method?.toLowerCase() === 'get' && this.config.cacheConfig?.enabled) {
        return await this.withCache(cacheKey, async () => {
          return await this.client.request<T>(config);
        });
      }

      return await this.client.request<T>(config);
    });
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.request<T>({ ...config, method: 'GET', url });
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.request<T>({ ...config, method: 'POST', url, data });
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.request<T>({ ...config, method: 'PUT', url, data });
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.request<T>({ ...config, method: 'DELETE', url });
  }

  public getMetrics(): IntegrationMetrics {
    return { ...this.metrics };
  }

  public isConnected(): boolean {
    return this.isHealthy;
  }

  public getRateLimitStatus(): { remaining?: number; reset?: Date } {
    const remaining = this.rateLimitState.get('remaining');
    const reset = this.rateLimitState.get('reset');

    return {
      remaining,
      reset: reset ? new Date(reset * 1000) : undefined
    };
  }

  public clearCache(): void {
    this.cache.clear();
    this.emit('cache:cleared', { integrationId: this.config.id });
  }

  public abstract testConnection(): Promise<boolean>;
  public abstract initialize(): Promise<void>;
  public abstract cleanup(): Promise<void>;
}

/**
 * Integration Manager - Manages all integrations
 */
export class IntegrationManager extends EventEmitter {
  private integrations: Map<string, BaseIntegration> = new Map();
  private swarmMemory: SwarmMemory;
  private hitlSystem?: HITLSystem;
  private authManager?: AuthenticationManager;

  constructor(swarmMemory: SwarmMemory, hitlSystem?: HITLSystem, authManager?: AuthenticationManager) {
    super();
    this.swarmMemory = swarmMemory;
    this.hitlSystem = hitlSystem;
    this.authManager = authManager;
  }

  public async registerIntegration(integration: BaseIntegration): Promise<void> {
    const config = integration['config'];
    
    if (this.integrations.has(config.id)) {
      throw new Error(`Integration ${config.id} already registered`);
    }

    await integration.initialize();
    this.integrations.set(config.id, integration);

    // Setup event forwarding
    integration.on('request:success', (data) => this.emit('integration:request_success', data));
    integration.on('request:failed', (data) => this.emit('integration:request_failed', data));
    integration.on('rate_limit:hit', (data) => this.emit('integration:rate_limit', data));
    integration.on('health:checked', (data) => this.emit('integration:health_checked', data));

    // Store in memory
    await this.swarmMemory.store(`integration:${config.id}:registered`, {
      id: config.id,
      name: config.name,
      type: config.type,
      timestamp: new Date()
    });

    this.emit('integration:registered', { integrationId: config.id });
  }

  public async unregisterIntegration(integrationId: string): Promise<void> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    await integration.cleanup();
    this.integrations.delete(integrationId);

    await this.swarmMemory.store(`integration:${integrationId}:unregistered`, {
      timestamp: new Date()
    });

    this.emit('integration:unregistered', { integrationId });
  }

  public getIntegration(integrationId: string): BaseIntegration | undefined {
    return this.integrations.get(integrationId);
  }

  public getAllIntegrations(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }

  public async testAllConnections(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, integration] of this.integrations) {
      try {
        const isConnected = await integration.testConnection();
        results.set(id, isConnected);
      } catch (error) {
        results.set(id, false);
        this.emit('integration:connection_test_failed', { integrationId: id, error });
      }
    }

    return results;
  }

  public getMetrics(): Map<string, IntegrationMetrics> {
    const metrics = new Map<string, IntegrationMetrics>();

    for (const [id, integration] of this.integrations) {
      metrics.set(id, integration.getMetrics());
    }

    return metrics;
  }

  public async cleanup(): Promise<void> {
    for (const integration of this.integrations.values()) {
      await integration.cleanup();
    }

    this.integrations.clear();
  }
}

export default IntegrationManager;
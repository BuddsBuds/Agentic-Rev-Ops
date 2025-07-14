"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationManager = exports.BaseIntegration = void 0;
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
class BaseIntegration extends events_1.EventEmitter {
    config;
    client;
    metrics;
    rateLimitState = new Map();
    requestQueue = new Array();
    activeRequests = 0;
    cache = new Map();
    isHealthy = true;
    lastHealthCheck;
    constructor(config) {
        super();
        this.config = config;
        this.metrics = this.initializeMetrics();
        this.client = this.createClient();
        this.setupInterceptors();
        this.startHealthChecking();
    }
    initializeMetrics() {
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
    createClient() {
        return axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout || 30000,
            headers: {
                'User-Agent': 'Agentic-RevOps/1.0',
                ...this.config.customHeaders
            }
        });
    }
    setupInterceptors() {
        this.client.interceptors.request.use(async (config) => await this.authenticateRequest(config), (error) => Promise.reject(error));
        this.client.interceptors.response.use((response) => this.handleSuccessResponse(response), (error) => this.handleErrorResponse(error));
    }
    async authenticateRequest(config) {
        const authConfig = this.config.authConfig;
        switch (authConfig.type) {
            case 'oauth2':
                return await this.authenticateOAuth2(config, authConfig.oauth2);
            case 'api_key':
                return this.authenticateApiKey(config, authConfig.apiKey);
            case 'basic':
                return this.authenticateBasic(config, authConfig.basic);
            case 'jwt':
                return await this.authenticateJWT(config, authConfig.jwt);
            case 'custom':
                return await authConfig.custom.handler(config);
            default:
                return config;
        }
    }
    async authenticateOAuth2(config, oauth2Config) {
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
    async refreshOAuth2Token(oauth2Config) {
        if (!oauth2Config.refreshToken || !oauth2Config.refreshUrl) {
            throw new Error('Cannot refresh OAuth2 token: missing refresh token or URL');
        }
        try {
            const response = await axios_1.default.post(oauth2Config.refreshUrl, {
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
        }
        catch (error) {
            this.emit('auth:refresh_failed', { integrationId: this.config.id, error });
            throw error;
        }
    }
    authenticateApiKey(config, apiKeyConfig) {
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
    authenticateBasic(config, basicConfig) {
        const credentials = Buffer.from(`${basicConfig.username}:${basicConfig.password}`).toString('base64');
        config.headers = {
            ...config.headers,
            'Authorization': `Basic ${credentials}`
        };
        return config;
    }
    async authenticateJWT(config, jwtConfig) {
        if (jwtConfig.expiresAt && jwtConfig.expiresAt < new Date() && jwtConfig.refreshToken) {
            this.emit('auth:jwt_expired', { integrationId: this.config.id });
        }
        config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${jwtConfig.token}`
        };
        return config;
    }
    handleSuccessResponse(response) {
        this.metrics.successfulRequests++;
        this.updateResponseTime(response.config);
        this.updateRateLimitState(response);
        this.emit('request:success', {
            integrationId: this.config.id,
            status: response.status,
            url: response.config.url
        });
        return response;
    }
    async handleErrorResponse(error) {
        this.metrics.failedRequests++;
        if (error.response?.status === 429) {
            return await this.handleRateLimit(error);
        }
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
    async handleRateLimit(error) {
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
    getRetryAfterMs(response) {
        const retryAfterHeader = response.headers['retry-after'];
        if (!retryAfterHeader) {
            return this.config.rateLimiting?.retryAfterMs || 60000;
        }
        const retryAfterNum = Number(retryAfterHeader);
        if (!isNaN(retryAfterNum)) {
            return retryAfterNum * 1000;
        }
        const retryAfterDate = new Date(retryAfterHeader);
        if (!isNaN(retryAfterDate.getTime())) {
            return Math.max(0, retryAfterDate.getTime() - Date.now());
        }
        return this.config.rateLimiting?.retryAfterMs || 60000;
    }
    shouldRetry(error) {
        if (!this.config.retryConfig)
            return false;
        const retryConfig = this.config.retryConfig;
        const retryCount = error.config?._retryCount || 0;
        if (retryCount >= retryConfig.maxRetries)
            return false;
        if (error.response?.status && retryConfig.retryableStatuses.includes(error.response.status)) {
            return true;
        }
        if (error.code && retryConfig.retryableErrors.includes(error.code)) {
            return true;
        }
        return false;
    }
    async retryRequest(error) {
        const retryConfig = this.config.retryConfig;
        const retryCount = error.config._retryCount || 0;
        error.config._retryCount = retryCount + 1;
        const delay = Math.min(retryConfig.initialDelayMs * Math.pow(retryConfig.backoffFactor, retryCount), retryConfig.maxDelayMs);
        this.emit('request:retry', {
            integrationId: this.config.id,
            retryCount: retryCount + 1,
            delay
        });
        await this.delay(delay);
        return await this.client.request(error.config);
    }
    updateRateLimitState(response) {
        if (!this.config.rateLimiting)
            return;
        const remaining = response.headers['x-ratelimit-remaining'];
        const reset = response.headers['x-ratelimit-reset'];
        if (remaining !== undefined) {
            this.rateLimitState.set('remaining', parseInt(remaining));
        }
        if (reset !== undefined) {
            this.rateLimitState.set('reset', parseInt(reset));
        }
    }
    updateResponseTime(config) {
        if (!config._startTime)
            return;
        const responseTime = Date.now() - config._startTime;
        const totalTime = this.metrics.averageResponseTime * this.metrics.totalRequests;
        this.metrics.totalRequests++;
        this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRequests;
        this.metrics.lastRequestTime = new Date();
    }
    async checkRateLimit() {
        if (!this.config.rateLimiting)
            return true;
        const rateLimitConfig = this.config.rateLimiting;
        const remaining = this.rateLimitState.get('remaining');
        if (remaining !== undefined && remaining <= 0) {
            const reset = this.rateLimitState.get('reset');
            if (reset && reset * 1000 > Date.now()) {
                return false;
            }
        }
        return true;
    }
    async withRateLimit(fn) {
        if (!await this.checkRateLimit()) {
            throw new Error('Rate limit exceeded');
        }
        if (this.config.maxConcurrentRequests && this.activeRequests >= this.config.maxConcurrentRequests) {
            return new Promise((resolve, reject) => {
                this.requestQueue.push(async () => {
                    try {
                        const result = await fn();
                        resolve(result);
                    }
                    catch (error) {
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
        }
        finally {
            this.activeRequests--;
        }
    }
    processRequestQueue() {
        if (this.requestQueue.length === 0)
            return;
        if (this.activeRequests >= (this.config.maxConcurrentRequests || Infinity))
            return;
        const nextRequest = this.requestQueue.shift();
        if (nextRequest) {
            nextRequest();
        }
    }
    getCacheKey(config) {
        return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
    }
    async withCache(key, fn, ttl) {
        if (!this.config.cacheConfig?.enabled) {
            return await fn();
        }
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > new Date()) {
            this.metrics.cacheHits++;
            return cached.data;
        }
        this.metrics.cacheMisses++;
        const result = await fn();
        const expiresAt = new Date(Date.now() + (ttl || this.config.cacheConfig.ttlMs));
        this.cache.set(key, { data: result, expiresAt });
        this.cleanupCache();
        return result;
    }
    cleanupCache() {
        if (!this.config.cacheConfig)
            return;
        const now = new Date();
        const entriesToDelete = [];
        for (const [key, value] of this.cache.entries()) {
            if (value.expiresAt < now) {
                entriesToDelete.push(key);
            }
        }
        if (this.cache.size > this.config.cacheConfig.maxSize) {
            const entriesToRemove = this.cache.size - this.config.cacheConfig.maxSize;
            const keys = Array.from(this.cache.keys());
            for (let i = 0; i < entriesToRemove; i++) {
                entriesToDelete.push(keys[i]);
            }
        }
        entriesToDelete.forEach(key => this.cache.delete(key));
    }
    startHealthChecking() {
        if (!this.config.healthCheckEndpoint)
            return;
        setInterval(async () => {
            await this.performHealthCheck();
        }, 60000);
    }
    async performHealthCheck() {
        if (!this.config.healthCheckEndpoint)
            return;
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
        }
        catch (error) {
            this.isHealthy = false;
            this.lastHealthCheck = new Date();
            this.emit('health:check_failed', {
                integrationId: this.config.id,
                error
            });
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async request(config) {
        config._startTime = Date.now();
        return await this.withRateLimit(async () => {
            const cacheKey = this.getCacheKey(config);
            if (config.method?.toLowerCase() === 'get' && this.config.cacheConfig?.enabled) {
                return await this.withCache(cacheKey, async () => {
                    return await this.client.request(config);
                });
            }
            return await this.client.request(config);
        });
    }
    async get(url, config) {
        return await this.request({ ...config, method: 'GET', url });
    }
    async post(url, data, config) {
        return await this.request({ ...config, method: 'POST', url, data });
    }
    async put(url, data, config) {
        return await this.request({ ...config, method: 'PUT', url, data });
    }
    async patch(url, data, config) {
        return await this.request({ ...config, method: 'PATCH', url, data });
    }
    async delete(url, config) {
        return await this.request({ ...config, method: 'DELETE', url });
    }
    getMetrics() {
        return { ...this.metrics };
    }
    isConnected() {
        return this.isHealthy;
    }
    getRateLimitStatus() {
        const remaining = this.rateLimitState.get('remaining');
        const reset = this.rateLimitState.get('reset');
        return {
            remaining,
            reset: reset ? new Date(reset * 1000) : undefined
        };
    }
    clearCache() {
        this.cache.clear();
        this.emit('cache:cleared', { integrationId: this.config.id });
    }
}
exports.BaseIntegration = BaseIntegration;
class IntegrationManager extends events_1.EventEmitter {
    integrations = new Map();
    swarmMemory;
    hitlSystem;
    authManager;
    constructor(swarmMemory, hitlSystem, authManager) {
        super();
        this.swarmMemory = swarmMemory;
        this.hitlSystem = hitlSystem;
        this.authManager = authManager;
    }
    async registerIntegration(integration) {
        const config = integration['config'];
        if (this.integrations.has(config.id)) {
            throw new Error(`Integration ${config.id} already registered`);
        }
        await integration.initialize();
        this.integrations.set(config.id, integration);
        integration.on('request:success', (data) => this.emit('integration:request_success', data));
        integration.on('request:failed', (data) => this.emit('integration:request_failed', data));
        integration.on('rate_limit:hit', (data) => this.emit('integration:rate_limit', data));
        integration.on('health:checked', (data) => this.emit('integration:health_checked', data));
        await this.swarmMemory.store(`integration:${config.id}:registered`, {
            id: config.id,
            name: config.name,
            type: config.type,
            timestamp: new Date()
        });
        this.emit('integration:registered', { integrationId: config.id });
    }
    async unregisterIntegration(integrationId) {
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
    getIntegration(integrationId) {
        return this.integrations.get(integrationId);
    }
    getAllIntegrations() {
        return Array.from(this.integrations.values());
    }
    async testAllConnections() {
        const results = new Map();
        for (const [id, integration] of this.integrations) {
            try {
                const isConnected = await integration.testConnection();
                results.set(id, isConnected);
            }
            catch (error) {
                results.set(id, false);
                this.emit('integration:connection_test_failed', { integrationId: id, error });
            }
        }
        return results;
    }
    getMetrics() {
        const metrics = new Map();
        for (const [id, integration] of this.integrations) {
            metrics.set(id, integration.getMetrics());
        }
        return metrics;
    }
    async cleanup() {
        for (const integration of this.integrations.values()) {
            await integration.cleanup();
        }
        this.integrations.clear();
    }
}
exports.IntegrationManager = IntegrationManager;
exports.default = IntegrationManager;
//# sourceMappingURL=IntegrationFramework.js.map
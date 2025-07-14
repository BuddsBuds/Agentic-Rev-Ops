"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaStreamProcessor = exports.DataSourceManager = void 0;
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
const ws_1 = require("ws");
class DataSourceManager extends events_1.EventEmitter {
    sources = new Map();
    connections = new Map();
    rateLimiters = new Map();
    constructor() {
        super();
        this.initializeDefaultSources();
    }
    initializeDefaultSources() {
        this.registerSource({
            id: 'bloomberg-api',
            name: 'Bloomberg Terminal API',
            type: 'api',
            category: 'news',
            priority: 'critical',
            updateFrequency: 60000,
            retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 },
            authentication: { type: 'api-key', credentials: { key: process.env.BLOOMBERG_API_KEY || '' } },
            rateLimit: { requestsPerMinute: 60, burstCapacity: 10 }
        });
        this.registerSource({
            id: 'reuters-connect',
            name: 'Reuters Connect',
            type: 'api',
            category: 'news',
            priority: 'critical',
            updateFrequency: 300000,
            retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 },
            authentication: { type: 'oauth2', credentials: { clientId: process.env.REUTERS_CLIENT_ID || '' } }
        });
        this.registerSource({
            id: 'twitter-stream',
            name: 'Twitter Streaming API',
            type: 'websocket',
            category: 'social',
            priority: 'high',
            updateFrequency: 0,
            retryPolicy: { maxRetries: 5, backoffMultiplier: 2, maxBackoffTime: 60000 },
            authentication: { type: 'bearer', credentials: { token: process.env.TWITTER_BEARER_TOKEN || '' } }
        });
        this.registerSource({
            id: 'linkedin-api',
            name: 'LinkedIn API',
            type: 'api',
            category: 'social',
            priority: 'medium',
            updateFrequency: 900000,
            retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 },
            authentication: { type: 'oauth2', credentials: { accessToken: process.env.LINKEDIN_ACCESS_TOKEN || '' } }
        });
        this.registerSource({
            id: 'sec-edgar',
            name: 'SEC EDGAR Database',
            type: 'api',
            category: 'regulatory',
            priority: 'high',
            updateFrequency: 3600000,
            retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 },
            rateLimit: { requestsPerMinute: 10, burstCapacity: 2 }
        });
        this.registerSource({
            id: 'uspto-api',
            name: 'USPTO Patent API',
            type: 'api',
            category: 'patent',
            priority: 'medium',
            updateFrequency: 86400000,
            retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 }
        });
        this.registerSource({
            id: 'arxiv-api',
            name: 'arXiv Research Papers',
            type: 'api',
            category: 'research',
            priority: 'medium',
            updateFrequency: 21600000,
            retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 }
        });
    }
    registerSource(source) {
        this.sources.set(source.id, source);
        if (source.rateLimit) {
            this.rateLimiters.set(source.id, new RateLimiter(source.rateLimit));
        }
    }
    async connectSource(sourceId) {
        const source = this.sources.get(sourceId);
        if (!source)
            throw new Error(`Source ${sourceId} not found`);
        switch (source.type) {
            case 'websocket':
                await this.connectWebSocket(source);
                break;
            case 'api':
                await this.validateAPIConnection(source);
                break;
            case 'rss':
                await this.validateRSSFeed(source);
                break;
            case 'scraper':
                await this.initializeScraper(source);
                break;
        }
    }
    async connectWebSocket(source) {
        const ws = new ws_1.WebSocket(this.getWebSocketURL(source));
        ws.on('open', () => {
            this.emit('source:connected', { sourceId: source.id });
            this.connections.set(source.id, ws);
        });
        ws.on('message', (data) => {
            this.emit('data:received', {
                sourceId: source.id,
                data: JSON.parse(data.toString()),
                timestamp: new Date()
            });
        });
        ws.on('error', (error) => {
            this.emit('source:error', { sourceId: source.id, error });
            this.handleReconnection(source);
        });
    }
    async validateAPIConnection(source) {
        try {
            const response = await this.makeAPIRequest(source, '/health');
            if (response.status === 200) {
                this.emit('source:connected', { sourceId: source.id });
                this.startPolling(source);
            }
        }
        catch (error) {
            this.emit('source:error', { sourceId: source.id, error });
        }
    }
    async validateRSSFeed(source) {
        try {
            const response = await fetch(source.url);
            if (!response.ok) {
                throw new Error(`RSS feed validation failed: ${response.statusText}`);
            }
            this.emit('source:connected', { sourceId: source.id });
            this.startPolling(source);
        }
        catch (error) {
            this.emit('source:error', { sourceId: source.id, error });
            throw new Error(`Failed to validate RSS feed: ${error}`);
        }
    }
    async initializeScraper(source) {
        try {
            const response = await fetch(source.url);
            if (!response.ok) {
                throw new Error(`Scraper initialization failed: ${response.statusText}`);
            }
            this.emit('source:connected', { sourceId: source.id });
            this.startPolling(source);
        }
        catch (error) {
            this.emit('source:error', { sourceId: source.id, error });
            throw new Error(`Failed to initialize scraper: ${error}`);
        }
    }
    startPolling(source) {
        if (source.updateFrequency === 0)
            return;
        const poll = async () => {
            try {
                const data = await this.fetchData(source);
                this.emit('data:received', {
                    sourceId: source.id,
                    data,
                    timestamp: new Date()
                });
            }
            catch (error) {
                this.emit('source:error', { sourceId: source.id, error });
            }
        };
        poll();
        setInterval(poll, source.updateFrequency);
    }
    async fetchData(source) {
        const rateLimiter = this.rateLimiters.get(source.id);
        if (rateLimiter) {
            await rateLimiter.acquire();
        }
        switch (source.id) {
            case 'bloomberg-api':
                return this.fetchBloombergData(source);
            case 'reuters-connect':
                return this.fetchReutersData(source);
            case 'sec-edgar':
                return this.fetchSECFilings(source);
            case 'uspto-api':
                return this.fetchPatentData(source);
            case 'arxiv-api':
                return this.fetchResearchPapers(source);
            default:
                return this.makeAPIRequest(source, '/data');
        }
    }
    async fetchBloombergData(source) {
        const endpoints = [
            '/market/news',
            '/market/movers',
            '/economic/indicators',
            '/company/earnings'
        ];
        const results = await Promise.all(endpoints.map(endpoint => this.makeAPIRequest(source, endpoint)));
        return {
            news: results[0],
            movers: results[1],
            indicators: results[2],
            earnings: results[3]
        };
    }
    async fetchReutersData(source) {
        return this.makeAPIRequest(source, '/news/top-stories', {
            categories: ['business', 'technology', 'markets', 'politics'],
            limit: 100
        });
    }
    async fetchSECFilings(source) {
        const forms = ['10-K', '10-Q', '8-K', 'S-1', 'DEF 14A'];
        const results = await Promise.all(forms.map(form => this.makeAPIRequest(source, '/filings', {
            form,
            count: 50,
            sort: 'date-desc'
        })));
        return { filings: results.flat() };
    }
    async fetchPatentData(source) {
        return this.makeAPIRequest(source, '/patents/recent', {
            fields: ['title', 'abstract', 'claims', 'assignee', 'filing_date'],
            limit: 100
        });
    }
    async fetchResearchPapers(source) {
        const categories = ['cs.AI', 'cs.LG', 'stat.ML', 'q-fin'];
        const results = await Promise.all(categories.map(cat => this.makeAPIRequest(source, '/query', {
            search_query: `cat:${cat}`,
            sortBy: 'submittedDate',
            sortOrder: 'descending',
            max_results: 50
        })));
        return { papers: results.flat() };
    }
    async makeAPIRequest(source, endpoint, params) {
        const config = {
            params,
            headers: this.getAuthHeaders(source)
        };
        const response = await axios_1.default.get(this.getAPIURL(source) + endpoint, config);
        return response.data;
    }
    getAuthHeaders(source) {
        if (!source.authentication)
            return {};
        const { type, credentials } = source.authentication;
        switch (type) {
            case 'api-key':
                return { 'X-API-Key': credentials.key };
            case 'bearer':
                return { 'Authorization': `Bearer ${credentials.token}` };
            case 'oauth2':
                return { 'Authorization': `Bearer ${credentials.accessToken}` };
            case 'basic':
                const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
                return { 'Authorization': `Basic ${encoded}` };
            default:
                return {};
        }
    }
    getAPIURL(source) {
        const urlMap = {
            'bloomberg-api': 'https://api.bloomberg.com/v1',
            'reuters-connect': 'https://api.reuters.com/v1',
            'sec-edgar': 'https://data.sec.gov/api/v1',
            'uspto-api': 'https://api.uspto.gov/v1',
            'arxiv-api': 'http://export.arxiv.org/api'
        };
        return urlMap[source.id] || '';
    }
    getWebSocketURL(source) {
        const urlMap = {
            'twitter-stream': 'wss://api.twitter.com/2/tweets/search/stream',
            'crypto-stream': 'wss://stream.cryptocompare.com/v2'
        };
        return urlMap[source.id] || '';
    }
    async handleReconnection(source) {
        const { maxRetries, backoffMultiplier, maxBackoffTime } = source.retryPolicy;
        let retries = 0;
        let backoffTime = 1000;
        const reconnect = async () => {
            if (retries >= maxRetries) {
                this.emit('source:failed', { sourceId: source.id });
                return;
            }
            retries++;
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            try {
                await this.connectSource(source.id);
            }
            catch (error) {
                backoffTime = Math.min(backoffTime * backoffMultiplier, maxBackoffTime);
                reconnect();
            }
        };
        reconnect();
    }
}
exports.DataSourceManager = DataSourceManager;
class RateLimiter {
    tokens;
    lastRefill;
    capacity;
    refillRate;
    queue = [];
    constructor(config) {
        this.capacity = config.burstCapacity;
        this.tokens = config.burstCapacity;
        this.refillRate = config.requestsPerMinute / 60;
        this.lastRefill = Date.now();
    }
    async acquire() {
        this.refillTokens();
        if (this.tokens > 0) {
            this.tokens--;
            return;
        }
        return new Promise(resolve => {
            this.queue.push(resolve);
            this.processQueue();
        });
    }
    refillTokens() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
        const tokensToAdd = Math.floor(timePassed * this.refillRate);
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
            this.processQueue();
        }
    }
    processQueue() {
        while (this.queue.length > 0 && this.tokens > 0) {
            const resolve = this.queue.shift();
            if (resolve) {
                this.tokens--;
                resolve();
            }
        }
    }
}
class SocialMediaStreamProcessor {
    sentimentAnalyzer;
    influencerDatabase = new Map();
    async processTweet(tweet) {
        const sentiment = await this.analyzeSentiment(tweet.text);
        const influencerScore = this.getInfluencerScore(tweet.author_id);
        return {
            platform: 'twitter',
            type: 'post',
            sentiment,
            reach: this.calculateReach(tweet),
            engagement: this.calculateEngagement(tweet),
            influencerScore,
            timestamp: new Date(tweet.created_at),
            content: tweet.text,
            metadata: {
                retweets: tweet.public_metrics.retweet_count,
                likes: tweet.public_metrics.like_count,
                replies: tweet.public_metrics.reply_count,
                hashtags: tweet.entities?.hashtags || []
            }
        };
    }
    async analyzeSentiment(text) {
        return Math.random() * 2 - 1;
    }
    getInfluencerScore(authorId) {
        return this.influencerDatabase.get(authorId) || 0;
    }
    calculateReach(tweet) {
        const authorFollowers = tweet.author?.public_metrics?.followers_count || 0;
        const retweets = tweet.public_metrics?.retweet_count || 0;
        return authorFollowers + (retweets * 100);
    }
    calculateEngagement(tweet) {
        const metrics = tweet.public_metrics || {};
        const total = (metrics.retweet_count || 0) +
            (metrics.like_count || 0) +
            (metrics.reply_count || 0);
        const impressions = metrics.impression_count || 1;
        return total / impressions;
    }
}
exports.SocialMediaStreamProcessor = SocialMediaStreamProcessor;
//# sourceMappingURL=data-sources.js.map
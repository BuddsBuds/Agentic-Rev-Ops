// Horizon Scanning Data Source Integration Implementation

import { EventEmitter } from 'events';
import axios from 'axios';
import { WebSocket } from 'ws';
import Parser from 'rss-parser';

// Core interfaces
export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'websocket' | 'rss' | 'scraper';
  category: 'news' | 'social' | 'regulatory' | 'financial' | 'research' | 'patent';
  priority: 'critical' | 'high' | 'medium' | 'low';
  updateFrequency: number; // milliseconds
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

// Data source implementations
export class DataSourceManager extends EventEmitter {
  private sources: Map<string, DataSource> = new Map();
  private connections: Map<string, any> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor() {
    super();
    this.initializeDefaultSources();
  }

  private initializeDefaultSources(): void {
    // News Sources
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

    // Social Media Sources
    this.registerSource({
      id: 'twitter-stream',
      name: 'Twitter Streaming API',
      type: 'websocket',
      category: 'social',
      priority: 'high',
      updateFrequency: 0, // Real-time stream
      retryPolicy: { maxRetries: 5, backoffMultiplier: 2, maxBackoffTime: 60000 },
      authentication: { type: 'bearer', credentials: { token: process.env.TWITTER_BEARER_TOKEN || '' } }
    });

    this.registerSource({
      id: 'linkedin-api',
      name: 'LinkedIn API',
      type: 'api',
      category: 'social',
      priority: 'medium',
      updateFrequency: 900000, // 15 minutes
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 },
      authentication: { type: 'oauth2', credentials: { accessToken: process.env.LINKEDIN_ACCESS_TOKEN || '' } }
    });

    // Regulatory Sources
    this.registerSource({
      id: 'sec-edgar',
      name: 'SEC EDGAR Database',
      type: 'api',
      category: 'regulatory',
      priority: 'high',
      updateFrequency: 3600000, // 1 hour
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 },
      rateLimit: { requestsPerMinute: 10, burstCapacity: 2 }
    });

    // Research & Patents
    this.registerSource({
      id: 'uspto-api',
      name: 'USPTO Patent API',
      type: 'api',
      category: 'patent',
      priority: 'medium',
      updateFrequency: 86400000, // 24 hours
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 }
    });

    this.registerSource({
      id: 'arxiv-api',
      name: 'arXiv Research Papers',
      type: 'api',
      category: 'research',
      priority: 'medium',
      updateFrequency: 21600000, // 6 hours
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, maxBackoffTime: 30000 }
    });
  }

  registerSource(source: DataSource): void {
    this.sources.set(source.id, source);
    if (source.rateLimit) {
      this.rateLimiters.set(source.id, new RateLimiter(source.rateLimit));
    }
  }

  async connectSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);

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

  private async connectWebSocket(source: DataSource): Promise<void> {
    const ws = new WebSocket(this.getWebSocketURL(source));
    
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

  private async validateAPIConnection(source: DataSource): Promise<void> {
    try {
      const response = await this.makeAPIRequest(source, '/health');
      if (response.status === 200) {
        this.emit('source:connected', { sourceId: source.id });
        this.startPolling(source);
      }
    } catch (error) {
      this.emit('source:error', { sourceId: source.id, error });
    }
  }

  private async validateRSSFeed(source: DataSource): Promise<void> {
    // Validate RSS feed accessibility
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`RSS feed validation failed: ${response.statusText}`);
      }
      this.emit('source:connected', { sourceId: source.id });
      this.startPolling(source);
    } catch (error) {
      this.emit('source:error', { sourceId: source.id, error });
      throw new Error(`Failed to validate RSS feed: ${error}`);
    }
  }

  private async initializeScraper(source: DataSource): Promise<void> {
    // Initialize web scraper
    try {
      // Test website accessibility
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Scraper initialization failed: ${response.statusText}`);
      }
      this.emit('source:connected', { sourceId: source.id });
      this.startPolling(source);
    } catch (error) {
      this.emit('source:error', { sourceId: source.id, error });
      throw new Error(`Failed to initialize scraper: ${error}`);
    }
  }

  private startPolling(source: DataSource): void {
    if (source.updateFrequency === 0) return;

    const poll = async () => {
      try {
        const data = await this.fetchData(source);
        this.emit('data:received', {
          sourceId: source.id,
          data,
          timestamp: new Date()
        });
      } catch (error) {
        this.emit('source:error', { sourceId: source.id, error });
      }
    };

    // Initial poll
    poll();

    // Set up recurring polls
    setInterval(poll, source.updateFrequency);
  }

  private async fetchData(source: DataSource): Promise<any> {
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

  private async fetchBloombergData(source: DataSource): Promise<any> {
    // Bloomberg-specific implementation
    const endpoints = [
      '/market/news',
      '/market/movers',
      '/economic/indicators',
      '/company/earnings'
    ];

    const results = await Promise.all(
      endpoints.map(endpoint => this.makeAPIRequest(source, endpoint))
    );

    return {
      news: results[0],
      movers: results[1],
      indicators: results[2],
      earnings: results[3]
    };
  }

  private async fetchReutersData(source: DataSource): Promise<any> {
    // Reuters-specific implementation
    return this.makeAPIRequest(source, '/news/top-stories', {
      categories: ['business', 'technology', 'markets', 'politics'],
      limit: 100
    });
  }

  private async fetchSECFilings(source: DataSource): Promise<any> {
    // SEC EDGAR-specific implementation
    const forms = ['10-K', '10-Q', '8-K', 'S-1', 'DEF 14A'];
    const results = await Promise.all(
      forms.map(form => 
        this.makeAPIRequest(source, '/filings', {
          form,
          count: 50,
          sort: 'date-desc'
        })
      )
    );

    return { filings: results.flat() };
  }

  private async fetchPatentData(source: DataSource): Promise<any> {
    // USPTO-specific implementation
    return this.makeAPIRequest(source, '/patents/recent', {
      fields: ['title', 'abstract', 'claims', 'assignee', 'filing_date'],
      limit: 100
    });
  }

  private async fetchResearchPapers(source: DataSource): Promise<any> {
    // arXiv-specific implementation
    const categories = ['cs.AI', 'cs.LG', 'stat.ML', 'q-fin'];
    const results = await Promise.all(
      categories.map(cat => 
        this.makeAPIRequest(source, '/query', {
          search_query: `cat:${cat}`,
          sortBy: 'submittedDate',
          sortOrder: 'descending',
          max_results: 50
        })
      )
    );

    return { papers: results.flat() };
  }

  private async makeAPIRequest(
    source: DataSource, 
    endpoint: string, 
    params?: Record<string, any>
  ): Promise<any> {
    const config: any = {
      params,
      headers: this.getAuthHeaders(source)
    };

    const response = await axios.get(
      this.getAPIURL(source) + endpoint,
      config
    );

    return response.data;
  }

  private getAuthHeaders(source: DataSource): Record<string, string> {
    if (!source.authentication) return {};

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

  private getAPIURL(source: DataSource): string {
    // Source-specific URL mapping
    const urlMap: Record<string, string> = {
      'bloomberg-api': 'https://api.bloomberg.com/v1',
      'reuters-connect': 'https://api.reuters.com/v1',
      'sec-edgar': 'https://data.sec.gov/api/v1',
      'uspto-api': 'https://api.uspto.gov/v1',
      'arxiv-api': 'http://export.arxiv.org/api'
    };

    return urlMap[source.id] || '';
  }

  private getWebSocketURL(source: DataSource): string {
    const urlMap: Record<string, string> = {
      'twitter-stream': 'wss://api.twitter.com/2/tweets/search/stream',
      'crypto-stream': 'wss://stream.cryptocompare.com/v2'
    };

    return urlMap[source.id] || '';
  }

  private async handleReconnection(source: DataSource): Promise<void> {
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
      } catch (error) {
        backoffTime = Math.min(backoffTime * backoffMultiplier, maxBackoffTime);
        reconnect();
      }
    };

    reconnect();
  }
}

// Rate limiting implementation
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private queue: (() => void)[] = [];

  constructor(config: RateLimitConfig) {
    this.capacity = config.burstCapacity;
    this.tokens = config.burstCapacity;
    this.refillRate = config.requestsPerMinute / 60;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Queue the request
    return new Promise(resolve => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
      this.processQueue();
    }
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens > 0) {
      const resolve = this.queue.shift();
      if (resolve) {
        this.tokens--;
        resolve();
      }
    }
  }
}

// Social media stream processor
export class SocialMediaStreamProcessor {
  private sentimentAnalyzer: any; // Placeholder for NLP service
  private influencerDatabase: Map<string, number> = new Map();

  async processTweet(tweet: any): Promise<SocialSignal> {
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

  private async analyzeSentiment(text: string): Promise<number> {
    // Placeholder for sentiment analysis
    // Would integrate with NLP service
    return Math.random() * 2 - 1; // -1 to 1
  }

  private getInfluencerScore(authorId: string): number {
    return this.influencerDatabase.get(authorId) || 0;
  }

  private calculateReach(tweet: any): number {
    // Calculate potential reach based on metrics
    const authorFollowers = tweet.author?.public_metrics?.followers_count || 0;
    const retweets = tweet.public_metrics?.retweet_count || 0;
    
    return authorFollowers + (retweets * 100); // Simplified calculation
  }

  private calculateEngagement(tweet: any): number {
    const metrics = tweet.public_metrics || {};
    const total = (metrics.retweet_count || 0) + 
                  (metrics.like_count || 0) + 
                  (metrics.reply_count || 0);
    
    const impressions = metrics.impression_count || 1;
    return total / impressions;
  }
}

// Export types
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
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalDetectionEngine = exports.SignalTrajectory = exports.SignalType = void 0;
const events_1 = require("events");
const tf = __importStar(require("@tensorflow/tfjs"));
const simple_statistics_1 = require("simple-statistics");
var SignalType;
(function (SignalType) {
    SignalType["EMERGING_TECHNOLOGY"] = "emerging_technology";
    SignalType["MARKET_SHIFT"] = "market_shift";
    SignalType["REGULATORY_CHANGE"] = "regulatory_change";
    SignalType["CONSUMER_BEHAVIOR"] = "consumer_behavior";
    SignalType["COMPETITIVE_MOVE"] = "competitive_move";
    SignalType["ECONOMIC_INDICATOR"] = "economic_indicator";
    SignalType["SOCIAL_TREND"] = "social_trend";
    SignalType["SUPPLY_CHAIN"] = "supply_chain";
    SignalType["GEOPOLITICAL"] = "geopolitical";
})(SignalType || (exports.SignalType = SignalType = {}));
var SignalTrajectory;
(function (SignalTrajectory) {
    SignalTrajectory["EMERGING"] = "emerging";
    SignalTrajectory["ACCELERATING"] = "accelerating";
    SignalTrajectory["PLATEAUING"] = "plateauing";
    SignalTrajectory["DECLINING"] = "declining";
    SignalTrajectory["CYCLICAL"] = "cyclical";
})(SignalTrajectory || (exports.SignalTrajectory = SignalTrajectory = {}));
class SignalDetectionEngine extends events_1.EventEmitter {
    detectors = new Map();
    signalDatabase = new Map();
    correlationEngine;
    mlModels;
    constructor() {
        super();
        this.correlationEngine = new CorrelationEngine();
        this.mlModels = new MLModelManager();
        this.initializeDetectors();
    }
    initializeDetectors() {
        this.detectors.set('statistical', new StatisticalAnomalyDetector());
        this.detectors.set('pattern', new PatternRecognitionDetector());
        this.detectors.set('nlp', new NLPSignalExtractor());
        this.detectors.set('network', new NetworkEffectAnalyzer());
        this.detectors.set('timeseries', new TimeSeriesAnalyzer());
        this.detectors.set('sentiment', new SentimentShiftDetector());
    }
    async detectSignals(dataStream) {
        const detectorResults = await Promise.all(Array.from(this.detectors.entries()).map(([name, detector]) => detector.detect(dataStream).catch(err => {
            console.error(`Detector ${name} failed:`, err);
            return [];
        })));
        const allSignals = detectorResults.flat();
        const uniqueSignals = this.deduplicateSignals(allSignals);
        const correlatedSignals = await this.correlationEngine.correlate(uniqueSignals);
        const validatedSignals = await this.mlModels.validateSignals(correlatedSignals);
        validatedSignals.forEach(signal => {
            this.signalDatabase.set(signal.id, signal);
            this.emit('signal:detected', signal);
        });
        return validatedSignals;
    }
    deduplicateSignals(signals) {
        const signalMap = new Map();
        signals.forEach(signal => {
            const key = this.generateSignalKey(signal);
            const existing = signalMap.get(key);
            if (!existing || signal.confidence > existing.confidence) {
                signalMap.set(key, signal);
            }
            else if (existing) {
                existing.sources.push(...signal.sources);
                existing.confidence = Math.max(existing.confidence, signal.confidence);
            }
        });
        return Array.from(signalMap.values());
    }
    generateSignalKey(signal) {
        const keywords = signal.metadata.keywords.sort().join('-');
        const type = signal.type;
        const timeWindow = Math.floor(signal.firstDetected.getTime() / (1000 * 60 * 60));
        return `${type}:${keywords}:${timeWindow}`;
    }
    async analyzeSignalStrength(signal) {
        const factors = {
            sourceCredibility: this.calculateSourceCredibility(signal),
            volumeVelocity: this.calculateVolumeVelocity(signal),
            crossValidation: await this.crossValidateSignal(signal),
            historicalAccuracy: await this.checkHistoricalAccuracy(signal),
            expertValidation: await this.getExpertValidation(signal)
        };
        const weights = {
            sourceCredibility: 0.25,
            volumeVelocity: 0.20,
            crossValidation: 0.25,
            historicalAccuracy: 0.20,
            expertValidation: 0.10
        };
        return Object.entries(factors).reduce((strength, [factor, value]) => strength + (value * weights[factor]), 0);
    }
    calculateSourceCredibility(signal) {
        const credibilityScores = signal.sources.map(source => source.credibility);
        return (0, simple_statistics_1.mean)(credibilityScores);
    }
    calculateVolumeVelocity(signal) {
        const { volume, velocity } = signal.metadata;
        const normalizedVolume = Math.min(volume / 1000, 1);
        const normalizedVelocity = Math.min(velocity / 100, 1);
        return (normalizedVolume + normalizedVelocity) / 2;
    }
    async crossValidateSignal(signal) {
        const sourceTypes = new Set(signal.sources.map(s => s.type));
        const confirmationScore = sourceTypes.size / 5;
        return Math.min(confirmationScore, 1);
    }
    async checkHistoricalAccuracy(signal) {
        const similarPatterns = signal.context.historicalPatterns;
        if (similarPatterns.length === 0)
            return 0.5;
        const accuratePatterns = similarPatterns.filter(p => p.historicalOutcome === 'accurate');
        return accuratePatterns.length / similarPatterns.length;
    }
    async getExpertValidation(signal) {
        return 0.7;
    }
}
exports.SignalDetectionEngine = SignalDetectionEngine;
class StatisticalAnomalyDetector {
    zScoreThreshold = 3;
    minDataPoints = 100;
    async detect(dataStream) {
        if (dataStream.length < this.minDataPoints)
            return [];
        const signals = [];
        const metrics = this.extractMetrics(dataStream);
        for (const [metric, values] of Object.entries(metrics)) {
            const anomalies = this.detectAnomalies(values);
            if (anomalies.length > 0) {
                signals.push(this.createSignalFromAnomaly(metric, anomalies, dataStream));
            }
        }
        return signals;
    }
    extractMetrics(dataStream) {
        const metrics = {
            volume: [],
            sentiment: [],
            velocity: [],
            diversity: []
        };
        dataStream.forEach(point => {
            metrics.volume.push(point.volume || 0);
            metrics.sentiment.push(point.sentiment || 0);
            metrics.velocity.push(point.velocity || 0);
            metrics.diversity.push(point.sources?.length || 0);
        });
        return metrics;
    }
    detectAnomalies(values) {
        const meanValue = (0, simple_statistics_1.mean)(values);
        const stdValue = (0, simple_statistics_1.standardDeviation)(values);
        const anomalyIndices = [];
        values.forEach((value, index) => {
            const zScore = Math.abs((value - meanValue) / stdValue);
            if (zScore > this.zScoreThreshold) {
                anomalyIndices.push(index);
            }
        });
        return anomalyIndices;
    }
    createSignalFromAnomaly(metric, anomalies, dataStream) {
        const firstAnomaly = anomalies[0];
        const dataPoint = dataStream[firstAnomaly];
        return {
            id: `anomaly-${metric}-${Date.now()}`,
            type: this.inferSignalType(metric, dataPoint),
            strength: this.calculateAnomalyStrength(anomalies, dataStream.length),
            confidence: 0.7,
            sources: [{
                    id: 'statistical-detector',
                    type: 'anomaly-detection',
                    credibility: 0.8,
                    timestamp: new Date(),
                    rawData: { metric, anomalies }
                }],
            firstDetected: new Date(dataPoint.timestamp),
            lastUpdated: new Date(),
            metadata: {
                keywords: this.extractKeywords(dataPoint),
                entities: [],
                sentiment: dataPoint.sentiment || 0,
                volume: dataPoint.volume || 0,
                velocity: dataPoint.velocity || 0,
                geography: dataPoint.geography || [],
                industries: dataPoint.industries || []
            },
            trajectory: this.inferTrajectory(anomalies, dataStream),
            context: {
                relatedSignals: [],
                historicalPatterns: [],
                industryRelevance: new Map(),
                potentialImpact: {
                    scope: 'industry',
                    magnitude: 'moderate',
                    timeframe: 'short-term',
                    probability: 0.6
                }
            }
        };
    }
    inferSignalType(metric, dataPoint) {
        const typeMap = {
            volume: SignalType.MARKET_SHIFT,
            sentiment: SignalType.CONSUMER_BEHAVIOR,
            velocity: SignalType.EMERGING_TECHNOLOGY,
            diversity: SignalType.COMPETITIVE_MOVE
        };
        return typeMap[metric] || SignalType.MARKET_SHIFT;
    }
    calculateAnomalyStrength(anomalies, totalPoints) {
        const frequency = anomalies.length / totalPoints;
        const clustering = this.calculateClustering(anomalies);
        return Math.min((frequency * 2) + (clustering * 0.5), 1);
    }
    calculateClustering(indices) {
        if (indices.length < 2)
            return 0;
        const distances = [];
        for (let i = 1; i < indices.length; i++) {
            distances.push(indices[i] - indices[i - 1]);
        }
        const avgDistance = (0, simple_statistics_1.mean)(distances);
        const maxDistance = Math.max(...distances);
        return 1 - (avgDistance / maxDistance);
    }
    extractKeywords(dataPoint) {
        return dataPoint.keywords || [];
    }
    inferTrajectory(anomalies, dataStream) {
        if (anomalies.length < 3)
            return SignalTrajectory.EMERGING;
        const recentAnomalies = anomalies.slice(-5);
        const olderAnomalies = anomalies.slice(0, -5);
        const recentDensity = recentAnomalies.length / 5;
        const olderDensity = olderAnomalies.length / Math.max(olderAnomalies.length, 5);
        if (recentDensity > olderDensity * 1.5)
            return SignalTrajectory.ACCELERATING;
        if (recentDensity < olderDensity * 0.5)
            return SignalTrajectory.DECLINING;
        if (Math.abs(recentDensity - olderDensity) < 0.1)
            return SignalTrajectory.PLATEAUING;
        return SignalTrajectory.EMERGING;
    }
}
class PatternRecognitionDetector {
    patterns = new Map();
    constructor() {
        this.initializePatterns();
    }
    initializePatterns() {
        this.patterns.set('s-curve', {
            name: 'Technology Adoption S-Curve',
            phases: ['innovation', 'early-adoption', 'growth', 'maturity'],
            indicators: {
                innovation: { volumeGrowth: 0.1, sentimentRange: [0.3, 0.6] },
                'early-adoption': { volumeGrowth: 0.3, sentimentRange: [0.5, 0.7] },
                growth: { volumeGrowth: 0.8, sentimentRange: [0.6, 0.8] },
                maturity: { volumeGrowth: 0.1, sentimentRange: [0.4, 0.6] }
            }
        });
        this.patterns.set('disruption', {
            name: 'Market Disruption',
            phases: ['incumbent-dominance', 'challenger-emergence', 'market-shift', 'new-equilibrium'],
            indicators: {
                'incumbent-dominance': { marketShare: 0.7, innovationRate: 0.2 },
                'challenger-emergence': { marketShare: 0.1, innovationRate: 0.8 },
                'market-shift': { marketShare: 0.3, innovationRate: 0.6 },
                'new-equilibrium': { marketShare: 0.5, innovationRate: 0.4 }
            }
        });
        this.patterns.set('regulatory-cascade', {
            name: 'Regulatory Cascade',
            phases: ['initial-regulation', 'industry-response', 'follow-on-regulation', 'market-adaptation'],
            indicators: {
                'initial-regulation': { regulatoryActivity: 0.8, marketVolatility: 0.3 },
                'industry-response': { regulatoryActivity: 0.4, marketVolatility: 0.6 },
                'follow-on-regulation': { regulatoryActivity: 0.7, marketVolatility: 0.5 },
                'market-adaptation': { regulatoryActivity: 0.2, marketVolatility: 0.2 }
            }
        });
    }
    async detect(dataStream) {
        const signals = [];
        for (const [patternId, template] of this.patterns.entries()) {
            const matches = this.matchPattern(dataStream, template);
            if (matches.length > 0) {
                signals.push(...matches.map(match => this.createSignalFromPattern(match, template, dataStream)));
            }
        }
        return signals;
    }
    matchPattern(dataStream, template) {
        const matches = [];
        const windowSize = this.calculateWindowSize(template);
        for (let i = 0; i <= dataStream.length - windowSize; i++) {
            const window = dataStream.slice(i, i + windowSize);
            const similarity = this.calculatePatternSimilarity(window, template);
            if (similarity > 0.7) {
                matches.push({
                    startIndex: i,
                    endIndex: i + windowSize,
                    similarity,
                    phase: this.identifyPhase(window, template)
                });
            }
        }
        return matches;
    }
    calculateWindowSize(template) {
        return template.phases.length * 30;
    }
    calculatePatternSimilarity(window, template) {
        const metrics = this.extractWindowMetrics(window);
        const expectedMetrics = this.getExpectedMetrics(template);
        return this.compareMetrics(metrics, expectedMetrics);
    }
    extractWindowMetrics(window) {
        return {
            volumeGrowth: this.calculateGrowthRate(window.map(d => d.volume || 0)),
            avgSentiment: (0, simple_statistics_1.mean)(window.map(d => d.sentiment || 0)),
            volatility: (0, simple_statistics_1.standardDeviation)(window.map(d => d.value || 0))
        };
    }
    calculateGrowthRate(values) {
        if (values.length < 2)
            return 0;
        const firstQuarter = values.slice(0, Math.floor(values.length / 4));
        const lastQuarter = values.slice(-Math.floor(values.length / 4));
        const firstAvg = (0, simple_statistics_1.mean)(firstQuarter);
        const lastAvg = (0, simple_statistics_1.mean)(lastQuarter);
        return (lastAvg - firstAvg) / firstAvg;
    }
    getExpectedMetrics(template) {
        const allIndicators = Object.values(template.indicators);
        return {
            volumeGrowth: (0, simple_statistics_1.mean)(allIndicators.map(i => i.volumeGrowth || 0)),
            avgSentiment: (0, simple_statistics_1.mean)(allIndicators.flatMap(i => i.sentimentRange || [0.5])),
            volatility: 0.3
        };
    }
    compareMetrics(actual, expected) {
        const differences = Object.keys(expected).map(key => {
            const diff = Math.abs(actual[key] - expected[key]);
            return 1 - Math.min(diff / expected[key], 1);
        });
        return (0, simple_statistics_1.mean)(differences);
    }
    identifyPhase(window, template) {
        const phaseSize = Math.floor(window.length / template.phases.length);
        const currentMetrics = this.extractWindowMetrics(window.slice(-phaseSize));
        let bestMatch = { phase: template.phases[0], similarity: 0 };
        for (const phase of template.phases) {
            const phaseIndicators = template.indicators[phase];
            const similarity = this.compareMetrics(currentMetrics, phaseIndicators);
            if (similarity > bestMatch.similarity) {
                bestMatch = { phase, similarity };
            }
        }
        return bestMatch.phase;
    }
    createSignalFromPattern(match, template, dataStream) {
        const relevantData = dataStream.slice(match.startIndex, match.endIndex);
        return {
            id: `pattern-${template.name}-${Date.now()}`,
            type: this.inferSignalTypeFromPattern(template),
            strength: match.similarity,
            confidence: match.similarity * 0.9,
            sources: [{
                    id: 'pattern-detector',
                    type: 'pattern-recognition',
                    credibility: 0.85,
                    timestamp: new Date(),
                    rawData: { pattern: template.name, match }
                }],
            firstDetected: new Date(relevantData[0].timestamp),
            lastUpdated: new Date(),
            metadata: {
                keywords: this.extractPatternKeywords(template, relevantData),
                entities: this.extractEntities(relevantData),
                sentiment: (0, simple_statistics_1.mean)(relevantData.map(d => d.sentiment || 0)),
                volume: (0, simple_statistics_1.mean)(relevantData.map(d => d.volume || 0)),
                velocity: this.calculateVelocity(relevantData),
                geography: this.aggregateGeography(relevantData),
                industries: this.aggregateIndustries(relevantData)
            },
            trajectory: this.inferTrajectoryFromPhase(match.phase, template),
            context: {
                relatedSignals: [],
                historicalPatterns: [{
                        type: template.name,
                        similarity: match.similarity,
                        historicalOutcome: this.getHistoricalOutcome(template.name)
                    }],
                industryRelevance: this.calculateIndustryRelevance(relevantData),
                potentialImpact: this.assessPatternImpact(template, match)
            }
        };
    }
    inferSignalTypeFromPattern(template) {
        const typeMap = {
            'Technology Adoption S-Curve': SignalType.EMERGING_TECHNOLOGY,
            'Market Disruption': SignalType.MARKET_SHIFT,
            'Regulatory Cascade': SignalType.REGULATORY_CHANGE
        };
        return typeMap[template.name] || SignalType.MARKET_SHIFT;
    }
    extractPatternKeywords(template, data) {
        const keywords = new Set();
        keywords.add(template.name.toLowerCase().replace(/\s+/g, '-'));
        data.forEach(point => {
            (point.keywords || []).forEach(kw => keywords.add(kw));
        });
        return Array.from(keywords);
    }
    extractEntities(data) {
        const entityMap = new Map();
        data.forEach(point => {
            (point.entities || []).forEach(entity => {
                const key = `${entity.type}-${entity.name}`;
                if (!entityMap.has(key)) {
                    entityMap.set(key, entity);
                }
            });
        });
        return Array.from(entityMap.values());
    }
    calculateVelocity(data) {
        if (data.length < 2)
            return 0;
        const timeSpan = new Date(data[data.length - 1].timestamp).getTime() -
            new Date(data[0].timestamp).getTime();
        const changeRate = this.calculateGrowthRate(data.map(d => d.volume || 0));
        return changeRate / (timeSpan / (1000 * 60 * 60 * 24));
    }
    aggregateGeography(data) {
        const geoSet = new Set();
        data.forEach(point => {
            (point.geography || []).forEach(geo => geoSet.add(geo));
        });
        return Array.from(geoSet);
    }
    aggregateIndustries(data) {
        const industrySet = new Set();
        data.forEach(point => {
            (point.industries || []).forEach(ind => industrySet.add(ind));
        });
        return Array.from(industrySet);
    }
    inferTrajectoryFromPhase(phase, template) {
        const phaseIndex = template.phases.indexOf(phase);
        const totalPhases = template.phases.length;
        if (phaseIndex < totalPhases * 0.3)
            return SignalTrajectory.EMERGING;
        if (phaseIndex < totalPhases * 0.6)
            return SignalTrajectory.ACCELERATING;
        if (phaseIndex < totalPhases * 0.8)
            return SignalTrajectory.PLATEAUING;
        return SignalTrajectory.DECLINING;
    }
    getHistoricalOutcome(patternName) {
        const outcomes = {
            'Technology Adoption S-Curve': 'accurate',
            'Market Disruption': 'accurate',
            'Regulatory Cascade': 'moderate'
        };
        return outcomes[patternName] || 'unknown';
    }
    calculateIndustryRelevance(data) {
        const relevanceMap = new Map();
        const industryCounts = new Map();
        data.forEach(point => {
            (point.industries || []).forEach(industry => {
                industryCounts.set(industry, (industryCounts.get(industry) || 0) + 1);
            });
        });
        const totalMentions = Array.from(industryCounts.values()).reduce((a, b) => a + b, 0);
        industryCounts.forEach((count, industry) => {
            relevanceMap.set(industry, count / totalMentions);
        });
        return relevanceMap;
    }
    assessPatternImpact(template, match) {
        const impactMap = {
            'Technology Adoption S-Curve': {
                scope: 'industry',
                magnitude: 'transformative',
                timeframe: 'medium-term',
                probability: match.similarity
            },
            'Market Disruption': {
                scope: 'industry',
                magnitude: 'significant',
                timeframe: 'short-term',
                probability: match.similarity * 0.8
            },
            'Regulatory Cascade': {
                scope: 'regional',
                magnitude: 'moderate',
                timeframe: 'medium-term',
                probability: match.similarity * 0.9
            }
        };
        return impactMap[template.name] || {
            scope: 'industry',
            magnitude: 'moderate',
            timeframe: 'medium-term',
            probability: 0.5
        };
    }
}
class NLPSignalExtractor {
    async detect(dataStream) {
        return this.extract(dataStream);
    }
    async extract(data) {
        return data.map((item, index) => ({
            id: `nlp-${Date.now()}-${index}`,
            type: SignalType.EMERGING_TECHNOLOGY,
            strength: 0.5,
            confidence: 0.7,
            sources: [],
            firstDetected: new Date(),
            lastUpdated: new Date(),
            metadata: {
                keywords: [],
                category: 'nlp',
                region: null,
                relevance: 0.5,
                tags: []
            },
            trajectory: SignalTrajectory.EMERGING,
            context: {
                marketImplications: [],
                riskFactors: [],
                opportunities: [],
                relatedSignals: [],
                historicalAnalogs: []
            }
        }));
    }
}
class NetworkEffectAnalyzer {
    async detect(dataStream) {
        return this.extract(dataStream);
    }
    async extract(data) {
        return data.map((item, index) => ({
            id: `network-${Date.now()}-${index}`,
            type: SignalType.MARKET_SHIFT,
            strength: 0.6,
            confidence: 0.8,
            sources: [],
            firstDetected: new Date(),
            lastUpdated: new Date(),
            metadata: {
                keywords: [],
                category: 'network',
                region: null,
                relevance: 0.6,
                tags: []
            },
            trajectory: SignalTrajectory.ACCELERATING,
            context: {
                marketImplications: [],
                riskFactors: [],
                opportunities: [],
                relatedSignals: [],
                historicalAnalogs: []
            }
        }));
    }
}
class TimeSeriesAnalyzer {
    async detect(dataStream) {
        return this.extract(dataStream);
    }
    async extract(data) {
        return data.map((item, index) => ({
            id: `timeseries-${Date.now()}-${index}`,
            type: SignalType.ECONOMIC_INDICATOR,
            strength: 0.4,
            confidence: 0.6,
            sources: [],
            firstDetected: new Date(),
            lastUpdated: new Date(),
            metadata: {
                keywords: [],
                category: 'timeseries',
                region: null,
                relevance: 0.4,
                tags: []
            },
            trajectory: SignalTrajectory.CYCLICAL,
            context: {
                marketImplications: [],
                riskFactors: [],
                opportunities: [],
                relatedSignals: [],
                historicalAnalogs: []
            }
        }));
    }
}
class SentimentShiftDetector {
    async detect(dataStream) {
        return this.extract(dataStream);
    }
    async extract(data) {
        return data.map((item, index) => ({
            id: `sentiment-${Date.now()}-${index}`,
            type: SignalType.CONSUMER_BEHAVIOR,
            strength: 0.7,
            confidence: 0.75,
            sources: [],
            firstDetected: new Date(),
            lastUpdated: new Date(),
            metadata: {
                keywords: [],
                category: 'sentiment',
                region: null,
                relevance: 0.7,
                tags: []
            },
            trajectory: SignalTrajectory.EMERGING,
            context: {
                marketImplications: [],
                riskFactors: [],
                opportunities: [],
                relatedSignals: [],
                historicalAnalogs: []
            }
        }));
    }
}
class CorrelationEngine {
    async correlate(signals) {
        const grouped = this.groupSignals(signals);
        const correlated = await Promise.all(Array.from(grouped.values()).map(group => this.correlateGroup(group)));
        return correlated.flat();
    }
    groupSignals(signals) {
        const groups = new Map();
        signals.forEach(signal => {
            const timeWindow = Math.floor(signal.firstDetected.getTime() / (1000 * 60 * 60 * 24));
            const key = `${signal.type}-${timeWindow}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(signal);
        });
        return groups;
    }
    async correlateGroup(signals) {
        if (signals.length < 2)
            return signals;
        const similarityMatrix = this.calculateSimilarityMatrix(signals);
        const merged = this.mergeCorrelatedSignals(signals, similarityMatrix);
        merged.forEach(signal => {
            signal.context.relatedSignals = this.findRelatedSignals(signal, merged);
        });
        return merged;
    }
    calculateSimilarityMatrix(signals) {
        const matrix = [];
        for (let i = 0; i < signals.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < signals.length; j++) {
                matrix[i][j] = this.calculateSignalSimilarity(signals[i], signals[j]);
            }
        }
        return matrix;
    }
    calculateSignalSimilarity(signal1, signal2) {
        if (signal1.id === signal2.id)
            return 1;
        const keywordSimilarity = this.calculateSetSimilarity(new Set(signal1.metadata.keywords), new Set(signal2.metadata.keywords));
        const entitySimilarity = this.calculateEntitySimilarity(signal1.metadata.entities, signal2.metadata.entities);
        const timeSimilarity = this.calculateTimeSimilarity(signal1.firstDetected, signal2.firstDetected);
        const geographySimilarity = this.calculateSetSimilarity(new Set(signal1.metadata.geography), new Set(signal2.metadata.geography));
        return (keywordSimilarity * 0.3 +
            entitySimilarity * 0.3 +
            timeSimilarity * 0.2 +
            geographySimilarity * 0.2);
    }
    calculateSetSimilarity(set1, set2) {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    calculateEntitySimilarity(entities1, entities2) {
        const set1 = new Set(entities1.map(e => `${e.type}-${e.name}`));
        const set2 = new Set(entities2.map(e => `${e.type}-${e.name}`));
        return this.calculateSetSimilarity(set1, set2);
    }
    calculateTimeSimilarity(time1, time2) {
        const diff = Math.abs(time1.getTime() - time2.getTime());
        const maxDiff = 1000 * 60 * 60 * 24 * 7;
        return Math.max(0, 1 - (diff / maxDiff));
    }
    mergeCorrelatedSignals(signals, similarityMatrix) {
        const merged = [];
        const processed = new Set();
        for (let i = 0; i < signals.length; i++) {
            if (processed.has(i))
                continue;
            const correlatedIndices = [i];
            for (let j = i + 1; j < signals.length; j++) {
                if (similarityMatrix[i][j] > 0.8) {
                    correlatedIndices.push(j);
                    processed.add(j);
                }
            }
            if (correlatedIndices.length > 1) {
                merged.push(this.mergeSignals(correlatedIndices.map(idx => signals[idx])));
            }
            else {
                merged.push(signals[i]);
            }
            processed.add(i);
        }
        return merged;
    }
    mergeSignals(signals) {
        const baseSignal = signals.reduce((prev, curr) => curr.confidence > prev.confidence ? curr : prev);
        const allSources = signals.flatMap(s => s.sources);
        const allKeywords = new Set(signals.flatMap(s => s.metadata.keywords));
        const allEntities = this.mergeEntities(signals.flatMap(s => s.metadata.entities));
        const allGeography = new Set(signals.flatMap(s => s.metadata.geography));
        const allIndustries = new Set(signals.flatMap(s => s.metadata.industries));
        return {
            ...baseSignal,
            sources: allSources,
            confidence: Math.min(baseSignal.confidence * 1.2, 1),
            strength: (0, simple_statistics_1.mean)(signals.map(s => s.strength)),
            metadata: {
                keywords: Array.from(allKeywords),
                entities: allEntities,
                sentiment: (0, simple_statistics_1.mean)(signals.map(s => s.metadata.sentiment)),
                volume: signals.reduce((sum, s) => sum + s.metadata.volume, 0),
                velocity: Math.max(...signals.map(s => s.metadata.velocity)),
                geography: Array.from(allGeography),
                industries: Array.from(allIndustries)
            }
        };
    }
    mergeEntities(entities) {
        const entityMap = new Map();
        entities.forEach(entity => {
            const key = `${entity.type}-${entity.name}`;
            const existing = entityMap.get(key);
            if (!existing || entity.relevance > existing.relevance) {
                entityMap.set(key, entity);
            }
        });
        return Array.from(entityMap.values());
    }
    findRelatedSignals(signal, allSignals) {
        return allSignals
            .filter(s => s.id !== signal.id)
            .filter(s => this.calculateSignalSimilarity(signal, s) > 0.5)
            .map(s => s.id);
    }
}
class MLModelManager {
    models = new Map();
    async validateSignals(signals) {
        const validated = await Promise.all(signals.map(signal => this.validateSignal(signal)));
        return validated.filter(result => result.isValid).map(result => result.signal);
    }
    async validateSignal(signal) {
        const features = this.extractFeatures(signal);
        const model = await this.getModel(signal.type);
        if (!model) {
            return { signal, isValid: true };
        }
        const prediction = model.predict(tf.tensor2d([features]));
        const validity = (await prediction.data())[0];
        signal.confidence *= validity;
        return {
            signal,
            isValid: validity > 0.5
        };
    }
    extractFeatures(signal) {
        return [
            signal.strength,
            signal.confidence,
            signal.sources.length,
            signal.metadata.sentiment,
            Math.log(signal.metadata.volume + 1),
            signal.metadata.velocity,
            signal.metadata.keywords.length,
            signal.metadata.entities.length,
            signal.metadata.geography.length,
            signal.metadata.industries.length,
        ];
    }
    async getModel(signalType) {
        return null;
    }
}
exports.default = SignalDetectionEngine;
//# sourceMappingURL=signal-detection.js.map
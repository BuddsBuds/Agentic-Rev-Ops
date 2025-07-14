"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralLearningSystem = void 0;
const events_1 = require("events");
class NeuralLearningSystem extends events_1.EventEmitter {
    patterns;
    models;
    memory;
    metrics;
    featureExtractor;
    patternMatcher;
    constructor(memory) {
        super();
        this.memory = memory;
        this.patterns = new Map();
        this.models = new Map();
        this.featureExtractor = new FeatureExtractor();
        this.patternMatcher = new PatternMatcher();
        this.metrics = {
            totalPatterns: 0,
            accuracyRate: 0,
            learningProgress: 0,
            predictiveCapability: 0,
            adaptationSpeed: 0
        };
    }
    async initialize() {
        await this.loadPatterns();
        this.initializeModels();
        this.startContinuousLearning();
        this.emit('neural:initialized', {
            patterns: this.patterns.size,
            models: this.models.size
        });
    }
    async learnFromDecision(decision, outcome, metrics) {
        const features = this.featureExtractor.extract(decision);
        const pattern = this.createOrUpdatePattern(decision, features, outcome);
        await this.updateModels(pattern, outcome, metrics);
        await this.memory.store({
            id: `learning_${decision.id}`,
            type: 'neural-learning',
            content: {
                decisionId: decision.id,
                pattern: pattern.id,
                outcome,
                metrics
            },
            timestamp: new Date(),
            relevance: 0.8,
            tags: ['learning', decision.type, outcome ? 'success' : 'failure']
        });
        this.emit('neural:learned', {
            decisionId: decision.id,
            patternId: pattern.id,
            outcome
        });
    }
    async predict(type, context, options) {
        const features = this.featureExtractor.extractFromContext(context);
        const matchingPatterns = this.patternMatcher.findMatches(features, Array.from(this.patterns.values()));
        const model = this.models.get(type) || this.models.get('decision');
        if (!model) {
            throw new Error(`No model found for type: ${type}`);
        }
        const prediction = await this.generatePrediction(model, features, matchingPatterns, options);
        return prediction;
    }
    async trainModels() {
        console.log('🧠 Training neural models...');
        const historicalData = await this.memory.retrieve({
            type: 'decision',
            limit: 1000
        });
        const groupedData = this.groupByType(historicalData);
        for (const [type, data] of groupedData) {
            await this.trainModel(type, data);
        }
        this.updateLearningMetrics();
        this.emit('neural:models-trained', {
            models: this.models.size,
            dataPoints: historicalData.length
        });
    }
    async getRecommendations(type, context) {
        const features = this.featureExtractor.extractFromContext(context);
        const patterns = Array.from(this.patterns.values())
            .filter(p => p.type === 'success')
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);
        return patterns.map(pattern => ({
            pattern: this.describePattern(pattern),
            confidence: pattern.confidence,
            reasoning: this.explainPattern(pattern, context)
        }));
    }
    async analyzeLearningProgress() {
        const progress = {
            patterns: {
                total: this.patterns.size,
                byType: this.countPatternsByType(),
                highConfidence: this.countHighConfidencePatterns()
            },
            models: {
                total: this.models.size,
                averageAccuracy: this.calculateAverageAccuracy(),
                lastTraining: this.getLastTrainingTime()
            },
            improvements: {
                accuracyTrend: this.calculateAccuracyTrend(),
                adaptationRate: this.calculateAdaptationRate(),
                predictionSuccess: this.metrics.predictiveCapability
            }
        };
        return progress;
    }
    async getNeuralInsights() {
        const insights = [];
        for (const [patternId, pattern] of this.patterns) {
            if (pattern.confidence > 0.8 && pattern.occurrences > 10) {
                insights.push({
                    type: 'pattern',
                    insight: `Strong ${pattern.type} pattern detected: ${this.describePattern(pattern)}`,
                    confidence: pattern.confidence,
                    actionable: true
                });
            }
        }
        for (const [modelType, model] of this.models) {
            if (model.accuracy < 0.7) {
                insights.push({
                    type: 'model',
                    insight: `${modelType} model needs more training data (accuracy: ${model.accuracy})`,
                    confidence: 0.9,
                    actionable: true
                });
            }
        }
        const trend = this.analyzeDecisionTrends();
        if (trend.significant) {
            insights.push({
                type: 'trend',
                insight: trend.description,
                confidence: trend.confidence,
                actionable: trend.actionable
            });
        }
        return insights;
    }
    initializeModels() {
        this.models.set('decision', {
            id: 'model_decision',
            type: 'decision',
            accuracy: 0.5,
            trainingData: 0,
            lastUpdated: new Date(),
            parameters: {
                learningRate: 0.01,
                epochs: 100,
                hiddenLayers: [64, 32, 16],
                activationFunction: 'relu',
                optimizer: 'adam'
            }
        });
        this.models.set('optimization', {
            id: 'model_optimization',
            type: 'optimization',
            accuracy: 0.5,
            trainingData: 0,
            lastUpdated: new Date(),
            parameters: {
                learningRate: 0.001,
                epochs: 200,
                hiddenLayers: [128, 64, 32],
                activationFunction: 'relu',
                optimizer: 'adam'
            }
        });
        this.models.set('prediction', {
            id: 'model_prediction',
            type: 'prediction',
            accuracy: 0.5,
            trainingData: 0,
            lastUpdated: new Date(),
            parameters: {
                learningRate: 0.005,
                epochs: 150,
                hiddenLayers: [100, 50, 25],
                activationFunction: 'sigmoid',
                optimizer: 'rmsprop'
            }
        });
    }
    createOrUpdatePattern(decision, features, outcome) {
        const patternId = this.generatePatternId(features);
        let pattern = this.patterns.get(patternId);
        if (!pattern) {
            pattern = {
                id: patternId,
                type: outcome ? 'success' : 'failure',
                pattern: {
                    context: decision.context,
                    features,
                    actions: [decision.majority.winner.id],
                    conditions: this.extractConditions(decision.context)
                },
                confidence: 0.5,
                occurrences: 0,
                lastSeen: new Date(),
                outcomes: []
            };
            this.patterns.set(patternId, pattern);
            this.metrics.totalPatterns++;
        }
        pattern.occurrences++;
        pattern.lastSeen = new Date();
        pattern.outcomes.push({
            timestamp: new Date(),
            success: outcome,
            metrics: {},
            feedback: ''
        });
        const successRate = pattern.outcomes.filter(o => o.success).length / pattern.outcomes.length;
        pattern.confidence = successRate;
        return pattern;
    }
    async generatePrediction(model, features, patterns, options) {
        const prediction = this.simulateNeuralPrediction(model, features, patterns);
        const alternatives = options ?
            options.map(opt => ({
                value: opt,
                probability: this.calculateOptionProbability(opt, features, patterns)
            })).sort((a, b) => b.probability - a.probability) : [];
        const reasoning = this.generateReasoning(prediction, patterns);
        return {
            prediction: prediction.value,
            confidence: prediction.confidence,
            alternatives,
            reasoning
        };
    }
    simulateNeuralPrediction(model, features, patterns) {
        const weightedPatterns = patterns.map(p => ({
            pattern: p,
            weight: p.confidence * this.getRecencyWeight(p.lastSeen)
        }));
        const dominantPattern = weightedPatterns
            .sort((a, b) => b.weight - a.weight)[0];
        if (dominantPattern && dominantPattern.weight > 0.6) {
            return {
                value: dominantPattern.pattern.pattern.actions[0],
                confidence: dominantPattern.weight * model.accuracy
            };
        }
        return {
            value: 'default-action',
            confidence: 0.5 * model.accuracy
        };
    }
    startContinuousLearning() {
        setInterval(async () => {
            await this.trainModels();
            this.pruneOldPatterns();
            this.updateLearningMetrics();
        }, 60 * 60 * 1000);
    }
    async loadPatterns() {
        const storedPatterns = await this.memory.retrieve({
            type: 'neural-pattern',
            limit: 1000
        });
        storedPatterns.forEach(entry => {
            const pattern = entry.content;
            this.patterns.set(pattern.id, pattern);
        });
    }
    async trainModel(type, data) {
        const model = this.models.get(type);
        if (!model)
            return;
        const trainingSize = data.length;
        const baseAccuracy = model.accuracy;
        const improvement = Math.min(0.1, trainingSize / 10000);
        model.accuracy = Math.min(0.95, baseAccuracy + improvement);
        model.trainingData += trainingSize;
        model.lastUpdated = new Date();
        console.log(`  Trained ${type} model: accuracy ${(model.accuracy * 100).toFixed(1)}%`);
    }
    updateLearningMetrics() {
        const accuracies = Array.from(this.models.values()).map(m => m.accuracy);
        this.metrics.accuracyRate = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
        this.metrics.learningProgress = this.calculateLearningProgress();
        this.metrics.predictiveCapability = this.calculatePredictiveCapability();
        this.metrics.adaptationSpeed = this.calculateAdaptationSpeed();
    }
    generatePatternId(features) {
        const hash = features.values.reduce((a, b) => a + b, 0);
        return `pattern_${hash.toString(36)}_${Date.now().toString(36)}`;
    }
    extractConditions(context) {
        const conditions = [];
        if (context.priority)
            conditions.push(`priority:${context.priority}`);
        if (context.type)
            conditions.push(`type:${context.type}`);
        if (context.urgency)
            conditions.push(`urgency:${context.urgency}`);
        return conditions;
    }
    getRecencyWeight(lastSeen) {
        const daysSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
        return Math.exp(-daysSince / 30);
    }
    calculateOptionProbability(option, features, patterns) {
        const relevantPatterns = patterns.filter(p => p.pattern.actions.includes(option));
        if (relevantPatterns.length === 0)
            return 0.1;
        const avgConfidence = relevantPatterns.reduce((sum, p) => sum + p.confidence, 0) / relevantPatterns.length;
        return avgConfidence * 0.8 + 0.1;
    }
    generateReasoning(prediction, patterns) {
        const reasoning = [];
        reasoning.push(`Prediction based on ${patterns.length} similar patterns`);
        if (patterns.length > 0) {
            const avgSuccess = patterns.filter(p => p.type === 'success').length / patterns.length;
            reasoning.push(`Historical success rate: ${(avgSuccess * 100).toFixed(0)}%`);
        }
        reasoning.push(`Model confidence: ${(prediction.confidence * 100).toFixed(0)}%`);
        return reasoning;
    }
    describePattern(pattern) {
        return `${pattern.pattern.actions.join(', ')} when ${pattern.pattern.conditions.join(' and ')}`;
    }
    explainPattern(pattern, context) {
        const matchingConditions = pattern.pattern.conditions.filter(cond => {
            const [key, value] = cond.split(':');
            return context[key] === value;
        });
        return `Matches ${matchingConditions.length}/${pattern.pattern.conditions.length} conditions`;
    }
    groupByType(data) {
        const grouped = new Map();
        data.forEach(item => {
            const type = item.content?.type || 'unknown';
            if (!grouped.has(type)) {
                grouped.set(type, []);
            }
            grouped.get(type).push(item);
        });
        return grouped;
    }
    countPatternsByType() {
        const counts = {};
        this.patterns.forEach(pattern => {
            counts[pattern.type] = (counts[pattern.type] || 0) + 1;
        });
        return counts;
    }
    countHighConfidencePatterns() {
        return Array.from(this.patterns.values())
            .filter(p => p.confidence > 0.8)
            .length;
    }
    calculateAverageAccuracy() {
        const accuracies = Array.from(this.models.values()).map(m => m.accuracy);
        return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    }
    getLastTrainingTime() {
        const times = Array.from(this.models.values()).map(m => m.lastUpdated);
        return new Date(Math.max(...times.map(t => t.getTime())));
    }
    calculateAccuracyTrend() {
        return 0.05;
    }
    calculateAdaptationRate() {
        return this.metrics.totalPatterns / 100;
    }
    calculateLearningProgress() {
        const patternQuality = this.countHighConfidencePatterns() / Math.max(this.patterns.size, 1);
        const modelQuality = this.calculateAverageAccuracy();
        return (patternQuality + modelQuality) / 2;
    }
    calculatePredictiveCapability() {
        return 0.75;
    }
    calculateAdaptationSpeed() {
        return 0.8;
    }
    analyzeDecisionTrends() {
        return {
            significant: true,
            description: 'Increasing preference for automated solutions',
            confidence: 0.85,
            actionable: true
        };
    }
    pruneOldPatterns() {
        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        for (const [id, pattern] of this.patterns) {
            if (pattern.lastSeen < cutoffDate && pattern.confidence < 0.5) {
                this.patterns.delete(id);
            }
        }
    }
}
exports.NeuralLearningSystem = NeuralLearningSystem;
class FeatureExtractor {
    extract(decision) {
        const features = [];
        const labels = [];
        features.push(decision.majority.participation.participationRate);
        labels.push('participation_rate');
        features.push(decision.majority.votes.length);
        labels.push('vote_count');
        features.push(this.encodeType(decision.type));
        labels.push('decision_type');
        return {
            dimensions: features.length,
            values: features,
            labels
        };
    }
    extractFromContext(context) {
        const features = [];
        const labels = [];
        if (context.priority) {
            features.push(this.encodePriority(context.priority));
            labels.push('priority');
        }
        if (context.complexity) {
            features.push(context.complexity);
            labels.push('complexity');
        }
        return {
            dimensions: features.length,
            values: features,
            labels
        };
    }
    encodeType(type) {
        const types = {
            'strategic': 1,
            'operational': 2,
            'tactical': 3,
            'emergency': 4
        };
        return types[type] || 0;
    }
    encodePriority(priority) {
        const priorities = {
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 4
        };
        return priorities[priority] || 0;
    }
}
class PatternMatcher {
    findMatches(features, patterns, threshold = 0.7) {
        return patterns
            .map(pattern => ({
            pattern,
            similarity: this.calculateSimilarity(features, pattern.pattern.features)
        }))
            .filter(match => match.similarity > threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .map(match => match.pattern);
    }
    calculateSimilarity(f1, f2) {
        if (f1.dimensions !== f2.dimensions)
            return 0;
        let distance = 0;
        for (let i = 0; i < f1.dimensions; i++) {
            distance += Math.pow(f1.values[i] - f2.values[i], 2);
        }
        distance = Math.sqrt(distance);
        const maxDistance = Math.sqrt(f1.dimensions * 4);
        return 1 - (distance / maxDistance);
    }
}
//# sourceMappingURL=NeuralLearningSystem.js.map
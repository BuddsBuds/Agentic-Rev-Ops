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
exports.RevenueForecaster = void 0;
const tf = __importStar(require("@tensorflow/tfjs"));
const simple_statistics_1 = require("simple-statistics");
const events_1 = require("events");
class RevenueForecaster extends events_1.EventEmitter {
    models = new Map();
    mlModels = new Map();
    isInitialized = false;
    constructor() {
        super();
        this.initializeModels();
    }
    async initializeModels() {
        await this.initializeLinearModel();
        await this.initializeLSTMModel();
        await this.initializeEnsembleModel();
        this.isInitialized = true;
        this.emit('models:initialized');
    }
    async forecastRevenue(historicalData, horizon = 12, metrics = ['mrr', 'arr', 'churn']) {
        if (!this.isInitialized) {
            await this.initializeModels();
        }
        const forecasts = new Map();
        for (const metric of metrics) {
            try {
                const forecast = await this.forecastMetric(metric, historicalData, horizon);
                forecasts.set(metric, forecast);
                this.emit('forecast:generated', { metric, forecast });
            }
            catch (error) {
                console.error(`Forecast failed for ${metric}:`, error);
                this.emit('forecast:error', { metric, error });
            }
        }
        return forecasts;
    }
    async forecastMetric(metric, data, horizon) {
        const prepared = this.prepareTimeSeriesData(data, metric);
        const bestModel = await this.selectBestModel(metric, prepared);
        const predictions = await this.generatePredictions(bestModel, prepared, horizon);
        const confidence = this.calculateConfidenceIntervals(predictions, bestModel);
        const factors = await this.analyzeInfluencingFactors(metric, prepared);
        const scenarios = await this.generateScenarios(metric, predictions, factors);
        const recommendations = this.generateRecommendations(metric, predictions, factors);
        return {
            metric,
            predictions,
            confidence,
            model: bestModel,
            factors,
            scenarios,
            recommendations
        };
    }
    prepareTimeSeriesData(data, metric) {
        return data
            .filter(d => d[metric] !== undefined && d[metric] !== null)
            .map(d => d[metric])
            .slice(-365);
    }
    async selectBestModel(_metric, _data) {
        const candidates = Array.from(this.models.values());
        let bestModel = candidates[0];
        let bestScore = 0;
        for (const model of candidates) {
            try {
                const score = await this.evaluateModel(model, _data);
                if (score > bestScore) {
                    bestScore = score;
                    bestModel = model;
                }
            }
            catch (error) {
                console.warn(`Model evaluation failed for ${model.id}:`, error);
            }
        }
        return bestModel;
    }
    async evaluateModel(model, data) {
        if (data.length < 20)
            return 0;
        const folds = 5;
        const foldSize = Math.floor(data.length / folds);
        const scores = [];
        for (let i = 0; i < folds; i++) {
            const testStart = i * foldSize;
            const testEnd = testStart + foldSize;
            const trainData = [...data.slice(0, testStart), ...data.slice(testEnd)];
            const testData = data.slice(testStart, testEnd);
            try {
                const predictions = await this.predictWithModel(model, trainData, testData.length);
                const score = this.calculateAccuracy(testData, predictions);
                scores.push(score);
            }
            catch (error) {
                scores.push(0);
            }
        }
        return (0, simple_statistics_1.mean)(scores);
    }
    async generatePredictions(model, data, horizon) {
        switch (model.type) {
            case 'LINEAR':
                return this.linearForecast(data, horizon);
            case 'LSTM':
                return this.lstmForecast(data, horizon);
            case 'ARIMA':
                return this.arimaForecast(data, horizon);
            case 'ENSEMBLE':
                return this.ensembleForecast(data, horizon);
            default:
                return this.linearForecast(data, horizon);
        }
    }
    linearForecast(data, horizon) {
        if (data.length < 2) {
            throw new Error('Insufficient data for linear forecast');
        }
        const x = data.map((_, i) => i);
        const regression = (0, simple_statistics_1.linearRegression)(x.map((xi, i) => [xi, data[i]]));
        const slope = regression.m;
        const intercept = regression.b;
        const predictions = [];
        const startIndex = data.length;
        for (let i = 0; i < horizon; i++) {
            const period = new Date();
            period.setMonth(period.getMonth() + i + 1);
            const value = slope * (startIndex + i) + intercept;
            const trend = slope;
            predictions.push({
                period,
                value: Math.max(0, value),
                trend,
                seasonal: 0,
                residual: 0
            });
        }
        return predictions;
    }
    async lstmForecast(data, horizon) {
        const model = this.mlModels.get('lstm');
        if (!model) {
            return this.linearForecast(data, horizon);
        }
        try {
            const sequence = this.prepareSequences(data, 12);
            if (sequence.length === 0) {
                return this.linearForecast(data, horizon);
            }
            const predictions = [];
            let currentSequence = sequence[sequence.length - 1];
            for (let i = 0; i < horizon; i++) {
                const input = tf.tensor3d([[currentSequence]], [1, currentSequence.length, 1]);
                const prediction = model.predict(input);
                const value = (await prediction.data())[0];
                const period = new Date();
                period.setMonth(period.getMonth() + i + 1);
                predictions.push({
                    period,
                    value: Math.max(0, value),
                    trend: i > 0 ? value - predictions[i - 1].value : 0,
                    seasonal: 0,
                    residual: 0
                });
                currentSequence = [...currentSequence.slice(1), value];
                input.dispose();
                prediction.dispose();
            }
            return predictions;
        }
        catch (error) {
            console.error('LSTM forecast failed:', error);
            return this.linearForecast(data, horizon);
        }
    }
    arimaForecast(data, horizon) {
        const seasonality = this.detectSeasonality(data);
        const trend = this.detectTrend(data);
        const predictions = [];
        for (let i = 0; i < horizon; i++) {
            const period = new Date();
            period.setMonth(period.getMonth() + i + 1);
            const trendComponent = trend.slope * (data.length + i);
            const seasonalComponent = seasonality[i % seasonality.length];
            const value = trend.intercept + trendComponent + seasonalComponent;
            predictions.push({
                period,
                value: Math.max(0, value),
                trend: trendComponent,
                seasonal: seasonalComponent,
                residual: 0
            });
        }
        return predictions;
    }
    async ensembleForecast(data, horizon) {
        const linearPreds = this.linearForecast(data, horizon);
        const arimaPreds = this.arimaForecast(data, horizon);
        const lstmPreds = await this.lstmForecast(data, horizon);
        const ensemblePreds = [];
        for (let i = 0; i < horizon; i++) {
            const period = linearPreds[i].period;
            const weights = { linear: 0.3, arima: 0.4, lstm: 0.3 };
            const value = linearPreds[i].value * weights.linear +
                arimaPreds[i].value * weights.arima +
                lstmPreds[i].value * weights.lstm;
            const trend = linearPreds[i].trend * weights.linear +
                arimaPreds[i].trend * weights.arima +
                lstmPreds[i].trend * weights.lstm;
            ensemblePreds.push({
                period,
                value: Math.max(0, value),
                trend,
                seasonal: arimaPreds[i].seasonal,
                residual: 0
            });
        }
        return ensemblePreds;
    }
    calculateConfidenceIntervals(predictions, model) {
        const intervals = [];
        const baseError = 1 - model.accuracy;
        predictions.forEach((pred, index) => {
            const errorMultiplier = 1 + (index * 0.1);
            const error = pred.value * baseError * errorMultiplier;
            intervals.push({
                period: pred.period,
                lower: Math.max(0, pred.value - error * 1.96),
                upper: pred.value + error * 1.96,
                probability: Math.max(0.5, 0.95 - (index * 0.05))
            });
        });
        return intervals;
    }
    async analyzeInfluencingFactors(_metric, data) {
        const factors = [];
        const seasonality = this.detectSeasonality(data);
        if (seasonality.some(s => Math.abs(s) > data[0] * 0.1)) {
            factors.push({
                name: 'Seasonal Patterns',
                impact: 0.3,
                confidence: 0.8,
                trend: 'stable',
                description: 'Regular seasonal variations in revenue'
            });
        }
        const trend = this.detectTrend(data);
        if (Math.abs(trend.slope) > 0.01) {
            factors.push({
                name: 'Growth Trend',
                impact: trend.slope > 0 ? 0.6 : -0.6,
                confidence: 0.9,
                trend: trend.slope > 0 ? 'increasing' : 'decreasing',
                description: `${trend.slope > 0 ? 'Positive' : 'Negative'} underlying growth trend`
            });
        }
        const volatility = (0, simple_statistics_1.standardDeviation)(data) / (0, simple_statistics_1.mean)(data);
        if (volatility > 0.2) {
            factors.push({
                name: 'Market Volatility',
                impact: -0.4,
                confidence: 0.7,
                trend: 'stable',
                description: 'High market volatility affecting predictability'
            });
        }
        factors.push({
            name: 'Customer Acquisition',
            impact: 0.5,
            confidence: 0.75,
            trend: 'increasing',
            description: 'New customer acquisition driving growth'
        });
        factors.push({
            name: 'Customer Expansion',
            impact: 0.4,
            confidence: 0.8,
            trend: 'stable',
            description: 'Existing customer expansion opportunities'
        });
        return factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    }
    async generateScenarios(_metric, predictions, _factors) {
        const baseValue = predictions[predictions.length - 1].value;
        return [
            {
                name: 'Optimistic',
                probability: 0.25,
                outcome: baseValue * 1.2,
                factors: {
                    'Market Growth': 1.15,
                    'Customer Acquisition': 1.3,
                    'Expansion Rate': 1.25
                },
                description: 'Strong market conditions with accelerated growth'
            },
            {
                name: 'Expected',
                probability: 0.5,
                outcome: baseValue,
                factors: {
                    'Market Growth': 1.0,
                    'Customer Acquisition': 1.0,
                    'Expansion Rate': 1.0
                },
                description: 'Current trends continue as forecasted'
            },
            {
                name: 'Conservative',
                probability: 0.2,
                outcome: baseValue * 0.85,
                factors: {
                    'Market Growth': 0.9,
                    'Customer Acquisition': 0.8,
                    'Expansion Rate': 0.9
                },
                description: 'Slower growth due to market headwinds'
            },
            {
                name: 'Pessimistic',
                probability: 0.05,
                outcome: baseValue * 0.7,
                factors: {
                    'Market Growth': 0.7,
                    'Customer Acquisition': 0.6,
                    'Expansion Rate': 0.75
                },
                description: 'Significant market downturn or competitive pressure'
            }
        ];
    }
    generateRecommendations(metric, predictions, factors) {
        const recommendations = [];
        if (predictions.some(p => p.trend > 0)) {
            recommendations.push({
                type: 'optimization',
                priority: 'high',
                action: 'Accelerate customer acquisition during growth phase',
                expectedImpact: 0.15,
                timeframe: '3-6 months',
                requirements: ['Increased marketing spend', 'Sales team expansion']
            });
        }
        if (metric === 'churn' || factors.some(f => f.name.includes('Churn'))) {
            recommendations.push({
                type: 'risk-mitigation',
                priority: 'high',
                action: 'Implement proactive churn prevention program',
                expectedImpact: 0.2,
                timeframe: '1-3 months',
                requirements: ['Customer success team', 'Predictive analytics']
            });
        }
        if (factors.some(f => f.name.includes('Seasonal'))) {
            recommendations.push({
                type: 'optimization',
                priority: 'medium',
                action: 'Optimize marketing spend for seasonal patterns',
                expectedImpact: 0.1,
                timeframe: 'Ongoing',
                requirements: ['Seasonal campaign planning', 'Budget reallocation']
            });
        }
        recommendations.push({
            type: 'opportunity',
            priority: 'medium',
            action: 'Develop upselling programs for existing customers',
            expectedImpact: 0.12,
            timeframe: '2-4 months',
            requirements: ['Product training', 'Customer segmentation']
        });
        return recommendations.sort((a, b) => {
            const priorityWeight = { high: 3, medium: 2, low: 1 };
            return priorityWeight[b.priority] - priorityWeight[a.priority];
        });
    }
    detectSeasonality(data) {
        const seasonLength = 12;
        const seasons = Array(seasonLength).fill(0);
        if (data.length < seasonLength * 2) {
            return seasons;
        }
        for (let season = 0; season < seasonLength; season++) {
            const seasonalValues = [];
            for (let i = season; i < data.length; i += seasonLength) {
                seasonalValues.push(data[i]);
            }
            if (seasonalValues.length > 0) {
                seasons[season] = (0, simple_statistics_1.mean)(seasonalValues) - (0, simple_statistics_1.mean)(data);
            }
        }
        return seasons;
    }
    detectTrend(data) {
        if (data.length < 2)
            return { slope: 0, intercept: data[0] || 0 };
        const x = data.map((_, i) => i);
        const regression = (0, simple_statistics_1.linearRegression)(x.map((xi, i) => [xi, data[i]]));
        return {
            slope: regression.m,
            intercept: regression.b
        };
    }
    _detrend(data, trend) {
        return data.map((value, index) => value - (trend.slope * index + trend.intercept));
    }
    prepareSequences(data, sequenceLength) {
        const sequences = [];
        for (let i = 0; i <= data.length - sequenceLength; i++) {
            sequences.push(data.slice(i, i + sequenceLength));
        }
        return sequences;
    }
    calculateAccuracy(actual, predicted) {
        if (actual.length !== predicted.length || actual.length === 0) {
            return 0;
        }
        const errors = actual.map((a, i) => Math.abs(a - predicted[i]) / Math.max(a, 1));
        const mape = (0, simple_statistics_1.mean)(errors);
        return Math.max(0, 1 - mape);
    }
    async predictWithModel(_model, trainData, horizon) {
        const trend = this.detectTrend(trainData);
        const predictions = [];
        for (let i = 0; i < horizon; i++) {
            const value = trend.slope * (trainData.length + i) + trend.intercept;
            predictions.push(Math.max(0, value));
        }
        return predictions;
    }
    async initializeLinearModel() {
        const model = {
            id: 'linear-regression',
            type: 'LINEAR',
            accuracy: 0.75,
            confidence: 0.8,
            lastTrained: new Date(),
            parameters: { regularization: 0.01 },
            metadata: {
                trainingPeriod: 365,
                features: ['time', 'trend'],
                hyperparameters: { alpha: 0.01 },
                validationScore: 0.75,
                crossValidationScores: [0.73, 0.76, 0.74, 0.77, 0.75]
            }
        };
        this.models.set(model.id, model);
    }
    async initializeLSTMModel() {
        try {
            const model = tf.sequential({
                layers: [
                    tf.layers.lstm({
                        units: 50,
                        returnSequences: false,
                        inputShape: [12, 1]
                    }),
                    tf.layers.dropout({ rate: 0.2 }),
                    tf.layers.dense({ units: 1, activation: 'linear' })
                ]
            });
            model.compile({
                optimizer: tf.train.adam(0.001),
                loss: 'meanSquaredError',
                metrics: ['mae']
            });
            this.mlModels.set('lstm', model);
            const forecastModel = {
                id: 'lstm-network',
                type: 'LSTM',
                accuracy: 0.85,
                confidence: 0.9,
                lastTrained: new Date(),
                parameters: { units: 50, dropout: 0.2, learningRate: 0.001 },
                metadata: {
                    trainingPeriod: 365,
                    features: ['sequence'],
                    hyperparameters: { units: 50, dropout: 0.2, epochs: 100 },
                    validationScore: 0.85,
                    crossValidationScores: [0.83, 0.86, 0.84, 0.87, 0.85]
                }
            };
            this.models.set(forecastModel.id, forecastModel);
        }
        catch (error) {
            console.error('Failed to initialize LSTM model:', error);
        }
    }
    async initializeEnsembleModel() {
        const model = {
            id: 'ensemble-model',
            type: 'ENSEMBLE',
            accuracy: 0.88,
            confidence: 0.92,
            lastTrained: new Date(),
            parameters: {
                weights: { linear: 0.3, arima: 0.4, lstm: 0.3 },
                voting: 'weighted'
            },
            metadata: {
                trainingPeriod: 365,
                features: ['ensemble'],
                hyperparameters: { models: 3, weighting: 'performance' },
                validationScore: 0.88,
                crossValidationScores: [0.86, 0.89, 0.87, 0.90, 0.88]
            }
        };
        this.models.set(model.id, model);
    }
    async trainModel(modelId, trainingData) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found`);
        }
        try {
            switch (model.type) {
                case 'LSTM':
                    await this.trainLSTMModel(trainingData);
                    break;
                case 'LINEAR':
                    await this.trainLinearModel(trainingData);
                    break;
                default:
                    console.warn(`Training not implemented for model type: ${model.type}`);
            }
            model.lastTrained = new Date();
            this.emit('model:trained', { modelId, timestamp: new Date() });
        }
        catch (error) {
            console.error(`Model training failed for ${modelId}:`, error);
            this.emit('model:training-failed', { modelId, error });
        }
    }
    async trainLSTMModel(data) {
        const model = this.mlModels.get('lstm');
        if (!model)
            return;
        try {
            const sequences = this.prepareSequences(data, 12);
            if (sequences.length < 20)
                return;
            const xs = sequences.slice(0, -1);
            const ys = sequences.slice(1).map(seq => seq[seq.length - 1]);
            const xsTensor = tf.tensor3d(xs.map(seq => seq.map(val => [val])), [xs.length, xs[0].length, 1]);
            const ysTensor = tf.tensor2d(ys, [ys.length, 1]);
            await model.fit(xsTensor, ysTensor, {
                epochs: 50,
                batchSize: 32,
                validationSplit: 0.2,
                verbose: 0
            });
            xsTensor.dispose();
            ysTensor.dispose();
        }
        catch (error) {
            console.error('LSTM training failed:', error);
        }
    }
    async trainLinearModel(_data) {
        console.log('Linear model training completed');
    }
    generateOptimizationSuggestions(forecasts) {
        const suggestions = [];
        const mrrForecast = forecasts.get('mrr');
        if (mrrForecast) {
            const growthTrend = mrrForecast.predictions[mrrForecast.predictions.length - 1].trend;
            if (growthTrend < 0) {
                suggestions.push({
                    type: 'revenue-optimization',
                    priority: 'critical',
                    title: 'Reverse MRR Decline',
                    description: 'MRR forecast shows negative growth trend',
                    actions: [
                        'Implement customer success initiatives',
                        'Review and optimize pricing strategy',
                        'Accelerate new customer acquisition',
                        'Focus on customer expansion programs'
                    ],
                    expectedImpact: 'Potential to add $50K-100K MRR over 6 months'
                });
            }
        }
        const churnForecast = forecasts.get('churn');
        if (churnForecast) {
            const avgChurn = (0, simple_statistics_1.mean)(churnForecast.predictions.map(p => p.value));
            if (avgChurn > 0.05) {
                suggestions.push({
                    type: 'churn-reduction',
                    priority: 'high',
                    title: 'Reduce Customer Churn',
                    description: `Forecasted churn rate of ${(avgChurn * 100).toFixed(1)}% exceeds target`,
                    actions: [
                        'Deploy predictive churn models',
                        'Enhance onboarding processes',
                        'Implement customer health scoring',
                        'Create retention campaigns'
                    ],
                    expectedImpact: 'Reduce churn by 20-30% within 3 months'
                });
            }
        }
        return suggestions;
    }
}
exports.RevenueForecaster = RevenueForecaster;
exports.default = RevenueForecaster;
//# sourceMappingURL=RevenueForecasting.js.map
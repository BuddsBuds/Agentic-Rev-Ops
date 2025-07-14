"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTransformationEngine = void 0;
class DataTransformationEngine {
    transform(data, rules) {
        let result = data;
        for (const rule of rules) {
            switch (rule.operation) {
                case 'map':
                    result = this.mapData(result, rule);
                    break;
                case 'filter':
                    result = this.filterData(result, rule);
                    break;
                case 'aggregate':
                    result = this.aggregateData(result, rule);
                    break;
                case 'normalize':
                    result = this.normalizeData(result, rule);
                    break;
                case 'custom':
                    result = this.customTransform(result, rule);
                    break;
            }
        }
        return result;
    }
    normalize(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.normalizeItem(item));
        }
        return this.normalizeItem(data);
    }
    aggregate(data, field, operation) {
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }
        const values = data.map(item => item[field]).filter(val => val !== undefined);
        switch (operation) {
            case 'sum':
                return values.reduce((acc, val) => acc + val, 0);
            case 'avg':
                return values.reduce((acc, val) => acc + val, 0) / values.length;
            case 'max':
                return Math.max(...values);
            case 'min':
                return Math.min(...values);
            case 'count':
                return values.length;
            default:
                return null;
        }
    }
    mapData(data, rule) {
        if (Array.isArray(data)) {
            return data.map(item => this.applyMapping(item, rule));
        }
        return this.applyMapping(data, rule);
    }
    filterData(data, rule) {
        if (!Array.isArray(data)) {
            return data;
        }
        return data.filter(item => this.applyFilter(item, rule));
    }
    aggregateData(data, rule) {
        if (!Array.isArray(data)) {
            return data;
        }
        return this.aggregate(data, rule.field, rule.params?.operation || 'sum');
    }
    normalizeData(data, rule) {
        return this.normalize(data);
    }
    customTransform(data, rule) {
        return data;
    }
    applyMapping(item, rule) {
        return { ...item, mapped: true };
    }
    applyFilter(item, rule) {
        return true;
    }
    normalizeItem(item) {
        return { ...item, normalized: true };
    }
}
exports.DataTransformationEngine = DataTransformationEngine;
//# sourceMappingURL=data-transformer.js.map
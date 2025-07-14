// Data Transformer Module
export interface TransformationRule {
  field: string;
  operation: 'map' | 'filter' | 'aggregate' | 'normalize' | 'custom';
  params?: any;
}

export interface DataTransformer {
  transform(data: any, rules: TransformationRule[]): any;
  normalize(data: any): any;
  aggregate(data: any[], field: string, operation: string): any;
}

export class DataTransformationEngine implements DataTransformer {
  transform(data: any, rules: TransformationRule[]): any {
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

  normalize(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeItem(item));
    }
    return this.normalizeItem(data);
  }

  aggregate(data: any[], field: string, operation: string): any {
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

  private mapData(data: any, rule: TransformationRule): any {
    if (Array.isArray(data)) {
      return data.map(item => this.applyMapping(item, rule));
    }
    return this.applyMapping(data, rule);
  }

  private filterData(data: any, rule: TransformationRule): any {
    if (!Array.isArray(data)) {
      return data;
    }
    return data.filter(item => this.applyFilter(item, rule));
  }

  private aggregateData(data: any, rule: TransformationRule): any {
    if (!Array.isArray(data)) {
      return data;
    }
    return this.aggregate(data, rule.field, rule.params?.operation || 'sum');
  }

  private normalizeData(data: any, rule: TransformationRule): any {
    return this.normalize(data);
  }

  private customTransform(data: any, rule: TransformationRule): any {
    // Stub for custom transformations
    return data;
  }

  private applyMapping(item: any, rule: TransformationRule): any {
    // Stub for mapping logic
    return { ...item, mapped: true };
  }

  private applyFilter(item: any, rule: TransformationRule): boolean {
    // Stub for filter logic
    return true;
  }

  private normalizeItem(item: any): any {
    // Stub for normalization logic
    return { ...item, normalized: true };
  }
}
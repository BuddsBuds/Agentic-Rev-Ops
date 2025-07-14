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
export declare class DataTransformationEngine implements DataTransformer {
    transform(data: any, rules: TransformationRule[]): any;
    normalize(data: any): any;
    aggregate(data: any[], field: string, operation: string): any;
    private mapData;
    private filterData;
    private aggregateData;
    private normalizeData;
    private customTransform;
    private applyMapping;
    private applyFilter;
    private normalizeItem;
}
//# sourceMappingURL=data-transformer.d.ts.map
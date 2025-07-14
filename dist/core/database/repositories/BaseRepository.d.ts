import { DatabaseConnectionManager, QueryOptions } from '../connection';
import { BaseEntity, BaseEntityData, FindOptions, PaginatedResult } from '../entities/base';
import { QueryResult } from 'pg';
export interface RepositoryOptions {
    tableName: string;
    schema?: string;
    entityClass: new (db: DatabaseConnectionManager, data?: any) => BaseEntity<any>;
}
export interface QueryBuilder {
    select(columns?: string[]): this;
    where(condition: string, params?: any[]): this;
    whereIn(column: string, values: any[]): this;
    whereNotNull(column: string): this;
    whereBetween(column: string, start: any, end: any): this;
    orderBy(column: string, direction?: 'ASC' | 'DESC'): this;
    groupBy(columns: string[]): this;
    having(condition: string, params?: any[]): this;
    limit(count: number): this;
    offset(count: number): this;
    join(table: string, condition: string, type?: 'INNER' | 'LEFT' | 'RIGHT'): this;
    build(): {
        query: string;
        params: any[];
    };
}
export declare class SQLQueryBuilder implements QueryBuilder {
    private tableName;
    private schema;
    private selectColumns;
    private whereConditions;
    private joins;
    private orderByClause;
    private groupByClause;
    private havingClause;
    private limitClause;
    private offsetClause;
    private params;
    private paramIndex;
    constructor(tableName: string, schema?: string);
    select(columns?: string[]): this;
    where(condition: string, params?: any[]): this;
    whereIn(column: string, values: any[]): this;
    whereNotNull(column: string): this;
    whereBetween(column: string, start: any, end: any): this;
    orderBy(column: string, direction?: 'ASC' | 'DESC'): this;
    groupBy(columns: string[]): this;
    having(condition: string, params?: any[]): this;
    limit(count: number): this;
    offset(count: number): this;
    join(table: string, condition: string, type?: 'INNER' | 'LEFT' | 'RIGHT'): this;
    build(): {
        query: string;
        params: any[];
    };
}
export declare abstract class BaseRepository<T extends BaseEntityData> {
    protected db: DatabaseConnectionManager;
    protected tableName: string;
    protected schema: string;
    protected EntityClass: new (db: DatabaseConnectionManager, data?: any) => BaseEntity<T>;
    constructor(db: DatabaseConnectionManager, options: RepositoryOptions);
    query(): SQLQueryBuilder;
    findById(id: string): Promise<BaseEntity<T> | null>;
    find(options?: FindOptions): Promise<BaseEntity<T>[]>;
    findOne(options?: FindOptions): Promise<BaseEntity<T> | null>;
    findPaginated(options?: FindOptions, pagination?: {
        page: number;
        pageSize: number;
    }): Promise<PaginatedResult<BaseEntity<T>>>;
    count(where?: Record<string, any>): Promise<number>;
    exists(where: Record<string, any>): Promise<boolean>;
    create(data: Partial<T>): Promise<BaseEntity<T>>;
    updateById(id: string, data: Partial<T>): Promise<BaseEntity<T> | null>;
    deleteById(id: string): Promise<boolean>;
    hardDeleteById(id: string): Promise<boolean>;
    bulkCreate(dataArray: Partial<T>[]): Promise<BaseEntity<T>[]>;
    bulkUpdate(where: Record<string, any>, data: Partial<T>): Promise<number>;
    bulkDelete(where: Record<string, any>): Promise<number>;
    executeQuery<R = any>(query: string, params?: any[], options?: QueryOptions): Promise<QueryResult<R>>;
    executeQueryBuilder(builder: SQLQueryBuilder): Promise<QueryResult>;
    findWithSQL(query: string, params?: any[]): Promise<BaseEntity<T>[]>;
    aggregate(options: {
        groupBy?: string[];
        select: string[];
        where?: Record<string, any>;
        having?: string;
        orderBy?: string;
    }): Promise<any[]>;
    transaction<R>(callback: (repository: this) => Promise<R>): Promise<R>;
    refreshCache(id?: string): Promise<void>;
    getTableStats(): Promise<{
        totalRows: number;
        activeRows: number;
        deletedRows: number;
        tableSize: string;
        indexSize: string;
    }>;
    optimize(): Promise<void>;
}
export default BaseRepository;
//# sourceMappingURL=BaseRepository.d.ts.map
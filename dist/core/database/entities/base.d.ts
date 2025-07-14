import { DatabaseConnectionManager, QueryOptions } from '../connection';
import { QueryResult } from 'pg';
export interface BaseEntityData {
    id?: string;
    created_at?: Date;
    updated_at?: Date;
    deleted_at?: Date;
}
export interface FindOptions {
    where?: Record<string, any>;
    orderBy?: string;
    limit?: number;
    offset?: number;
    include?: string[];
}
export interface PaginationOptions {
    page: number;
    pageSize: number;
}
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export declare abstract class BaseEntity<T extends BaseEntityData> {
    protected db: DatabaseConnectionManager;
    protected tableName: string;
    protected schema: string;
    protected data: Partial<T>;
    constructor(db: DatabaseConnectionManager, tableName: string, schema?: string, data?: Partial<T>);
    protected getFullTableName(): string;
    getData(): Partial<T>;
    setData(data: Partial<T>): void;
    get<K extends keyof T>(field: K): T[K] | undefined;
    set<K extends keyof T>(field: K, value: T[K]): void;
    isPersisted(): boolean;
    save(): Promise<void>;
    protected insert(): Promise<void>;
    protected update(): Promise<void>;
    delete(): Promise<void>;
    hardDelete(): Promise<void>;
    reload(): Promise<void>;
    findById(id: string): Promise<this | null>;
    find(options?: FindOptions): Promise<this[]>;
    findOne(options?: FindOptions): Promise<this | null>;
    findPaginated(options?: FindOptions, pagination?: PaginationOptions): Promise<PaginatedResult<this>>;
    count(where?: Record<string, any>): Promise<number>;
    exists(where: Record<string, any>): Promise<boolean>;
    protected query<R = any>(text: string, params?: any[], options?: QueryOptions): Promise<QueryResult<R>>;
    protected abstract createInstance(data: T): this;
    protected validate(): void;
    protected beforeSave(): Promise<void>;
    protected afterSave(): Promise<void>;
    protected beforeDelete(): Promise<void>;
    protected afterDelete(): Promise<void>;
    toJSON(): T;
    toObject(): T;
}
export default BaseEntity;
//# sourceMappingURL=base.d.ts.map
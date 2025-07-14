/**
 * Base Repository Pattern Implementation
 * Provides common data access methods for all entities
 */

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
  build(): { query: string; params: any[] };
}

export class SQLQueryBuilder implements QueryBuilder {
  private selectColumns: string[] = ['*'];
  private whereConditions: string[] = [];
  private joins: string[] = [];
  private orderByClause: string = '';
  private groupByClause: string = '';
  private havingClause: string = '';
  private limitClause: string = '';
  private offsetClause: string = '';
  private params: any[] = [];
  private paramIndex: number = 1;
  
  constructor(private tableName: string, private schema: string = 'core') {}

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectColumns = columns;
    }
    return this;
  }

  where(condition: string, params?: any[]): this {
    if (params) {
      // Replace placeholders with proper parameter indices
      let adjustedCondition = condition;
      for (let i = 0; i < params.length; i++) {
        adjustedCondition = adjustedCondition.replace('?', `$${this.paramIndex++}`);
        this.params.push(params[i]);
      }
      this.whereConditions.push(adjustedCondition);
    } else {
      this.whereConditions.push(condition);
    }
    return this;
  }

  whereIn(column: string, values: any[]): this {
    if (values.length === 0) return this;
    
    const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
    this.whereConditions.push(`${column} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  whereNotNull(column: string): this {
    this.whereConditions.push(`${column} IS NOT NULL`);
    return this;
  }

  whereBetween(column: string, start: any, end: any): this {
    this.whereConditions.push(`${column} BETWEEN $${this.paramIndex++} AND $${this.paramIndex++}`);
    this.params.push(start, end);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (this.orderByClause) {
      this.orderByClause += `, ${column} ${direction}`;
    } else {
      this.orderByClause = `ORDER BY ${column} ${direction}`;
    }
    return this;
  }

  groupBy(columns: string[]): this {
    this.groupByClause = `GROUP BY ${columns.join(', ')}`;
    return this;
  }

  having(condition: string, params?: any[]): this {
    if (params) {
      let adjustedCondition = condition;
      for (let i = 0; i < params.length; i++) {
        adjustedCondition = adjustedCondition.replace('?', `$${this.paramIndex++}`);
        this.params.push(params[i]);
      }
      this.havingClause = `HAVING ${adjustedCondition}`;
    } else {
      this.havingClause = `HAVING ${condition}`;
    }
    return this;
  }

  limit(count: number): this {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }

  offset(count: number): this {
    this.offsetClause = `OFFSET ${count}`;
    return this;
  }

  join(table: string, condition: string, type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER'): this {
    this.joins.push(`${type} JOIN ${table} ON ${condition}`);
    return this;
  }

  build(): { query: string; params: any[] } {
    let query = `SELECT ${this.selectColumns.join(', ')} FROM ${this.schema}.${this.tableName}`;
    
    if (this.joins.length > 0) {
      query += ` ${this.joins.join(' ')}`;
    }
    
    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }
    
    if (this.groupByClause) {
      query += ` ${this.groupByClause}`;
    }
    
    if (this.havingClause) {
      query += ` ${this.havingClause}`;
    }
    
    if (this.orderByClause) {
      query += ` ${this.orderByClause}`;
    }
    
    if (this.limitClause) {
      query += ` ${this.limitClause}`;
    }
    
    if (this.offsetClause) {
      query += ` ${this.offsetClause}`;
    }
    
    return { query, params: this.params };
  }
}

export abstract class BaseRepository<T extends BaseEntityData> {
  protected db: DatabaseConnectionManager;
  protected tableName: string;
  protected schema: string;
  protected EntityClass: new (db: DatabaseConnectionManager, data?: any) => BaseEntity<T>;

  constructor(db: DatabaseConnectionManager, options: RepositoryOptions) {
    this.db = db;
    this.tableName = options.tableName;
    this.schema = options.schema || 'core';
    this.EntityClass = options.entityClass;
  }

  /**
   * Create a new query builder
   */
  query(): SQLQueryBuilder {
    return new SQLQueryBuilder(this.tableName, this.schema);
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<BaseEntity<T> | null> {
    const entity = new this.EntityClass(this.db);
    return entity.findById(id);
  }

  /**
   * Find entities with options
   */
  async find(options: FindOptions = {}): Promise<BaseEntity<T>[]> {
    const entity = new this.EntityClass(this.db);
    return entity.find(options);
  }

  /**
   * Find one entity
   */
  async findOne(options: FindOptions = {}): Promise<BaseEntity<T> | null> {
    const entity = new this.EntityClass(this.db);
    return entity.findOne(options);
  }

  /**
   * Find with pagination
   */
  async findPaginated(
    options: FindOptions = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 }
  ): Promise<PaginatedResult<BaseEntity<T>>> {
    const entity = new this.EntityClass(this.db);
    return entity.findPaginated(options, pagination);
  }

  /**
   * Count entities
   */
  async count(where?: Record<string, any>): Promise<number> {
    const entity = new this.EntityClass(this.db);
    return entity.count(where);
  }

  /**
   * Check if entity exists
   */
  async exists(where: Record<string, any>): Promise<boolean> {
    return (await this.count(where)) > 0;
  }

  /**
   * Create new entity
   */
  async create(data: Partial<T>): Promise<BaseEntity<T>> {
    const entity = new this.EntityClass(this.db, data);
    await entity.save();
    return entity;
  }

  /**
   * Update entity by ID
   */
  async updateById(id: string, data: Partial<T>): Promise<BaseEntity<T> | null> {
    const entity = await this.findById(id);
    if (!entity) return null;
    
    entity.setData(data);
    await entity.save();
    return entity;
  }

  /**
   * Delete entity by ID (soft delete)
   */
  async deleteById(id: string): Promise<boolean> {
    const entity = await this.findById(id);
    if (!entity) return false;
    
    await entity.delete();
    return true;
  }

  /**
   * Hard delete entity by ID
   */
  async hardDeleteById(id: string): Promise<boolean> {
    const entity = await this.findById(id);
    if (!entity) return false;
    
    await entity.hardDelete();
    return true;
  }

  /**
   * Bulk create entities
   */
  async bulkCreate(dataArray: Partial<T>[]): Promise<BaseEntity<T>[]> {
    return this.db.transaction(async (client) => {
      const entities: BaseEntity<T>[] = [];
      
      for (const data of dataArray) {
        const entity = new this.EntityClass(this.db, data);
        await entity.save();
        entities.push(entity);
      }
      
      return entities;
    });
  }

  /**
   * Bulk update entities
   */
  async bulkUpdate(
    where: Record<string, any>,
    data: Partial<T>
  ): Promise<number> {
    const whereConditions = Object.entries(where).map(([field, value], index) => {
      return `${field} = $${index + 1}`;
    });
    
    const setClause = Object.entries(data).map(([field, value], index) => {
      return `${field} = $${Object.keys(where).length + index + 1}`;
    });
    
    const query = `
      UPDATE ${this.schema}.${this.tableName}
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE ${whereConditions.join(' AND ')}
      RETURNING *
    `;
    
    const params = [...Object.values(where), ...Object.values(data)];
    const result = await this.db.query(query, params);
    
    return result.rows.length;
  }

  /**
   * Bulk delete entities
   */
  async bulkDelete(where: Record<string, any>): Promise<number> {
    const whereConditions = Object.entries(where).map(([field, value], index) => {
      return `${field} = $${index + 1}`;
    });
    
    const query = `
      UPDATE ${this.schema}.${this.tableName}
      SET deleted_at = NOW()
      WHERE ${whereConditions.join(' AND ')} AND deleted_at IS NULL
      RETURNING id
    `;
    
    const result = await this.db.query(query, Object.values(where));
    return result.rows.length;
  }

  /**
   * Execute raw query
   */
  async executeQuery<R = any>(
    query: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<R>> {
    return this.db.query<R>(query, params, options);
  }

  /**
   * Execute query with query builder
   */
  async executeQueryBuilder(builder: SQLQueryBuilder): Promise<QueryResult> {
    const { query, params } = builder.build();
    return this.db.query(query, params, { useReadReplica: true });
  }

  /**
   * Find with custom SQL
   */
  async findWithSQL(query: string, params?: any[]): Promise<BaseEntity<T>[]> {
    const result = await this.db.query(query, params, { useReadReplica: true });
    return result.rows.map(row => new this.EntityClass(this.db, row));
  }

  /**
   * Get aggregate data
   */
  async aggregate(options: {
    groupBy?: string[];
    select: string[];
    where?: Record<string, any>;
    having?: string;
    orderBy?: string;
  }): Promise<any[]> {
    const builder = this.query().select(options.select);
    
    if (options.where) {
      Object.entries(options.where).forEach(([field, value]) => {
        builder.where(`${field} = ?`, [value]);
      });
    }
    
    if (options.groupBy) {
      builder.groupBy(options.groupBy);
    }
    
    if (options.having) {
      builder.having(options.having);
    }
    
    if (options.orderBy) {
      const [column, direction] = options.orderBy.split(' ');
      builder.orderBy(column, (direction as 'ASC' | 'DESC') || 'ASC');
    }
    
    const result = await this.executeQueryBuilder(builder);
    return result.rows;
  }

  /**
   * Execute in transaction
   */
  async transaction<R>(
    callback: (repository: this) => Promise<R>
  ): Promise<R> {
    return this.db.transaction(async () => {
      return callback(this);
    });
  }

  /**
   * Refresh entity cache
   */
  async refreshCache(id?: string): Promise<void> {
    // Implementation would depend on caching strategy
    // This is a placeholder for cache invalidation
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<{
    totalRows: number;
    activeRows: number;
    deletedRows: number;
    tableSize: string;
    indexSize: string;
  }> {
    const queries = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) as total_rows 
        FROM ${this.schema}.${this.tableName}
      `, [], { useReadReplica: true }),
      
      this.db.query(`
        SELECT COUNT(*) as active_rows 
        FROM ${this.schema}.${this.tableName} 
        WHERE deleted_at IS NULL
      `, [], { useReadReplica: true }),
      
      this.db.query(`
        SELECT COUNT(*) as deleted_rows 
        FROM ${this.schema}.${this.tableName} 
        WHERE deleted_at IS NOT NULL
      `, [], { useReadReplica: true }),
      
      this.db.query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('${this.schema}.${this.tableName}')) as table_size,
          pg_size_pretty(pg_indexes_size('${this.schema}.${this.tableName}')) as index_size
      `, [], { useReadReplica: true })
    ]);

    return {
      totalRows: parseInt(queries[0].rows[0].total_rows),
      activeRows: parseInt(queries[1].rows[0].active_rows),
      deletedRows: parseInt(queries[2].rows[0].deleted_rows),
      tableSize: queries[3].rows[0].table_size,
      indexSize: queries[3].rows[0].index_size
    };
  }

  /**
   * Optimize table
   */
  async optimize(): Promise<void> {
    await this.db.query(`VACUUM ANALYZE ${this.schema}.${this.tableName}`);
  }
}

export default BaseRepository;
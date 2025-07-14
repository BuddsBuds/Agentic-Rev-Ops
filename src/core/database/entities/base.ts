/**
 * Base Entity Class
 * Provides common functionality for all database entities
 */

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

export abstract class BaseEntity<T extends BaseEntityData> {
  protected db: DatabaseConnectionManager;
  protected tableName: string;
  protected schema: string;
  protected data: Partial<T> = {};
  
  constructor(
    db: DatabaseConnectionManager,
    tableName: string,
    schema: string = 'core',
    data?: Partial<T>
  ) {
    this.db = db;
    this.tableName = tableName;
    this.schema = schema;
    if (data) {
      this.data = { ...data };
    }
  }

  /**
   * Get the full table name with schema
   */
  protected getFullTableName(): string {
    return `${this.schema}.${this.tableName}`;
  }

  /**
   * Get entity data
   */
  getData(): Partial<T> {
    return { ...this.data };
  }

  /**
   * Set entity data
   */
  setData(data: Partial<T>): void {
    this.data = { ...this.data, ...data };
  }

  /**
   * Get a specific field value
   */
  get<K extends keyof T>(field: K): T[K] | undefined {
    return this.data[field];
  }

  /**
   * Set a specific field value
   */
  set<K extends keyof T>(field: K, value: T[K]): void {
    this.data[field] = value;
  }

  /**
   * Check if entity has been persisted
   */
  isPersisted(): boolean {
    return !!this.data.id;
  }

  /**
   * Save entity (insert or update)
   */
  async save(): Promise<void> {
    if (this.isPersisted()) {
      await this.update();
    } else {
      await this.insert();
    }
  }

  /**
   * Insert new entity
   */
  protected async insert(): Promise<void> {
    const fields = Object.keys(this.data).filter(key => key !== 'id');
    const values = fields.map(field => this.data[field as keyof T]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);
    
    const query = `
      INSERT INTO ${this.getFullTableName()} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    const result = await this.db.query(query, values);
    this.data = result.rows[0];
  }

  /**
   * Update existing entity
   */
  protected async update(): Promise<void> {
    const fields = Object.keys(this.data).filter(key => key !== 'id' && key !== 'created_at');
    const values = fields.map(field => this.data[field as keyof T]);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`);
    
    const query = `
      UPDATE ${this.getFullTableName()}
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;
    
    values.push(this.data.id);
    const result = await this.db.query(query, values);
    this.data = result.rows[0];
  }

  /**
   * Delete entity (soft delete)
   */
  async delete(): Promise<void> {
    if (!this.isPersisted()) {
      throw new Error('Cannot delete entity that has not been persisted');
    }
    
    const query = `
      UPDATE ${this.getFullTableName()}
      SET deleted_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [this.data.id]);
    this.data.deleted_at = new Date();
  }

  /**
   * Hard delete entity
   */
  async hardDelete(): Promise<void> {
    if (!this.isPersisted()) {
      throw new Error('Cannot delete entity that has not been persisted');
    }
    
    const query = `DELETE FROM ${this.getFullTableName()} WHERE id = $1`;
    await this.db.query(query, [this.data.id]);
  }

  /**
   * Reload entity from database
   */
  async reload(): Promise<void> {
    if (!this.isPersisted()) {
      throw new Error('Cannot reload entity that has not been persisted');
    }
    
    const result = await this.findById(this.data.id as string);
    if (result) {
      this.data = result.getData();
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<this | null> {
    const query = `
      SELECT * FROM ${this.getFullTableName()}
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const result = await this.db.query(query, [id], { useReadReplica: true });
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.createInstance(result.rows[0]);
  }

  /**
   * Find entities with options
   */
  async find(options: FindOptions = {}): Promise<this[]> {
    let query = `SELECT * FROM ${this.getFullTableName()} WHERE deleted_at IS NULL`;
    const values: any[] = [];
    let paramIndex = 1;
    
    // Add WHERE conditions
    if (options.where) {
      const whereConditions = Object.entries(options.where).map(([field, value]) => {
        values.push(value);
        return `${field} = $${paramIndex++}`;
      });
      
      if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
      }
    }
    
    // Add ORDER BY
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    
    // Add LIMIT and OFFSET
    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(options.limit);
    }
    
    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      values.push(options.offset);
    }
    
    const result = await this.db.query(query, values, { useReadReplica: true });
    return result.rows.map(row => this.createInstance(row));
  }

  /**
   * Find one entity
   */
  async findOne(options: FindOptions = {}): Promise<this | null> {
    const results = await this.find({ ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find with pagination
   */
  async findPaginated(
    options: FindOptions = {},
    pagination: PaginationOptions = { page: 1, pageSize: 10 }
  ): Promise<PaginatedResult<this>> {
    // Get total count
    let countQuery = `SELECT COUNT(*) FROM ${this.getFullTableName()} WHERE deleted_at IS NULL`;
    const countValues: any[] = [];
    let paramIndex = 1;
    
    if (options.where) {
      const whereConditions = Object.entries(options.where).map(([field, value]) => {
        countValues.push(value);
        return `${field} = $${paramIndex++}`;
      });
      
      if (whereConditions.length > 0) {
        countQuery += ` AND ${whereConditions.join(' AND ')}`;
      }
    }
    
    const countResult = await this.db.query(countQuery, countValues, { useReadReplica: true });
    const total = parseInt(countResult.rows[0].count);
    
    // Get paginated data
    const offset = (pagination.page - 1) * pagination.pageSize;
    const data = await this.find({
      ...options,
      limit: pagination.pageSize,
      offset
    });
    
    const totalPages = Math.ceil(total / pagination.pageSize);
    
    return {
      data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1
      }
    };
  }

  /**
   * Count entities
   */
  async count(where?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.getFullTableName()} WHERE deleted_at IS NULL`;
    const values: any[] = [];
    let paramIndex = 1;
    
    if (where) {
      const whereConditions = Object.entries(where).map(([field, value]) => {
        values.push(value);
        return `${field} = $${paramIndex++}`;
      });
      
      if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
      }
    }
    
    const result = await this.db.query(query, values, { useReadReplica: true });
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if entity exists
   */
  async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Execute raw query
   */
  protected async query<R = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<R>> {
    return this.db.query<R>(text, params, options);
  }

  /**
   * Create new instance of this entity type
   */
  protected abstract createInstance(data: T): this;

  /**
   * Validate entity data before saving
   */
  protected validate(): void {
    // Override in subclasses for validation logic
  }

  /**
   * Before save hook
   */
  protected async beforeSave(): Promise<void> {
    // Override in subclasses for pre-save logic
  }

  /**
   * After save hook
   */
  protected async afterSave(): Promise<void> {
    // Override in subclasses for post-save logic
  }

  /**
   * Before delete hook
   */
  protected async beforeDelete(): Promise<void> {
    // Override in subclasses for pre-delete logic
  }

  /**
   * After delete hook
   */
  protected async afterDelete(): Promise<void> {
    // Override in subclasses for post-delete logic
  }

  /**
   * Convert entity to JSON
   */
  toJSON(): T {
    return { ...this.data } as T;
  }

  /**
   * Convert entity to plain object
   */
  toObject(): T {
    return this.toJSON();
  }
}

export default BaseEntity;
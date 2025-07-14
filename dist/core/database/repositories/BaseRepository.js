"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = exports.SQLQueryBuilder = void 0;
class SQLQueryBuilder {
    tableName;
    schema;
    selectColumns = ['*'];
    whereConditions = [];
    joins = [];
    orderByClause = '';
    groupByClause = '';
    havingClause = '';
    limitClause = '';
    offsetClause = '';
    params = [];
    paramIndex = 1;
    constructor(tableName, schema = 'core') {
        this.tableName = tableName;
        this.schema = schema;
    }
    select(columns) {
        if (columns && columns.length > 0) {
            this.selectColumns = columns;
        }
        return this;
    }
    where(condition, params) {
        if (params) {
            let adjustedCondition = condition;
            for (let i = 0; i < params.length; i++) {
                adjustedCondition = adjustedCondition.replace('?', `$${this.paramIndex++}`);
                this.params.push(params[i]);
            }
            this.whereConditions.push(adjustedCondition);
        }
        else {
            this.whereConditions.push(condition);
        }
        return this;
    }
    whereIn(column, values) {
        if (values.length === 0)
            return this;
        const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
        this.whereConditions.push(`${column} IN (${placeholders})`);
        this.params.push(...values);
        return this;
    }
    whereNotNull(column) {
        this.whereConditions.push(`${column} IS NOT NULL`);
        return this;
    }
    whereBetween(column, start, end) {
        this.whereConditions.push(`${column} BETWEEN $${this.paramIndex++} AND $${this.paramIndex++}`);
        this.params.push(start, end);
        return this;
    }
    orderBy(column, direction = 'ASC') {
        if (this.orderByClause) {
            this.orderByClause += `, ${column} ${direction}`;
        }
        else {
            this.orderByClause = `ORDER BY ${column} ${direction}`;
        }
        return this;
    }
    groupBy(columns) {
        this.groupByClause = `GROUP BY ${columns.join(', ')}`;
        return this;
    }
    having(condition, params) {
        if (params) {
            let adjustedCondition = condition;
            for (let i = 0; i < params.length; i++) {
                adjustedCondition = adjustedCondition.replace('?', `$${this.paramIndex++}`);
                this.params.push(params[i]);
            }
            this.havingClause = `HAVING ${adjustedCondition}`;
        }
        else {
            this.havingClause = `HAVING ${condition}`;
        }
        return this;
    }
    limit(count) {
        this.limitClause = `LIMIT ${count}`;
        return this;
    }
    offset(count) {
        this.offsetClause = `OFFSET ${count}`;
        return this;
    }
    join(table, condition, type = 'INNER') {
        this.joins.push(`${type} JOIN ${table} ON ${condition}`);
        return this;
    }
    build() {
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
exports.SQLQueryBuilder = SQLQueryBuilder;
class BaseRepository {
    db;
    tableName;
    schema;
    EntityClass;
    constructor(db, options) {
        this.db = db;
        this.tableName = options.tableName;
        this.schema = options.schema || 'core';
        this.EntityClass = options.entityClass;
    }
    query() {
        return new SQLQueryBuilder(this.tableName, this.schema);
    }
    async findById(id) {
        const entity = new this.EntityClass(this.db);
        return entity.findById(id);
    }
    async find(options = {}) {
        const entity = new this.EntityClass(this.db);
        return entity.find(options);
    }
    async findOne(options = {}) {
        const entity = new this.EntityClass(this.db);
        return entity.findOne(options);
    }
    async findPaginated(options = {}, pagination = { page: 1, pageSize: 10 }) {
        const entity = new this.EntityClass(this.db);
        return entity.findPaginated(options, pagination);
    }
    async count(where) {
        const entity = new this.EntityClass(this.db);
        return entity.count(where);
    }
    async exists(where) {
        return (await this.count(where)) > 0;
    }
    async create(data) {
        const entity = new this.EntityClass(this.db, data);
        await entity.save();
        return entity;
    }
    async updateById(id, data) {
        const entity = await this.findById(id);
        if (!entity)
            return null;
        entity.setData(data);
        await entity.save();
        return entity;
    }
    async deleteById(id) {
        const entity = await this.findById(id);
        if (!entity)
            return false;
        await entity.delete();
        return true;
    }
    async hardDeleteById(id) {
        const entity = await this.findById(id);
        if (!entity)
            return false;
        await entity.hardDelete();
        return true;
    }
    async bulkCreate(dataArray) {
        return this.db.transaction(async (client) => {
            const entities = [];
            for (const data of dataArray) {
                const entity = new this.EntityClass(this.db, data);
                await entity.save();
                entities.push(entity);
            }
            return entities;
        });
    }
    async bulkUpdate(where, data) {
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
    async bulkDelete(where) {
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
    async executeQuery(query, params, options) {
        return this.db.query(query, params, options);
    }
    async executeQueryBuilder(builder) {
        const { query, params } = builder.build();
        return this.db.query(query, params, { useReadReplica: true });
    }
    async findWithSQL(query, params) {
        const result = await this.db.query(query, params, { useReadReplica: true });
        return result.rows.map(row => new this.EntityClass(this.db, row));
    }
    async aggregate(options) {
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
            builder.orderBy(column, direction || 'ASC');
        }
        const result = await this.executeQueryBuilder(builder);
        return result.rows;
    }
    async transaction(callback) {
        return this.db.transaction(async () => {
            return callback(this);
        });
    }
    async refreshCache(id) {
    }
    async getTableStats() {
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
    async optimize() {
        await this.db.query(`VACUUM ANALYZE ${this.schema}.${this.tableName}`);
    }
}
exports.BaseRepository = BaseRepository;
exports.default = BaseRepository;
//# sourceMappingURL=BaseRepository.js.map
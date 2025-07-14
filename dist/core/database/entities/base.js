"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEntity = void 0;
class BaseEntity {
    db;
    tableName;
    schema;
    data = {};
    constructor(db, tableName, schema = 'core', data) {
        this.db = db;
        this.tableName = tableName;
        this.schema = schema;
        if (data) {
            this.data = { ...data };
        }
    }
    getFullTableName() {
        return `${this.schema}.${this.tableName}`;
    }
    getData() {
        return { ...this.data };
    }
    setData(data) {
        this.data = { ...this.data, ...data };
    }
    get(field) {
        return this.data[field];
    }
    set(field, value) {
        this.data[field] = value;
    }
    isPersisted() {
        return !!this.data.id;
    }
    async save() {
        if (this.isPersisted()) {
            await this.update();
        }
        else {
            await this.insert();
        }
    }
    async insert() {
        const fields = Object.keys(this.data).filter(key => key !== 'id');
        const values = fields.map(field => this.data[field]);
        const placeholders = fields.map((_, index) => `$${index + 1}`);
        const query = `
      INSERT INTO ${this.getFullTableName()} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
        const result = await this.db.query(query, values);
        this.data = result.rows[0];
    }
    async update() {
        const fields = Object.keys(this.data).filter(key => key !== 'id' && key !== 'created_at');
        const values = fields.map(field => this.data[field]);
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
    async delete() {
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
    async hardDelete() {
        if (!this.isPersisted()) {
            throw new Error('Cannot delete entity that has not been persisted');
        }
        const query = `DELETE FROM ${this.getFullTableName()} WHERE id = $1`;
        await this.db.query(query, [this.data.id]);
    }
    async reload() {
        if (!this.isPersisted()) {
            throw new Error('Cannot reload entity that has not been persisted');
        }
        const result = await this.findById(this.data.id);
        if (result) {
            this.data = result.getData();
        }
    }
    async findById(id) {
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
    async find(options = {}) {
        let query = `SELECT * FROM ${this.getFullTableName()} WHERE deleted_at IS NULL`;
        const values = [];
        let paramIndex = 1;
        if (options.where) {
            const whereConditions = Object.entries(options.where).map(([field, value]) => {
                values.push(value);
                return `${field} = $${paramIndex++}`;
            });
            if (whereConditions.length > 0) {
                query += ` AND ${whereConditions.join(' AND ')}`;
            }
        }
        if (options.orderBy) {
            query += ` ORDER BY ${options.orderBy}`;
        }
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
    async findOne(options = {}) {
        const results = await this.find({ ...options, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }
    async findPaginated(options = {}, pagination = { page: 1, pageSize: 10 }) {
        let countQuery = `SELECT COUNT(*) FROM ${this.getFullTableName()} WHERE deleted_at IS NULL`;
        const countValues = [];
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
    async count(where) {
        let query = `SELECT COUNT(*) FROM ${this.getFullTableName()} WHERE deleted_at IS NULL`;
        const values = [];
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
    async exists(where) {
        const count = await this.count(where);
        return count > 0;
    }
    async query(text, params, options) {
        return this.db.query(text, params, options);
    }
    validate() {
    }
    async beforeSave() {
    }
    async afterSave() {
    }
    async beforeDelete() {
    }
    async afterDelete() {
    }
    toJSON() {
        return { ...this.data };
    }
    toObject() {
        return this.toJSON();
    }
}
exports.BaseEntity = BaseEntity;
exports.default = BaseEntity;
//# sourceMappingURL=base.js.map
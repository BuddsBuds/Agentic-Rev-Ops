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
exports.User = void 0;
const base_1 = require("./base");
const crypto = __importStar(require("crypto"));
class User extends base_1.BaseEntity {
    constructor(db, data) {
        super(db, 'users', 'core', data);
    }
    createInstance(data) {
        return new User(this.db, data);
    }
    validate() {
        const data = this.getData();
        if (!data.email || !this.isValidEmail(data.email)) {
            throw new Error('Valid email is required');
        }
        if (!data.organization_id) {
            throw new Error('Organization ID is required');
        }
        if (!['admin', 'manager', 'analyst', 'user', 'viewer'].includes(data.role)) {
            throw new Error('Invalid user role');
        }
        if (data.first_name && data.first_name.length > 100) {
            throw new Error('First name must be less than 100 characters');
        }
        if (data.last_name && data.last_name.length > 100) {
            throw new Error('Last name must be less than 100 characters');
        }
    }
    async beforeSave() {
        this.validate();
        if (!this.get('permissions')) {
            this.set('permissions', this.getDefaultPermissions());
        }
        if (!this.get('security')) {
            this.set('security', {
                mfaEnabled: false,
                loginAttempts: 0
            });
        }
        if (!this.get('profile')) {
            this.set('profile', {
                timezone: 'UTC',
                language: 'en',
                preferences: {}
            });
        }
    }
    static hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    }
    verifyPassword(password) {
        const passwordHash = this.get('password_hash');
        if (!passwordHash)
            return false;
        const [salt, hash] = passwordHash.split(':');
        const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return hash === verifyHash;
    }
    setPassword(password) {
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        this.set('password_hash', User.hashPassword(password));
        const security = this.get('security') || {};
        security.lastPasswordChange = new Date();
        security.loginAttempts = 0;
        this.set('security', security);
    }
    hasPermission(permission) {
        const permissions = this.get('permissions') || [];
        return permissions.includes(permission) || permissions.includes('*');
    }
    hasRole(role) {
        return this.get('role') === role;
    }
    hasMinimumRole(minimumRole) {
        const roleHierarchy = ['viewer', 'user', 'analyst', 'manager', 'admin'];
        const userRoleIndex = roleHierarchy.indexOf(this.get('role'));
        const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);
        return userRoleIndex >= minimumRoleIndex;
    }
    getFullName() {
        const firstName = this.get('first_name') || '';
        const lastName = this.get('last_name') || '';
        return `${firstName} ${lastName}`.trim() || this.get('email');
    }
    async getOrganization() {
        const query = `
      SELECT * FROM core.organizations 
      WHERE id = $1 AND deleted_at IS NULL
    `;
        const result = await this.query(query, [this.get('organization_id')], { useReadReplica: true });
        return result.rows[0] || null;
    }
    async getActiveSessions() {
        const query = `
      SELECT * FROM core.user_sessions 
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_activity DESC
    `;
        const result = await this.query(query, [this.get('id')], { useReadReplica: true });
        return result.rows;
    }
    async createSession(ipAddress, userAgent) {
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const query = `
      INSERT INTO core.user_sessions (id, user_id, token, expires_at, ip_address, user_agent, last_activity)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
        const sessionId = crypto.randomUUID();
        const result = await this.query(query, [
            sessionId,
            this.get('id'),
            sessionToken,
            expiresAt,
            ipAddress,
            userAgent
        ]);
        this.set('last_login_at', new Date());
        await this.save();
        return result.rows[0];
    }
    async validateSession(token) {
        const query = `
      SELECT * FROM core.user_sessions 
      WHERE user_id = $1 AND token = $2 AND expires_at > NOW()
    `;
        const result = await this.query(query, [this.get('id'), token]);
        if (result.rows.length > 0) {
            await this.query(`
        UPDATE core.user_sessions 
        SET last_activity = NOW() 
        WHERE id = $1
      `, [result.rows[0].id]);
            return true;
        }
        return false;
    }
    async revokeSession(sessionId) {
        const query = `
      DELETE FROM core.user_sessions 
      WHERE id = $1 AND user_id = $2
    `;
        await this.query(query, [sessionId, this.get('id')]);
    }
    async revokeAllSessions() {
        const query = `
      DELETE FROM core.user_sessions 
      WHERE user_id = $1
    `;
        await this.query(query, [this.get('id')]);
    }
    async getActivityLog(limit = 50) {
        const query = `
      SELECT * FROM audit.activity_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
        const result = await this.query(query, [this.get('id'), limit], { useReadReplica: true });
        return result.rows;
    }
    async logActivity(action, details, ipAddress, userAgent) {
        const query = `
      INSERT INTO audit.activity_logs (organization_id, user_id, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
        await this.query(query, [
            this.get('organization_id'),
            this.get('id'),
            action,
            details ? JSON.stringify(details) : null,
            ipAddress,
            userAgent
        ]);
    }
    isAccountLocked() {
        const security = this.get('security');
        if (!security?.lockedUntil)
            return false;
        return new Date() < new Date(security.lockedUntil);
    }
    lockAccount(durationMinutes = 30) {
        const security = this.get('security') || {};
        security.lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
        this.set('security', security);
    }
    unlockAccount() {
        const security = this.get('security') || {};
        delete security.lockedUntil;
        security.loginAttempts = 0;
        this.set('security', security);
    }
    incrementFailedAttempts() {
        const security = this.get('security') || {};
        security.loginAttempts = (security.loginAttempts || 0) + 1;
        if (security.loginAttempts >= 5) {
            this.lockAccount();
        }
        this.set('security', security);
    }
    resetFailedAttempts() {
        const security = this.get('security') || {};
        security.loginAttempts = 0;
        this.set('security', security);
    }
    getDefaultPermissions() {
        const role = this.get('role');
        switch (role) {
            case 'admin':
                return ['*'];
            case 'manager':
                return [
                    'users.read', 'users.create', 'users.update',
                    'clients.read', 'clients.create', 'clients.update', 'clients.delete',
                    'swarms.read', 'swarms.create', 'swarms.update', 'swarms.delete',
                    'decisions.read', 'decisions.approve',
                    'analytics.read', 'analytics.export',
                    'integrations.read', 'integrations.manage'
                ];
            case 'analyst':
                return [
                    'clients.read', 'clients.create', 'clients.update',
                    'swarms.read', 'swarms.create',
                    'decisions.read',
                    'analytics.read', 'analytics.export',
                    'integrations.read'
                ];
            case 'user':
                return [
                    'clients.read', 'clients.create', 'clients.update',
                    'swarms.read',
                    'decisions.read',
                    'analytics.read'
                ];
            case 'viewer':
                return [
                    'clients.read',
                    'swarms.read',
                    'decisions.read',
                    'analytics.read'
                ];
            default:
                return ['clients.read'];
        }
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static async findByEmail(db, email) {
        const user = new User(db);
        return user.findOne({ where: { email, is_active: true } });
    }
    static async findByOrganization(db, organizationId) {
        const user = new User(db);
        return user.find({
            where: { organization_id: organizationId, is_active: true },
            orderBy: 'created_at DESC'
        });
    }
    static async authenticate(db, email, password, ipAddress, userAgent) {
        const user = await User.findByEmail(db, email);
        if (!user)
            return null;
        if (user.isAccountLocked()) {
            throw new Error('Account is temporarily locked due to failed login attempts');
        }
        if (!user.get('is_active')) {
            throw new Error('Account is disabled');
        }
        if (!user.verifyPassword(password)) {
            user.incrementFailedAttempts();
            await user.save();
            await user.logActivity('login_failed', { reason: 'invalid_password' }, ipAddress, userAgent);
            return null;
        }
        user.resetFailedAttempts();
        await user.save();
        const session = await user.createSession(ipAddress, userAgent);
        await user.logActivity('login_success', { session_id: session.id }, ipAddress, userAgent);
        return { user, session };
    }
    async changeRole(newRole, changedBy) {
        if (!['admin', 'manager', 'analyst', 'user', 'viewer'].includes(newRole)) {
            throw new Error('Invalid role');
        }
        const oldRole = this.get('role');
        this.set('role', newRole);
        this.set('permissions', this.getDefaultPermissions());
        await this.save();
        await this.logActivity('role_changed', {
            oldRole,
            newRole,
            changedBy
        });
    }
    async updateProfile(updates) {
        const currentProfile = this.get('profile') || {};
        this.set('profile', { ...currentProfile, ...updates });
        await this.save();
    }
    async deactivate(reason) {
        this.set('is_active', false);
        await this.save();
        await this.revokeAllSessions();
        await this.logActivity('account_deactivated', { reason });
    }
    async reactivate() {
        this.set('is_active', true);
        this.unlockAccount();
        await this.save();
        await this.logActivity('account_reactivated');
    }
}
exports.User = User;
exports.default = User;
//# sourceMappingURL=User.js.map
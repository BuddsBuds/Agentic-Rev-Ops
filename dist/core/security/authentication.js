"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationManager = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
class AuthenticationManager extends events_1.EventEmitter {
    db;
    config;
    activeSessions = new Map();
    rateLimitAttempts = new Map();
    passwordHistory = new Map();
    constructor(db, config) {
        super();
        this.db = db;
        this.config = config;
        this.startSessionCleanup();
        this.startRateLimitCleanup();
    }
    async authenticate(email, password, ipAddress, userAgent, mfaToken) {
        try {
            if (this.isRateLimited(email, ipAddress)) {
                this.emit('auth:rate_limited', { email, ipAddress });
                return {
                    success: false,
                    error: 'Too many authentication attempts. Please try again later.'
                };
            }
            const userQuery = `
        SELECT u.*, o.name as organization_name
        FROM core.users u
        JOIN core.organizations o ON u.organization_id = o.id
        WHERE u.email = $1 AND u.is_active = true
      `;
            const userResult = await this.db.query(userQuery, [email.toLowerCase()]);
            if (userResult.rows.length === 0) {
                this.incrementRateLimit(email, ipAddress);
                this.emit('auth:failed', { email, ipAddress, reason: 'user_not_found' });
                return { success: false, error: 'Invalid email or password' };
            }
            const user = userResult.rows[0];
            const passwordValid = await bcrypt_1.default.compare(password, user.password_hash);
            if (!passwordValid) {
                this.incrementRateLimit(email, ipAddress);
                this.emit('auth:failed', { email, ipAddress, reason: 'invalid_password' });
                return { success: false, error: 'Invalid email or password' };
            }
            if (this.config.mfaEnabled && user.mfa_enabled && !mfaToken) {
                const challenge = await this.generateMFAChallenge(user.id);
                return {
                    success: false,
                    requiresMFA: true,
                    mfaChallenge: challenge
                };
            }
            if (this.config.mfaEnabled && user.mfa_enabled && mfaToken) {
                const mfaValid = await this.verifyMFAToken(user.id, mfaToken);
                if (!mfaValid) {
                    this.incrementRateLimit(email, ipAddress);
                    this.emit('auth:mfa_failed', { email, ipAddress, userId: user.id });
                    return { success: false, error: 'Invalid MFA token' };
                }
            }
            const rolesQuery = `
        SELECT DISTINCT r.name as role_name, p.name as permission_name
        FROM core.user_roles ur
        JOIN core.roles r ON ur.role_id = r.id
        LEFT JOIN core.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN core.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
      `;
            const rolesResult = await this.db.query(rolesQuery, [user.id]);
            const roles = [...new Set(rolesResult.rows.map(r => r.role_name))];
            const permissions = [...new Set(rolesResult.rows.map(r => r.permission_name).filter(Boolean))];
            const session = await this.createSession(user, roles, permissions, ipAddress, userAgent);
            const token = await this.generateTokens(user, session, roles, permissions);
            await this.db.query('UPDATE core.users SET last_login_at = NOW() WHERE id = $1', [user.id]);
            this.resetRateLimit(email, ipAddress);
            this.emit('auth:success', {
                userId: user.id,
                email,
                ipAddress,
                sessionId: session.id
            });
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    organizationId: user.organization_id,
                    organizationName: user.organization_name,
                    roles,
                    permissions
                },
                token
            };
        }
        catch (error) {
            this.emit('auth:error', { email, ipAddress, error });
            return { success: false, error: 'Authentication failed' };
        }
    }
    async authenticateOAuth2(provider, authorizationCode, state, ipAddress, userAgent) {
        try {
            const providerConfig = this.config.oauth2Providers.find(p => p.name === provider);
            if (!providerConfig) {
                return { success: false, error: 'Invalid OAuth2 provider' };
            }
            const tokenResponse = await this.exchangeCodeForToken(providerConfig, authorizationCode);
            const userInfo = await this.getUserInfoFromProvider(providerConfig, tokenResponse.access_token);
            let user = await this.findOrCreateOAuth2User(userInfo, provider, providerConfig);
            const rolesQuery = `
        SELECT DISTINCT r.name as role_name, p.name as permission_name
        FROM core.user_roles ur
        JOIN core.roles r ON ur.role_id = r.id
        LEFT JOIN core.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN core.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
      `;
            const rolesResult = await this.db.query(rolesQuery, [user.id]);
            const roles = [...new Set(rolesResult.rows.map(r => r.role_name))];
            const permissions = [...new Set(rolesResult.rows.map(r => r.permission_name).filter(Boolean))];
            const session = await this.createSession(user, roles, permissions, ipAddress, userAgent);
            const token = await this.generateTokens(user, session, roles, permissions);
            this.emit('auth:oauth2_success', {
                userId: user.id,
                provider,
                ipAddress,
                sessionId: session.id
            });
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    organizationId: user.organization_id,
                    roles,
                    permissions
                },
                token
            };
        }
        catch (error) {
            this.emit('auth:oauth2_error', { provider, error });
            return { success: false, error: 'OAuth2 authentication failed' };
        }
    }
    async refreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, this.config.jwtSecret);
            const session = this.activeSessions.get(decoded.sessionId);
            if (!session || session.expiresAt < new Date()) {
                return null;
            }
            const userQuery = `
        SELECT u.*, o.name as organization_name
        FROM core.users u
        JOIN core.organizations o ON u.organization_id = o.id
        WHERE u.id = $1 AND u.is_active = true
      `;
            const userResult = await this.db.query(userQuery, [session.userId]);
            if (userResult.rows.length === 0) {
                return null;
            }
            const user = userResult.rows[0];
            const token = await this.generateTokens(user, session, session.roles, session.permissions);
            session.lastActiveAt = new Date();
            this.activeSessions.set(session.id, session);
            return token;
        }
        catch (error) {
            return null;
        }
    }
    async validateToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.config.jwtSecret);
            const session = this.activeSessions.get(decoded.sessionId);
            if (!session || session.expiresAt < new Date()) {
                return null;
            }
            session.lastActiveAt = new Date();
            this.activeSessions.set(session.id, session);
            return decoded;
        }
        catch (error) {
            return null;
        }
    }
    async logout(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            this.activeSessions.delete(sessionId);
            this.emit('auth:logout', {
                userId: session.userId,
                sessionId: session.id
            });
        }
    }
    async setupMFA(userId) {
        const secret = crypto_1.default.randomBytes(16).toString('hex');
        const qrCode = await this.generateMFAQRCode(userId, secret);
        const backupCodes = this.generateBackupCodes();
        const encryptedSecret = this.encrypt(secret);
        await this.db.query('UPDATE core.users SET mfa_secret = $1, mfa_backup_codes = $2 WHERE id = $3', [encryptedSecret, JSON.stringify(backupCodes), userId]);
        return { secret, qrCode, backupCodes };
    }
    async enableMFA(userId, token) {
        const valid = await this.verifyMFAToken(userId, token);
        if (valid) {
            await this.db.query('UPDATE core.users SET mfa_enabled = true WHERE id = $1', [userId]);
            this.emit('mfa:enabled', { userId });
            return true;
        }
        return false;
    }
    async disableMFA(userId) {
        await this.db.query('UPDATE core.users SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL WHERE id = $1', [userId]);
        this.emit('mfa:disabled', { userId });
    }
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const userResult = await this.db.query('SELECT password_hash FROM core.users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0) {
                return false;
            }
            const passwordValid = await bcrypt_1.default.compare(currentPassword, userResult.rows[0].password_hash);
            if (!passwordValid) {
                return false;
            }
            if (!this.validatePasswordPolicy(newPassword)) {
                throw new Error('Password does not meet policy requirements');
            }
            if (this.isPasswordReused(userId, newPassword)) {
                throw new Error('Password has been used recently');
            }
            const hashedPassword = await bcrypt_1.default.hash(newPassword, this.config.bcryptRounds);
            await this.db.query('UPDATE core.users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [hashedPassword, userId]);
            this.updatePasswordHistory(userId, hashedPassword);
            this.emit('password:changed', { userId });
            return true;
        }
        catch (error) {
            this.emit('password:change_failed', { userId, error });
            return false;
        }
    }
    async generatePasswordResetToken(email) {
        const userResult = await this.db.query('SELECT id FROM core.users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
        if (userResult.rows.length === 0) {
            return null;
        }
        const userId = userResult.rows[0].id;
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.db.query('INSERT INTO core.password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
        this.emit('password:reset_requested', { userId, email });
        return token;
    }
    async resetPassword(token, newPassword) {
        try {
            const tokenResult = await this.db.query('SELECT user_id FROM core.password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL', [token]);
            if (tokenResult.rows.length === 0) {
                return false;
            }
            const userId = tokenResult.rows[0].user_id;
            if (!this.validatePasswordPolicy(newPassword)) {
                throw new Error('Password does not meet policy requirements');
            }
            const hashedPassword = await bcrypt_1.default.hash(newPassword, this.config.bcryptRounds);
            await this.db.transaction(async (client) => {
                await client.query('UPDATE core.users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [hashedPassword, userId]);
                await client.query('UPDATE core.password_reset_tokens SET used_at = NOW() WHERE token = $1', [token]);
            });
            this.emit('password:reset_completed', { userId });
            return true;
        }
        catch (error) {
            this.emit('password:reset_failed', { token, error });
            return false;
        }
    }
    async createSession(user, roles, permissions, ipAddress, userAgent) {
        const sessionId = crypto_1.default.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const session = {
            id: sessionId,
            userId: user.id,
            organizationId: user.organization_id,
            roles,
            permissions,
            ipAddress,
            userAgent,
            createdAt: new Date(),
            expiresAt,
            lastActiveAt: new Date()
        };
        this.activeSessions.set(sessionId, session);
        return session;
    }
    async generateTokens(user, session, roles, permissions) {
        const payload = {
            userId: user.id,
            organizationId: user.organization_id,
            roles,
            permissions,
            sessionId: session.id
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, this.config.jwtSecret, {
            expiresIn: this.config.jwtExpiresIn
        });
        const refreshToken = jsonwebtoken_1.default.sign({ sessionId: session.id }, this.config.jwtSecret, { expiresIn: this.config.refreshTokenExpiresIn });
        return {
            accessToken,
            refreshToken,
            expiresIn: 3600,
            tokenType: 'Bearer'
        };
    }
    isRateLimited(email, ipAddress) {
        const key = `${email}:${ipAddress}`;
        const attempts = this.rateLimitAttempts.get(key) || 0;
        return attempts >= this.config.rateLimiting.maxAttempts;
    }
    incrementRateLimit(email, ipAddress) {
        const key = `${email}:${ipAddress}`;
        const attempts = this.rateLimitAttempts.get(key) || 0;
        this.rateLimitAttempts.set(key, attempts + 1);
    }
    resetRateLimit(email, ipAddress) {
        const key = `${email}:${ipAddress}`;
        this.rateLimitAttempts.delete(key);
    }
    validatePasswordPolicy(password) {
        const policy = this.config.passwordPolicy;
        if (password.length < policy.minLength)
            return false;
        if (policy.requireUppercase && !/[A-Z]/.test(password))
            return false;
        if (policy.requireLowercase && !/[a-z]/.test(password))
            return false;
        if (policy.requireNumbers && !/\d/.test(password))
            return false;
        if (policy.requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password))
            return false;
        return true;
    }
    isPasswordReused(userId, newPassword) {
        const history = this.passwordHistory.get(userId) || [];
        return history.some(hash => bcrypt_1.default.compareSync(newPassword, hash));
    }
    updatePasswordHistory(userId, hashedPassword) {
        const history = this.passwordHistory.get(userId) || [];
        history.unshift(hashedPassword);
        if (history.length > this.config.passwordPolicy.preventReuse) {
            history.pop();
        }
        this.passwordHistory.set(userId, history);
    }
    async generateMFAChallenge(userId) {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    async verifyMFAToken(userId, token) {
        return token.length === 6 && /^\d+$/.test(token);
    }
    async generateMFAQRCode(userId, secret) {
        return `otpauth://totp/AgenticRevOps:${userId}?secret=${secret}&issuer=AgenticRevOps`;
    }
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(crypto_1.default.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }
    encrypt(text) {
        const cipher = crypto_1.default.createCipher('aes-256-cbc', this.config.jwtSecret);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    decrypt(encryptedText) {
        const decipher = crypto_1.default.createDecipher('aes-256-cbc', this.config.jwtSecret);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    async exchangeCodeForToken(provider, code) {
        return { access_token: 'mock_token' };
    }
    async getUserInfoFromProvider(provider, accessToken) {
        return { email: 'user@example.com', name: 'Test User' };
    }
    async findOrCreateOAuth2User(userInfo, provider, providerConfig) {
        return { id: 'user-id', email: userInfo.email };
    }
    startSessionCleanup() {
        setInterval(() => {
            const now = new Date();
            for (const [sessionId, session] of this.activeSessions) {
                if (session.expiresAt < now) {
                    this.activeSessions.delete(sessionId);
                }
            }
        }, 60 * 60 * 1000);
    }
    startRateLimitCleanup() {
        setInterval(() => {
            this.rateLimitAttempts.clear();
        }, this.config.rateLimiting.windowMs);
    }
}
exports.AuthenticationManager = AuthenticationManager;
exports.default = AuthenticationManager;
//# sourceMappingURL=authentication.js.map
/**
 * Authentication & Authorization Framework
 * Supports JWT, OAuth2, RBAC, and multi-factor authentication
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { DatabaseConnectionManager } from '../database/connection';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  mfaEnabled: boolean;
  passwordPolicy: PasswordPolicy;
  oauth2Providers: OAuth2ProviderConfig[];
  rateLimiting: RateLimitConfig;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  preventReuse: number; // Number of previous passwords to check
  maxAge: number; // Days before password expires
}

export interface OAuth2ProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

export interface UserSession {
  id: string;
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface DecodedToken {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface AuthenticationResult {
  success: boolean;
  user?: any;
  token?: AuthToken;
  requiresMFA?: boolean;
  mfaChallenge?: string;
  error?: string;
}

export class AuthenticationManager extends EventEmitter {
  private db: DatabaseConnectionManager;
  private config: AuthConfig;
  private activeSessions: Map<string, UserSession> = new Map();
  private rateLimitAttempts: Map<string, number> = new Map();
  private passwordHistory: Map<string, string[]> = new Map();

  constructor(db: DatabaseConnectionManager, config: AuthConfig) {
    super();
    this.db = db;
    this.config = config;
    this.startSessionCleanup();
    this.startRateLimitCleanup();
  }

  /**
   * Authenticate user with email/password
   */
  async authenticate(
    email: string, 
    password: string, 
    ipAddress: string,
    userAgent: string,
    mfaToken?: string
  ): Promise<AuthenticationResult> {
    try {
      // Check rate limiting
      if (this.isRateLimited(email, ipAddress)) {
        this.emit('auth:rate_limited', { email, ipAddress });
        return { 
          success: false, 
          error: 'Too many authentication attempts. Please try again later.' 
        };
      }

      // Find user
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

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        this.incrementRateLimit(email, ipAddress);
        this.emit('auth:failed', { email, ipAddress, reason: 'invalid_password' });
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if MFA is required
      if (this.config.mfaEnabled && user.mfa_enabled && !mfaToken) {
        const challenge = await this.generateMFAChallenge(user.id);
        return {
          success: false,
          requiresMFA: true,
          mfaChallenge: challenge
        };
      }

      // Verify MFA if provided
      if (this.config.mfaEnabled && user.mfa_enabled && mfaToken) {
        const mfaValid = await this.verifyMFAToken(user.id, mfaToken);
        if (!mfaValid) {
          this.incrementRateLimit(email, ipAddress);
          this.emit('auth:mfa_failed', { email, ipAddress, userId: user.id });
          return { success: false, error: 'Invalid MFA token' };
        }
      }

      // Get user roles and permissions
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

      // Create session
      const session = await this.createSession(user, roles, permissions, ipAddress, userAgent);
      
      // Generate tokens
      const token = await this.generateTokens(user, session, roles, permissions);

      // Update last login
      await this.db.query(
        'UPDATE core.users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Reset rate limiting on successful auth
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

    } catch (error) {
      this.emit('auth:error', { email, ipAddress, error });
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * OAuth2 authentication
   */
  async authenticateOAuth2(
    provider: string,
    authorizationCode: string,
    state: string,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthenticationResult> {
    try {
      const providerConfig = this.config.oauth2Providers.find(p => p.name === provider);
      if (!providerConfig) {
        return { success: false, error: 'Invalid OAuth2 provider' };
      }

      // Exchange authorization code for access token
      const tokenResponse = await this.exchangeCodeForToken(providerConfig, authorizationCode);
      
      // Get user info from provider
      const userInfo = await this.getUserInfoFromProvider(providerConfig, tokenResponse.access_token);
      
      // Find or create user
      let user = await this.findOrCreateOAuth2User(userInfo, provider, providerConfig);
      
      // Get roles and permissions (same as regular auth)
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

      // Create session
      const session = await this.createSession(user, roles, permissions, ipAddress, userAgent);
      
      // Generate tokens
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

    } catch (error) {
      this.emit('auth:oauth2_error', { provider, error });
      return { success: false, error: 'OAuth2 authentication failed' };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;
      
      // Find session
      const session = this.activeSessions.get(decoded.sessionId);
      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      // Get fresh user data
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

      // Generate new tokens
      const token = await this.generateTokens(user, session, session.roles, session.permissions);

      // Update session activity
      session.lastActiveAt = new Date();
      this.activeSessions.set(session.id, session);

      return token;

    } catch (error) {
      return null;
    }
  }

  /**
   * Validate and decode JWT token
   */
  async validateToken(token: string): Promise<DecodedToken | null> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as DecodedToken;
      
      // Check if session is still active
      const session = this.activeSessions.get(decoded.sessionId);
      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      // Update last active
      session.lastActiveAt = new Date();
      this.activeSessions.set(session.id, session);

      return decoded;

    } catch (error) {
      return null;
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      this.emit('auth:logout', { 
        userId: session.userId, 
        sessionId: session.id 
      });
    }
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(userId: string): Promise<MFASetup> {
    const secret = crypto.randomBytes(16).toString('hex');
    const qrCode = await this.generateMFAQRCode(userId, secret);
    const backupCodes = this.generateBackupCodes();

    // Store MFA secret (encrypted)
    const encryptedSecret = this.encrypt(secret);
    await this.db.query(
      'UPDATE core.users SET mfa_secret = $1, mfa_backup_codes = $2 WHERE id = $3',
      [encryptedSecret, JSON.stringify(backupCodes), userId]
    );

    return { secret, qrCode, backupCodes };
  }

  /**
   * Enable MFA for user
   */
  async enableMFA(userId: string, token: string): Promise<boolean> {
    const valid = await this.verifyMFAToken(userId, token);
    if (valid) {
      await this.db.query(
        'UPDATE core.users SET mfa_enabled = true WHERE id = $1',
        [userId]
      );
      this.emit('mfa:enabled', { userId });
      return true;
    }
    return false;
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE core.users SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL WHERE id = $1',
      [userId]
    );
    this.emit('mfa:disabled', { userId });
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<boolean> {
    try {
      // Verify current password
      const userResult = await this.db.query(
        'SELECT password_hash FROM core.users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return false;
      }

      const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      if (!passwordValid) {
        return false;
      }

      // Validate new password
      if (!this.validatePasswordPolicy(newPassword)) {
        throw new Error('Password does not meet policy requirements');
      }

      // Check password history
      if (this.isPasswordReused(userId, newPassword)) {
        throw new Error('Password has been used recently');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.config.bcryptRounds);

      // Update password
      await this.db.query(
        'UPDATE core.users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
        [hashedPassword, userId]
      );

      // Update password history
      this.updatePasswordHistory(userId, hashedPassword);

      this.emit('password:changed', { userId });
      return true;

    } catch (error) {
      this.emit('password:change_failed', { userId, error });
      return false;
    }
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email: string): Promise<string | null> {
    const userResult = await this.db.query(
      'SELECT id FROM core.users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const userId = userResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db.query(
      'INSERT INTO core.password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    this.emit('password:reset_requested', { userId, email });
    return token;
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find valid token
      const tokenResult = await this.db.query(
        'SELECT user_id FROM core.password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL',
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return false;
      }

      const userId = tokenResult.rows[0].user_id;

      // Validate new password
      if (!this.validatePasswordPolicy(newPassword)) {
        throw new Error('Password does not meet policy requirements');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.config.bcryptRounds);

      // Update password and mark token as used
      await this.db.transaction(async (client) => {
        await client.query(
          'UPDATE core.users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
          [hashedPassword, userId]
        );

        await client.query(
          'UPDATE core.password_reset_tokens SET used_at = NOW() WHERE token = $1',
          [token]
        );
      });

      this.emit('password:reset_completed', { userId });
      return true;

    } catch (error) {
      this.emit('password:reset_failed', { token, error });
      return false;
    }
  }

  /**
   * Private helper methods
   */

  private async createSession(
    user: any, 
    roles: string[], 
    permissions: string[], 
    ipAddress: string, 
    userAgent: string
  ): Promise<UserSession> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session: UserSession = {
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

  private async generateTokens(
    user: any, 
    session: UserSession, 
    roles: string[], 
    permissions: string[]
  ): Promise<AuthToken> {
    const payload: Partial<DecodedToken> = {
      userId: user.id,
      organizationId: user.organization_id,
      roles,
      permissions,
      sessionId: session.id
    };

    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      { sessionId: session.id }, 
      this.config.jwtSecret, 
      { expiresIn: this.config.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer'
    };
  }

  private isRateLimited(email: string, ipAddress: string): boolean {
    const key = `${email}:${ipAddress}`;
    const attempts = this.rateLimitAttempts.get(key) || 0;
    return attempts >= this.config.rateLimiting.maxAttempts;
  }

  private incrementRateLimit(email: string, ipAddress: string): void {
    const key = `${email}:${ipAddress}`;
    const attempts = this.rateLimitAttempts.get(key) || 0;
    this.rateLimitAttempts.set(key, attempts + 1);
  }

  private resetRateLimit(email: string, ipAddress: string): void {
    const key = `${email}:${ipAddress}`;
    this.rateLimitAttempts.delete(key);
  }

  private validatePasswordPolicy(password: string): boolean {
    const policy = this.config.passwordPolicy;
    
    if (password.length < policy.minLength) return false;
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
    if (policy.requireNumbers && !/\d/.test(password)) return false;
    if (policy.requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    
    return true;
  }

  private isPasswordReused(userId: string, newPassword: string): boolean {
    const history = this.passwordHistory.get(userId) || [];
    return history.some(hash => bcrypt.compareSync(newPassword, hash));
  }

  private updatePasswordHistory(userId: string, hashedPassword: string): void {
    const history = this.passwordHistory.get(userId) || [];
    history.unshift(hashedPassword);
    
    if (history.length > this.config.passwordPolicy.preventReuse) {
      history.pop();
    }
    
    this.passwordHistory.set(userId, history);
  }

  private async generateMFAChallenge(userId: string): Promise<string> {
    return crypto.randomBytes(16).toString('hex');
  }

  private async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    // Implementation would verify TOTP token against stored secret
    // This is a simplified version
    return token.length === 6 && /^\d+$/.test(token);
  }

  private async generateMFAQRCode(userId: string, secret: string): Promise<string> {
    // Implementation would generate actual QR code
    return `otpauth://totp/AgenticRevOps:${userId}?secret=${secret}&issuer=AgenticRevOps`;
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private encrypt(text: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.config.jwtSecret);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.config.jwtSecret);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private async exchangeCodeForToken(
    provider: OAuth2ProviderConfig, 
    code: string
  ): Promise<any> {
    // Implementation would make HTTP request to provider's token endpoint
    return { access_token: 'mock_token' };
  }

  private async getUserInfoFromProvider(
    provider: OAuth2ProviderConfig, 
    accessToken: string
  ): Promise<any> {
    // Implementation would make HTTP request to provider's user info endpoint
    return { email: 'user@example.com', name: 'Test User' };
  }

  private async findOrCreateOAuth2User(
    userInfo: any, 
    provider: string, 
    providerConfig: OAuth2ProviderConfig
  ): Promise<any> {
    // Implementation would find existing user or create new one
    return { id: 'user-id', email: userInfo.email };
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, session] of this.activeSessions) {
        if (session.expiresAt < now) {
          this.activeSessions.delete(sessionId);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  private startRateLimitCleanup(): void {
    setInterval(() => {
      this.rateLimitAttempts.clear();
    }, this.config.rateLimiting.windowMs);
  }
}

export default AuthenticationManager;
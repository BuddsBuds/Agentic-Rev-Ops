/**
 * User Entity Model
 * Represents users with RBAC support and authentication
 */

import { BaseEntity, BaseEntityData } from './base';
import { DatabaseConnectionManager } from '../connection';
import * as crypto from 'crypto';

export interface UserData extends BaseEntityData {
  organization_id: string;
  email: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'manager' | 'analyst' | 'user' | 'viewer';
  permissions: string[];
  last_login_at?: Date;
  is_active: boolean;
  profile?: {
    avatar?: string;
    timezone?: string;
    language?: string;
    preferences?: Record<string, any>;
  };
  security?: {
    mfaEnabled: boolean;
    lastPasswordChange?: Date;
    loginAttempts?: number;
    lockedUntil?: Date;
  };
}

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  ip_address?: string;
  user_agent?: string;
  last_activity: Date;
}

export class User extends BaseEntity<UserData> {
  constructor(db: DatabaseConnectionManager, data?: Partial<UserData>) {
    super(db, 'users', 'core', data);
  }

  /**
   * Create new instance from data
   */
  protected createInstance(data: UserData): this {
    return new User(this.db, data) as this;
  }

  /**
   * Validate user data
   */
  protected validate(): void {
    const data = this.getData();
    
    if (!data.email || !this.isValidEmail(data.email)) {
      throw new Error('Valid email is required');
    }
    
    if (!data.organization_id) {
      throw new Error('Organization ID is required');
    }
    
    if (!['admin', 'manager', 'analyst', 'user', 'viewer'].includes(data.role!)) {
      throw new Error('Invalid user role');
    }
    
    if (data.first_name && data.first_name.length > 100) {
      throw new Error('First name must be less than 100 characters');
    }
    
    if (data.last_name && data.last_name.length > 100) {
      throw new Error('Last name must be less than 100 characters');
    }
  }

  /**
   * Before save hook
   */
  protected async beforeSave(): Promise<void> {
    this.validate();
    
    // Set default permissions if not provided
    if (!this.get('permissions')) {
      this.set('permissions', this.getDefaultPermissions());
    }
    
    // Set default security settings
    if (!this.get('security')) {
      this.set('security', {
        mfaEnabled: false,
        loginAttempts: 0
      });
    }
    
    // Set default profile
    if (!this.get('profile')) {
      this.set('profile', {
        timezone: 'UTC',
        language: 'en',
        preferences: {}
      });
    }
  }

  /**
   * Hash password
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password
   */
  verifyPassword(password: string): boolean {
    const passwordHash = this.get('password_hash');
    if (!passwordHash) return false;
    
    const [salt, hash] = passwordHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  /**
   * Set password
   */
  setPassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    this.set('password_hash', User.hashPassword(password));
    
    // Update security info
    const security = this.get('security') || {};
    security.lastPasswordChange = new Date();
    security.loginAttempts = 0;
    this.set('security', security);
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string): boolean {
    const permissions = this.get('permissions') || [];
    return permissions.includes(permission) || permissions.includes('*');
  }

  /**
   * Check if user has role
   */
  hasRole(role: string): boolean {
    return this.get('role') === role;
  }

  /**
   * Check if user has minimum role level
   */
  hasMinimumRole(minimumRole: string): boolean {
    const roleHierarchy = ['viewer', 'user', 'analyst', 'manager', 'admin'];
    const userRoleIndex = roleHierarchy.indexOf(this.get('role')!);
    const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);
    
    return userRoleIndex >= minimumRoleIndex;
  }

  /**
   * Get full name
   */
  getFullName(): string {
    const firstName = this.get('first_name') || '';
    const lastName = this.get('last_name') || '';
    return `${firstName} ${lastName}`.trim() || this.get('email')!;
  }

  /**
   * Get organization
   */
  async getOrganization(): Promise<any> {
    const query = `
      SELECT * FROM core.organizations 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.query(query, [this.get('organization_id')], { useReadReplica: true });
    return result.rows[0] || null;
  }

  /**
   * Get user's active sessions
   */
  async getActiveSessions(): Promise<UserSession[]> {
    const query = `
      SELECT * FROM core.user_sessions 
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_activity DESC
    `;
    const result = await this.query(query, [this.get('id')], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Create session
   */
  async createSession(ipAddress?: string, userAgent?: string): Promise<UserSession> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
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
    
    // Update last login
    this.set('last_login_at', new Date());
    await this.save();
    
    return result.rows[0];
  }

  /**
   * Validate session
   */
  async validateSession(token: string): Promise<boolean> {
    const query = `
      SELECT * FROM core.user_sessions 
      WHERE user_id = $1 AND token = $2 AND expires_at > NOW()
    `;
    const result = await this.query(query, [this.get('id'), token]);
    
    if (result.rows.length > 0) {
      // Update last activity
      await this.query(`
        UPDATE core.user_sessions 
        SET last_activity = NOW() 
        WHERE id = $1
      `, [result.rows[0].id]);
      
      return true;
    }
    
    return false;
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    const query = `
      DELETE FROM core.user_sessions 
      WHERE id = $1 AND user_id = $2
    `;
    await this.query(query, [sessionId, this.get('id')]);
  }

  /**
   * Revoke all sessions
   */
  async revokeAllSessions(): Promise<void> {
    const query = `
      DELETE FROM core.user_sessions 
      WHERE user_id = $1
    `;
    await this.query(query, [this.get('id')]);
  }

  /**
   * Get user activity log
   */
  async getActivityLog(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT * FROM audit.activity_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [this.get('id'), limit], { useReadReplica: true });
    return result.rows;
  }

  /**
   * Log user activity
   */
  async logActivity(action: string, details?: any, ipAddress?: string, userAgent?: string): Promise<void> {
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

  /**
   * Check if account is locked
   */
  isAccountLocked(): boolean {
    const security = this.get('security');
    if (!security?.lockedUntil) return false;
    
    return new Date() < new Date(security.lockedUntil);
  }

  /**
   * Lock account
   */
  lockAccount(durationMinutes: number = 30): void {
    const security = this.get('security') || {};
    security.lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    this.set('security', security);
  }

  /**
   * Unlock account
   */
  unlockAccount(): void {
    const security = this.get('security') || {};
    delete security.lockedUntil;
    security.loginAttempts = 0;
    this.set('security', security);
  }

  /**
   * Increment failed login attempts
   */
  incrementFailedAttempts(): void {
    const security = this.get('security') || {};
    security.loginAttempts = (security.loginAttempts || 0) + 1;
    
    // Lock account after 5 failed attempts
    if (security.loginAttempts >= 5) {
      this.lockAccount();
    }
    
    this.set('security', security);
  }

  /**
   * Reset failed login attempts
   */
  resetFailedAttempts(): void {
    const security = this.get('security') || {};
    security.loginAttempts = 0;
    this.set('security', security);
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(): string[] {
    const role = this.get('role');
    
    switch (role) {
      case 'admin':
        return ['*']; // All permissions
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

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Find user by email
   */
  static async findByEmail(db: DatabaseConnectionManager, email: string): Promise<User | null> {
    const user = new User(db);
    return user.findOne({ where: { email, is_active: true } });
  }

  /**
   * Find users by organization
   */
  static async findByOrganization(
    db: DatabaseConnectionManager, 
    organizationId: string
  ): Promise<User[]> {
    const user = new User(db);
    return user.find({ 
      where: { organization_id: organizationId, is_active: true },
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Authenticate user
   */
  static async authenticate(
    db: DatabaseConnectionManager,
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; session: UserSession } | null> {
    const user = await User.findByEmail(db, email);
    if (!user) return null;
    
    // Check if account is locked
    if (user.isAccountLocked()) {
      throw new Error('Account is temporarily locked due to failed login attempts');
    }
    
    // Check if account is active
    if (!user.get('is_active')) {
      throw new Error('Account is disabled');
    }
    
    // Verify password
    if (!user.verifyPassword(password)) {
      user.incrementFailedAttempts();
      await user.save();
      await user.logActivity('login_failed', { reason: 'invalid_password' }, ipAddress, userAgent);
      return null;
    }
    
    // Reset failed attempts and create session
    user.resetFailedAttempts();
    await user.save();
    
    const session = await user.createSession(ipAddress, userAgent);
    await user.logActivity('login_success', { session_id: session.id }, ipAddress, userAgent);
    
    return { user, session };
  }

  /**
   * Change user role (admin only)
   */
  async changeRole(newRole: string, changedBy: string): Promise<void> {
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

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserData['profile']>): Promise<void> {
    const currentProfile = this.get('profile') || {};
    this.set('profile', { ...currentProfile, ...updates });
    await this.save();
  }

  /**
   * Deactivate user
   */
  async deactivate(reason?: string): Promise<void> {
    this.set('is_active', false);
    await this.save();
    
    // Revoke all sessions
    await this.revokeAllSessions();
    
    await this.logActivity('account_deactivated', { reason });
  }

  /**
   * Reactivate user
   */
  async reactivate(): Promise<void> {
    this.set('is_active', true);
    this.unlockAccount();
    await this.save();
    
    await this.logActivity('account_reactivated');
  }
}

export default User;
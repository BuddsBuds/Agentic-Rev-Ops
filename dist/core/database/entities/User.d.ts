import { BaseEntity, BaseEntityData } from './base';
import { DatabaseConnectionManager } from '../connection';
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
export declare class User extends BaseEntity<UserData> {
    constructor(db: DatabaseConnectionManager, data?: Partial<UserData>);
    protected createInstance(data: UserData): this;
    protected validate(): void;
    protected beforeSave(): Promise<void>;
    static hashPassword(password: string): string;
    verifyPassword(password: string): boolean;
    setPassword(password: string): void;
    hasPermission(permission: string): boolean;
    hasRole(role: string): boolean;
    hasMinimumRole(minimumRole: string): boolean;
    getFullName(): string;
    getOrganization(): Promise<any>;
    getActiveSessions(): Promise<UserSession[]>;
    createSession(ipAddress?: string, userAgent?: string): Promise<UserSession>;
    validateSession(token: string): Promise<boolean>;
    revokeSession(sessionId: string): Promise<void>;
    revokeAllSessions(): Promise<void>;
    getActivityLog(limit?: number): Promise<any[]>;
    logActivity(action: string, details?: any, ipAddress?: string, userAgent?: string): Promise<void>;
    isAccountLocked(): boolean;
    lockAccount(durationMinutes?: number): void;
    unlockAccount(): void;
    incrementFailedAttempts(): void;
    resetFailedAttempts(): void;
    private getDefaultPermissions;
    private isValidEmail;
    static findByEmail(db: DatabaseConnectionManager, email: string): Promise<User | null>;
    static findByOrganization(db: DatabaseConnectionManager, organizationId: string): Promise<User[]>;
    static authenticate(db: DatabaseConnectionManager, email: string, password: string, ipAddress?: string, userAgent?: string): Promise<{
        user: User;
        session: UserSession;
    } | null>;
    changeRole(newRole: string, changedBy: string): Promise<void>;
    updateProfile(updates: Partial<UserData['profile']>): Promise<void>;
    deactivate(reason?: string): Promise<void>;
    reactivate(): Promise<void>;
}
export default User;
//# sourceMappingURL=User.d.ts.map
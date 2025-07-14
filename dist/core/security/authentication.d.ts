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
    preventReuse: number;
    maxAge: number;
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
export declare class AuthenticationManager extends EventEmitter {
    private db;
    private config;
    private activeSessions;
    private rateLimitAttempts;
    private passwordHistory;
    constructor(db: DatabaseConnectionManager, config: AuthConfig);
    authenticate(email: string, password: string, ipAddress: string, userAgent: string, mfaToken?: string): Promise<AuthenticationResult>;
    authenticateOAuth2(provider: string, authorizationCode: string, state: string, ipAddress: string, userAgent: string): Promise<AuthenticationResult>;
    refreshToken(refreshToken: string): Promise<AuthToken | null>;
    validateToken(token: string): Promise<DecodedToken | null>;
    logout(sessionId: string): Promise<void>;
    setupMFA(userId: string): Promise<MFASetup>;
    enableMFA(userId: string, token: string): Promise<boolean>;
    disableMFA(userId: string): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
    generatePasswordResetToken(email: string): Promise<string | null>;
    resetPassword(token: string, newPassword: string): Promise<boolean>;
    private createSession;
    private generateTokens;
    private isRateLimited;
    private incrementRateLimit;
    private resetRateLimit;
    private validatePasswordPolicy;
    private isPasswordReused;
    private updatePasswordHistory;
    private generateMFAChallenge;
    private verifyMFAToken;
    private generateMFAQRCode;
    private generateBackupCodes;
    private encrypt;
    private decrypt;
    private exchangeCodeForToken;
    private getUserInfoFromProvider;
    private findOrCreateOAuth2User;
    private startSessionCleanup;
    private startRateLimitCleanup;
}
export default AuthenticationManager;
//# sourceMappingURL=authentication.d.ts.map
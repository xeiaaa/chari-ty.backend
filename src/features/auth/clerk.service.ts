import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/express';
import { ClerkClient, createClerkClient, Invitation } from '@clerk/backend';

/**
 * Interface for Clerk token payload
 */
export interface ClerkTokenPayload {
  sub: string; // User ID (Clerk user ID)
  userId?: string; // Alternative user ID field
  email?: string;
  iat: number; // Issued at
  exp: number; // Expiration time
  iss?: string; // Issuer
  [key: string]: any; // Allow additional properties
}

export interface ClerkTokenHeader {
  alg: string;
  typ: string;
}

/**
 * ClerkService handles Clerk authentication operations
 */
@Injectable()
export class ClerkService {
  private readonly clerkSecretKey: string;
  private readonly nodeEnv: string;
  private readonly clerkClient: ClerkClient;

  constructor(private configService: ConfigService) {
    this.clerkSecretKey = this.configService.get<string>(
      'CLERK_SECRET_KEY',
      '',
    );
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    if (!this.clerkSecretKey) {
      throw new Error(
        'CLERK_SECRET_KEY is required but not found in environment variables',
      );
    }
    this.clerkClient = createClerkClient({ secretKey: this.clerkSecretKey });
  }

  /**
   * Verify Clerk session token or development token
   */
  async verifySessionToken(token: string): Promise<ClerkTokenPayload> {
    try {
      // Check if this is a development token
      if (this.isDevelopmentToken(token)) {
        return this.verifyDevelopmentToken(token);
      }

      // Verify real Clerk token
      const payload = await verifyToken(token, {
        secretKey: this.clerkSecretKey,
      });

      return payload as ClerkTokenPayload;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Token verification failed: ${error.message}`);
      }

      throw new Error('Token verification failed: Unknown error');
    }
  }

  /**
   * Check if token is a development token
   */
  private isDevelopmentToken(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString(),
      ) as ClerkTokenHeader;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString(),
      ) as ClerkTokenPayload;

      // Check for development token markers
      return header.alg === 'dev' || payload.iss === 'clerk-dev';
    } catch {
      return false;
    }
  }

  /**
   * Verify development token manually
   */
  private verifyDevelopmentToken(token: string): ClerkTokenPayload {
    // Only allow development tokens in development / test environment
    const isDevelopment =
      this.nodeEnv === 'development' || this.nodeEnv === 'test';
    if (!isDevelopment) {
      throw new Error(
        'Development tokens are only allowed in development environment',
      );
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString(),
      ) as ClerkTokenHeader;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString(),
      ) as ClerkTokenPayload;
      const signature = parts[2];

      /*
          {
      header: { alg: 'dev', typ: 'JWT' },
      payload: {
        sub: '8e23bf04-f5b9-46ba-a310-3aee399bee7c',
        email: 'user1@example.com',
        iat: 1753929205,
        exp: 1753932805,
        iss: 'clerk-dev'
      },
      signature: 'ZGV2LXNpZ25hdHVyZS04ZTIzYmYwNC1mNWI5LTQ2YmEtYTMxMC0zYWVlMzk5YmVlN2MtMTc1MzkyOTIwNTE2OA'
    }
      */

      // Validate header
      if (header.alg !== 'dev' || header.typ !== 'JWT') {
        throw new Error('Invalid development token header');
      }

      // Validate payload
      if (!payload.sub || !payload.email || !payload.iat || !payload.exp) {
        throw new Error('Invalid development token payload');
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new Error('Development token has expired');
      }

      // Validate signature format (basic check)
      const expectedSignaturePrefix = Buffer.from(
        `dev-signature-${payload.sub}-`,
      ).toString('base64url');
      if (!signature.startsWith(expectedSignaturePrefix.substring(0, 20))) {
        throw new Error('Invalid development token signature');
      }

      return {
        ...payload,
        userId: payload.sub, // Map sub to userId for compatibility
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          `Development token verification failed: ${error.message}`,
        );
      }

      throw new Error('Development token verification failed: Unknown error');
    }
  }

  /**
   * Invite a user via Clerk
   */
  async inviteUser({
    email,
    invitedByEmail,
    invitedByName,
    groupId,
    groupName,
    role,
    redirectUrl,
  }: {
    email: string;
    invitedByEmail: string;
    invitedByName: string;
    groupId: string;
    groupName: string;
    role: string;
    redirectUrl?: string;
  }): Promise<Invitation> {
    return await this.clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        invitedByEmail,
        invitedByName,
        groupId,
        groupName,
        role,
      },
      ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
    });
  }

  /**
   * Expose the Clerk client for internal use (e.g., user lookups)
   */
  public getClerkClient() {
    return this.clerkClient;
  }

  /**
   * Get Clerk secret key
   */
  getSecretKey(): string {
    return this.clerkSecretKey;
  }
}

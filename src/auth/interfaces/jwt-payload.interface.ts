// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // user id
  email: string;
  sessionId?: string;
  roles?: string[];
  iat?: number; // issued at timestamp
  exp?: number; // expiration timestamp
}

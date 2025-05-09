// src/common/interfaces/parsed-request.interface.ts
import { Request } from 'express';

/**
 * Extended Request interface with additional properties
 * This is useful for middleware that adds properties to the request object
 */
export interface ParsedRequest extends Request {
  // Basic properties from Express Request are already included

  // Additional properties that might be set by middleware
  id?: string; // Request ID for tracing
  startTime?: number; // Timestamp for request timing
  user?: any; // User information after authentication
  roles?: string[]; // User roles for authorization
  headers: {
    [key: string]: string | string[] | undefined;
  };
  // Additional properties for tracking
  trackingInfo?: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
    // Any other tracking information
  };
}

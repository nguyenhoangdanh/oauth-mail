// src/email/interfaces/email-job.interface.ts
/**
 * Interface for a single email job
 */
export interface EmailJob {
  id: string;
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
  attempts?: number;
  batchId?: string;
  campaignId?: string;
  status?:
    | 'pending'
    | 'processing'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'failed';
  messageId?: string;
  sentAt?: Date;
  error?: string;
}

/**
 * Interface for a bulk email job
 */
export interface BulkEmailJob {
  batchId: string;
  recipients: Array<{
    email: string;
    name?: string;
    context?: Record<string, any>;
  }>;
  template: string;
  subject: string;
  context: Record<string, any>;
  campaignId?: string;
  tags?: string[];
  userId?: string;
}

/**
 * Interface for webhook event payload
 */
export interface WebhookEvent {
  id: string;
  event:
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'complained'
    | 'failed';
  emailId: string;
  recipient: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EmailDeliveryStatus {
  id: string;
  emailId: string;
  status: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface EmailWebhookPayload {
  id: string;
  event:
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'complained'
    | 'failed';
  emailId: string;
  timestamp: Date;
  recipient: string;
  metadata?: Record<string, any>;
  signature?: string;
}

export interface EmailTrackingData {
  userAgent?: string;
  ipAddress?: string;
  device?: {
    type: string;
    name: string;
    os?: string;
  };
  timestamp?: Date;
  url?: string;
}

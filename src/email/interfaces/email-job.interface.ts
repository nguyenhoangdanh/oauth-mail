// src/email/interfaces/email-job.interface.ts
export interface EmailJob {
  id: string;
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
  attempts?: number;
  status?: 'pending' | 'processing' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  error?: string;
  sentAt?: Date;
  messageId?: string;
  batchId?: string;
  campaignId?: string;
  priority?: number;
}
  
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
  // Added these missing properties:
  tags?: string[];
  userId?: string;
  name?: string;
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
  event: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  emailId: string;
  timestamp: Date;
  recipient: string;
  metadata?: Record<string, any>;
  signature?: string;
}
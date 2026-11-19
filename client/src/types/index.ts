// Central type definitions for the HookShield frontend

export interface Endpoint {
  id: string;
  ownerId: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointWithSecret extends Endpoint {
  secret?: string;
}

export interface EndpointTestResult {
  success: boolean;
  statusCode?: number;
  durationMs: number;
  responseBody?: string;
  error?: string;
}

export interface Event {
  _id: string;
  eventId: string;
  ownerId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type DeliveryStatus = 'pending' | 'delivering' | 'success' | 'retrying' | 'failed';

export interface Delivery {
  _id: string;
  eventId: any;
  endpointId: any;
  ownerId: string;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  lastStatusCode?: number;
  lastDurationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAttempt {
  _id: string;
  deliveryId: string;
  attemptNo: number;
  statusCode?: number;
  durationMs: number;
  errorCategory?: string;
  responseBody?: string;
  success: boolean;
  attemptedAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export interface DashboardStats {
  pending: number;
  delivering: number;
  retrying: number;
  success: number;
  failed: number;
  total: number;
}

export interface ReceiverConfig {
  forceStatus: number;
  delayMs: number;
  failCount: number;
  requestCount: number;
}

export interface ReceiverLog {
  id: string;
  requestNo: number;
  receivedAt: string;
  eventType: string;
  deliveryId: string;
  statusCode: number;
  failureReason?: string;
  signatureHeader?: string;
  parsedTimestamp?: string;
  parsedSignature?: string;
  headers: Record<string, string>;
  body: any;
}

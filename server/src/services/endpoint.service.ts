import { Endpoint, IEndpoint } from '../models/Endpoint';
import { Delivery } from '../models/Delivery';
import { AppError } from '../middleware/errorHandler';
import { encryptSecret, decryptSecret } from '../utils/encryption';
import { buildSignatureHeader } from '../utils/signPayload';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface CreateEndpointInput {
  ownerId: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  secret?: string; // if omitted, one is generated
}

export interface SafeEndpoint {
  id: string;
  ownerId: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toSafe(endpoint: IEndpoint): SafeEndpoint {
  return {
    id: endpoint._id.toString(),
    ownerId: endpoint.ownerId,
    url: endpoint.url,
    description: endpoint.description,
    subscribedEvents: endpoint.subscribedEvents,
    enabled: endpoint.enabled,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

export async function createEndpoint(input: CreateEndpointInput): Promise<{ endpoint: SafeEndpoint; secret: string }> {
  const secret = input.secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
  const encryptedSecret = encryptSecret(secret);

  const endpoint = new Endpoint({
    ownerId: input.ownerId,
    url: input.url,
    description: input.description,
    subscribedEvents: input.subscribedEvents,
    enabled: true,
    encryptedSecret,
  });
  await endpoint.save();
  return { endpoint: toSafe(endpoint), secret };
}

export async function listEndpoints(ownerId: string, page = 1, limit = 20): Promise<{
  data: SafeEndpoint[];
  total: number;
  page: number;
  pages: number;
}> {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Endpoint.find({ ownerId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Endpoint.countDocuments({ ownerId }),
  ]);
  return { data: data.map(toSafe), total, page, pages: Math.ceil(total / limit) };
}

export async function getEndpoint(id: string, ownerId: string): Promise<SafeEndpoint> {
  const endpoint = await Endpoint.findOne({ _id: id, ownerId });
  if (!endpoint) throw new AppError(404, 'Endpoint not found');
  return toSafe(endpoint);
}

export async function updateEndpoint(
  id: string,
  ownerId: string,
  updates: Partial<Pick<IEndpoint, 'enabled' | 'subscribedEvents' | 'description' | 'url'>>
): Promise<SafeEndpoint> {
  const endpoint = await Endpoint.findOne({ _id: id, ownerId });
  if (!endpoint) throw new AppError(404, 'Endpoint not found');
  Object.assign(endpoint, updates);
  await endpoint.save();
  return toSafe(endpoint);
}

export async function deleteEndpoint(id: string, ownerId: string): Promise<boolean> {
  const endpoint = await Endpoint.findOneAndDelete({ _id: id, ownerId });
  if (!endpoint) throw new AppError(404, 'Endpoint not found');
  // Clean up or mark pending deliveries as failed
  await Delivery.updateMany(
    { endpointId: id, status: { $in: ['pending', 'retrying'] } },
    { $set: { status: 'failed', lastError: 'Endpoint was deleted' } }
  );
  return true;
}

export async function rotateEndpointSecret(id: string, ownerId: string): Promise<{ endpoint: SafeEndpoint; secret: string }> {
  const endpoint = await Endpoint.findOne({ _id: id, ownerId });
  if (!endpoint) throw new AppError(404, 'Endpoint not found');

  const newSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
  endpoint.encryptedSecret = encryptSecret(newSecret);
  await endpoint.save();

  return { endpoint: toSafe(endpoint), secret: newSecret };
}

export async function getEndpointSecret(id: string, ownerId: string): Promise<string> {
  const endpoint = await Endpoint.findOne({ _id: id, ownerId }).select('+encryptedSecret');
  if (!endpoint) throw new AppError(404, 'Endpoint not found');
  return decryptSecret(endpoint.encryptedSecret);
}

export async function findMatchingEndpoints(ownerId: string, eventType: string): Promise<IEndpoint[]> {
  return Endpoint.find({
    ownerId,
    enabled: true,
    subscribedEvents: eventType,
  }).select('+encryptedSecret');
}

export async function testEndpoint(id: string, ownerId: string): Promise<{
  success: boolean;
  statusCode?: number;
  durationMs: number;
  responseBody?: string;
  error?: string;
}> {
  const endpoint = await Endpoint.findOne({ _id: id, ownerId }).select('+encryptedSecret');
  if (!endpoint) throw new AppError(404, 'Endpoint not found');

  const secret = decryptSecret(endpoint.encryptedSecret);
  const testPayload = {
    event: 'hookshield.test_ping',
    timestamp: new Date().toISOString(),
    message: 'Verification ping from HookShield Webhook Reliability Engine',
    endpointId: id,
  };
  const rawBody = JSON.stringify(testPayload);
  const signature = buildSignatureHeader(rawBody, secret);

  const startTime = Date.now();
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(endpoint.url);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(rawBody),
          'X-HookShield-Signature': signature,
          'X-HookShield-Event': 'hookshield.test_ping',
          'X-HookShield-Delivery': 'test_' + Date.now(),
        },
        timeout: 8000,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode || 0;
          resolve({
            success: statusCode >= 200 && statusCode < 300,
            statusCode,
            durationMs,
            responseBody: data.substring(0, 1000),
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          durationMs: Date.now() - startTime,
          error: 'Connection timed out after 8000ms',
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      });

      req.write(rawBody);
      req.end();
    } catch (err: any) {
      resolve({
        success: false,
        durationMs: Date.now() - startTime,
        error: err.message || 'Failed to dispatch test request',
      });
    }
  });
}

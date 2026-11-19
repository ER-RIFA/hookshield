import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { IDelivery } from './models/Delivery';
import { DeliveryAttempt } from './models/DeliveryAttempt';
import { Event } from './models/Event';
import { Endpoint } from './models/Endpoint';
import { validateDestination } from './destinationValidator';
import { nextRetryAt, isExhausted, shouldRetry, MAX_ATTEMPTS } from './retryPolicy';

const DELIVERY_TIMEOUT_MS = parseInt(process.env.DELIVERY_TIMEOUT_MS || '10000');

function getEncryptionKey(): Buffer {
  const key = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!key) throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY not set');
  return crypto.createHash('sha256').update(key).digest();
}

function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

function buildSignatureHeader(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signingPayload = `${timestamp}.${rawBody}`;
  const sig = crypto.createHmac('sha256', secret).update(signingPayload, 'utf8').digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function sendHTTPRequest(url: string, body: string, headers: Record<string, string>): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
      timeout: DELIVERY_TIMEOUT_MS,
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    // Disable redirects to prevent SSRF via redirect
    const req = protocol.request({ ...options, followRedirects: false } as any, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data.substring(0, 1000) }));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function processDelivery(delivery: IDelivery): Promise<void> {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let errorCategory: string | undefined;
  let success = false;

  try {
    // Load event and endpoint
    const [event, endpoint] = await Promise.all([
      Event.findById(delivery.eventId),
      Endpoint.findById(delivery.endpointId),
    ]);

    if (!event || !endpoint) {
      // Terminal — data is missing
      delivery.status = 'failed';
      delivery.lastError = 'Event or endpoint not found';
      await delivery.save();
      return;
    }

    // Validate destination (SSRF prevention)
    await validateDestination(endpoint.url);

    const secret = decryptSecret(endpoint.encryptedSecret);
    const body = JSON.stringify({
      id: event.eventId,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt,
    });

    const signature = buildSignatureHeader(body, secret);

    const result = await sendHTTPRequest(endpoint.url, body, {
      'X-HookShield-Signature': signature,
      'X-HookShield-Event': event.type,
      'X-HookShield-Delivery': delivery._id.toString(),
    });

    statusCode = result.statusCode;
    responseBody = result.body;
    success = statusCode >= 200 && statusCode < 300;
  } catch (err) {
    const error = err as Error;
    responseBody = error.message;
    if (error.message.includes('timed out')) {
      errorCategory = 'timeout';
    } else if (error.message.includes('SSRF') || error.message.includes('private')) {
      errorCategory = 'ssrf_blocked';
    } else {
      errorCategory = 'network_error';
    }
  }

  const durationMs = Date.now() - startTime;
  const newAttempts = delivery.attempts + 1;

  // Record attempt
  await DeliveryAttempt.create({
    deliveryId: delivery._id,
    attemptNo: newAttempts,
    statusCode,
    durationMs,
    errorCategory,
    responseBody,
    success,
    attemptedAt: new Date(),
  });

  // Update delivery state
  if (success) {
    delivery.status = 'success';
    delivery.lastStatusCode = statusCode;
    delivery.lastDurationMs = durationMs;
    delivery.lastError = undefined;
  } else if (errorCategory === 'ssrf_blocked') {
    // Terminal — never retry SSRF-blocked destinations
    delivery.status = 'failed';
    delivery.lastError = `SSRF blocked: destination is a private/internal address`;
  } else if (!shouldRetry(statusCode, errorCategory ? new Error(errorCategory) : undefined) || isExhausted(newAttempts)) {
    delivery.status = 'failed';
    if (statusCode && statusCode >= 300 && statusCode < 400) {
      delivery.lastError = `SSRF protection: HTTP ${statusCode} redirects are not permitted`;
    } else {
      delivery.lastError = errorCategory || `HTTP ${statusCode}`;
    }
    delivery.lastStatusCode = statusCode;
  } else {
    delivery.status = 'retrying';
    delivery.nextAttemptAt = nextRetryAt(newAttempts);
    delivery.lastError = errorCategory || `HTTP ${statusCode}`;
    delivery.lastStatusCode = statusCode;
  }

  delivery.attempts = newAttempts;
  delivery.leaseUntil = undefined;
  delivery.lastDurationMs = durationMs;
  await delivery.save();

  console.log(`[worker] delivery=${delivery._id} status=${delivery.status} attempt=${newAttempts} statusCode=${statusCode ?? 'none'} duration=${durationMs}ms`);
}

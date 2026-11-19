const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.RECEIVER_PORT || 4000;

// Dynamic state & configuration
let FORCE_STATUS = parseInt(process.env.FORCE_STATUS || '0');  // 0 = auto 200, otherwise force this status code
let DELAY_MS = parseInt(process.env.DELAY_MS || '0');          // artificial delay in ms
let FAIL_COUNT = parseInt(process.env.FAIL_COUNT || '0');       // fail first N requests then succeed
let requestCount = 0;
const MAX_LOGS = 60;
const logs = [];

// Simple CORS middleware for browser control & local dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HookShield-Signature, X-HookShield-Event, X-HookShield-Delivery, X-Webhook-Secret');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Webhook receiver endpoint
app.post('/webhook', async (req, res) => {
  requestCount++;
  const receivedAt = new Date().toISOString();

  if (DELAY_MS > 0) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const signature = req.headers['x-hookshield-signature'];
  const eventType = req.headers['x-hookshield-event'];
  const deliveryId = req.headers['x-hookshield-delivery'];

  // Parse signature components
  let parsedTimestamp = null;
  let parsedSignature = null;
  if (typeof signature === 'string') {
    const parts = signature.split(',');
    parsedTimestamp = parts.find((p) => p.startsWith('t='))?.slice(2) || null;
    parsedSignature = parts.find((p) => p.startsWith('v1='))?.slice(3) || null;
  }

  // Determine status code
  let statusCode = 200;
  let failureReason = null;

  if (FORCE_STATUS !== 0) {
    statusCode = FORCE_STATUS;
    failureReason = `Forced status HTTP ${FORCE_STATUS}`;
  } else if (FAIL_COUNT > 0 && requestCount <= FAIL_COUNT) {
    statusCode = 500;
    failureReason = `Simulated transient failure (${requestCount}/${FAIL_COUNT})`;
  }

  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(7),
    requestNo: requestCount,
    receivedAt,
    eventType: eventType || 'unknown',
    deliveryId: deliveryId || 'none',
    statusCode,
    failureReason,
    signatureHeader: signature || null,
    parsedTimestamp,
    parsedSignature,
    headers: {
      'content-type': req.headers['content-type'],
      'x-hookshield-signature': signature,
      'x-hookshield-event': eventType,
      'x-hookshield-delivery': deliveryId,
    },
    body: req.body,
  };

  logs.unshift(logEntry);
  if (logs.length > MAX_LOGS) logs.pop();

  console.log(`\n📨  [Receiver] Webhook #${requestCount} received: [${statusCode}] event=${eventType} delivery=${deliveryId}`);

  res.status(statusCode).json({
    received: true,
    requestCount,
    statusCode,
    failureReason,
    timestamp: receivedAt,
  });
});

// Signature verification helper endpoint
app.post('/webhook/verify', (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  const signature = req.headers['x-hookshield-signature'];
  if (!secret || !signature) {
    res.status(400).json({ error: 'Missing secret or signature header' });
    return;
  }
  const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
  const parts = (typeof signature === 'string' ? signature : '').split(',');
  const tPart = parts.find((p) => p.startsWith('t='))?.slice(2);
  const v1Part = parts.find((p) => p.startsWith('v1='))?.slice(3);
  if (!tPart || !v1Part) {
    res.status(400).json({ valid: false, error: 'Malformed signature header' });
    return;
  }
  const expectedPayload = `${tPart}.${rawBody}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(expectedPayload, 'utf8').digest('hex');
  const valid = v1Part.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(v1Part, 'hex'), Buffer.from(expectedSig, 'hex'));
  res.json({ valid, timestamp: tPart, expectedSig, receivedSig: v1Part });
});

// Logs endpoint
app.get('/logs', (_req, res) => {
  res.json({ success: true, count: logs.length, totalRequests: requestCount, logs });
});

// Clear logs endpoint
app.delete('/logs', (_req, res) => {
  logs.length = 0;
  res.json({ success: true, message: 'Logs cleared' });
});

// Dynamic configuration endpoint
app.get('/config', (_req, res) => {
  res.json({
    success: true,
    config: {
      forceStatus: FORCE_STATUS,
      delayMs: DELAY_MS,
      failCount: FAIL_COUNT,
      requestCount,
    },
  });
});

app.post('/config', (req, res) => {
  const { forceStatus, delayMs, failCount, resetCount } = req.body || {};
  if (forceStatus !== undefined) FORCE_STATUS = parseInt(forceStatus, 10);
  if (delayMs !== undefined) DELAY_MS = parseInt(delayMs, 10);
  if (failCount !== undefined) FAIL_COUNT = parseInt(failCount, 10);
  if (resetCount) requestCount = 0;

  console.log(`⚙️  [Receiver] Config updated: FORCE_STATUS=${FORCE_STATUS}, DELAY_MS=${DELAY_MS}, FAIL_COUNT=${FAIL_COUNT}, requestCount=${requestCount}`);
  res.json({
    success: true,
    config: {
      forceStatus: FORCE_STATUS,
      delayMs: DELAY_MS,
      failCount: FAIL_COUNT,
      requestCount,
    },
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'HookShield Receiver Demo',
    port: PORT,
    requestCount,
    config: { FORCE_STATUS, DELAY_MS, FAIL_COUNT },
  });
});

app.listen(PORT, () => {
  console.log(`🎯  HookShield Receiver Demo running on http://localhost:${PORT}`);
  console.log(`   Config: FORCE_STATUS=${FORCE_STATUS}, DELAY_MS=${DELAY_MS}, FAIL_COUNT=${FAIL_COUNT}`);
  console.log(`   POST to http://localhost:${PORT}/webhook`);
});

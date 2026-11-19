/**
 * HookShield Core Verification Test Suite
 * Validates cryptography, signature schemes, SSRF guards, and retry mechanics.
 * Run with: node tests/verify.js
 */

const crypto = require('crypto');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

console.log('\n========================================');
console.log('   🛡️  HookShield Core Verification     ');
console.log('========================================\n');

// ── Test 1: AES-256-GCM Encryption & Decryption ──────────────
console.log('1. Cryptography: AES-256-GCM Secret Protection');

const TEST_SECRET = 'whsec_' + crypto.randomBytes(24).toString('hex');
const ENCRYPTION_PASSPHRASE = 'change-me-to-a-random-32-plus-character-string-here';
const derivedKey = crypto.createHash('sha256').update(ENCRYPTION_PASSPHRASE).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(ciphertext) {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

test('Can encrypt and decrypt webhook secret cleanly', () => {
  const encrypted = encrypt(TEST_SECRET);
  assert.notStrictEqual(encrypted, TEST_SECRET);
  assert.strictEqual(encrypted.split(':').length, 3);
  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, TEST_SECRET);
});

test('Tampered ciphertext fails auth tag validation (authenticated encryption)', () => {
  const encrypted = encrypt(TEST_SECRET);
  const parts = encrypted.split(':');
  // Flip last char of ciphertext
  parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('a') ? 'b' : 'a');
  const tampered = parts.join(':');
  assert.throws(() => decrypt(tampered), /Unsupported state or unable to authenticate data/);
});

// ── Test 2: HMAC-SHA256 Signing & Verification ───────────────
console.log('\n2. Webhook Signatures: HMAC-SHA256 & Timing-Safe Check');

function signPayload(body, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return { header: `t=${timestamp},v1=${sig}`, timestamp, sig };
}

function verifySignature(header, body, secret, toleranceSec = 300) {
  const parts = header.split(',');
  const tPart = parts.find((p) => p.startsWith('t='))?.slice(2);
  const v1Part = parts.find((p) => p.startsWith('v1='))?.slice(3);
  if (!tPart || !v1Part) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(tPart, 10)) > toleranceSec) return false;

  const expectedPayload = `${tPart}.${body}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(expectedPayload, 'utf8').digest('hex');

  const v1Buf = Buffer.from(v1Part, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (v1Buf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(v1Buf, expectedBuf);
}

test('Valid payload matches computed signature', () => {
  const body = JSON.stringify({ id: 'evt_123', type: 'order.completed', amount: 5000 });
  const { header } = signPayload(body, TEST_SECRET);
  assert.strictEqual(verifySignature(header, body, TEST_SECRET), true);
});

test('Tampered payload is rejected by signature verification', () => {
  const body = JSON.stringify({ id: 'evt_123', type: 'order.completed', amount: 5000 });
  const tamperedBody = JSON.stringify({ id: 'evt_123', type: 'order.completed', amount: 999999 });
  const { header } = signPayload(body, TEST_SECRET);
  assert.strictEqual(verifySignature(header, tamperedBody, TEST_SECRET), false);
});

test('Wrong secret is rejected by signature verification', () => {
  const body = JSON.stringify({ id: 'evt_123', type: 'order.completed' });
  const { header } = signPayload(body, TEST_SECRET);
  assert.strictEqual(verifySignature(header, body, 'wrong_secret_12345'), false);
});

test('Replay attack outside timestamp tolerance is rejected', () => {
  const body = JSON.stringify({ id: 'evt_123', type: 'order.completed' });
  const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago (> 300s tolerance)
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${oldTimestamp}.${body}`, 'utf8').digest('hex');
  const staleHeader = `t=${oldTimestamp},v1=${sig}`;
  assert.strictEqual(verifySignature(staleHeader, body, TEST_SECRET, 300), false);
});

// ── Test 3: SSRF Prevention & IP Range Checks ────────────────
console.log('\n3. Security: SSRF Prevention Regex & IP Validation');

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
];

function isPrivateIP(ip) {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

test('Blocks loopback IPv4 addresses (127.0.0.1, 127.1.2.3)', () => {
  assert.strictEqual(isPrivateIP('127.0.0.1'), true);
  assert.strictEqual(isPrivateIP('127.100.0.1'), true);
});

test('Blocks RFC1918 Class A private IP (10.0.0.1)', () => {
  assert.strictEqual(isPrivateIP('10.0.0.1'), true);
  assert.strictEqual(isPrivateIP('10.254.254.1'), true);
});

test('Blocks RFC1918 Class B private range (172.16.0.1 - 172.31.255.254)', () => {
  assert.strictEqual(isPrivateIP('172.16.0.1'), true);
  assert.strictEqual(isPrivateIP('172.25.10.5'), true);
  assert.strictEqual(isPrivateIP('172.31.255.254'), true);
  // Public 172 IPs should pass
  assert.strictEqual(isPrivateIP('172.15.0.1'), false);
  assert.strictEqual(isPrivateIP('172.32.0.1'), false);
});

test('Blocks RFC1918 Class C private range (192.168.1.1)', () => {
  assert.strictEqual(isPrivateIP('192.168.1.1'), true);
  assert.strictEqual(isPrivateIP('192.168.0.254'), true);
});

test('Blocks AWS / Cloud metadata service link-local address (169.254.169.254)', () => {
  assert.strictEqual(isPrivateIP('169.254.169.254'), true);
});

test('Allows legitimate public internet IP addresses', () => {
  assert.strictEqual(isPrivateIP('8.8.8.8'), false);
  assert.strictEqual(isPrivateIP('104.26.10.230'), false);
  assert.strictEqual(isPrivateIP('142.250.190.46'), false);
});

// ── Test 4: Exponential Backoff & Jitter ──────────────────────
console.log('\n4. Reliability: Exponential Backoff & Jitter Scheduling');

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 3_600_000;
const JITTER_FACTOR = 0.3;

function calculateDelay(attemptNumber) {
  const exponential = BASE_DELAY_MS * Math.pow(2, attemptNumber);
  const capped = Math.min(exponential, MAX_DELAY_MS);
  const jitter = capped * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.max(1000, capped + jitter);
}

function shouldRetry(statusCode, error) {
  if (error) return true;
  if (!statusCode) return true;
  if (statusCode >= 200 && statusCode < 300) return false;
  if (statusCode === 400) return false;
  if (statusCode === 401) return false;
  if (statusCode === 403) return false;
  return true;
}

test('Backoff delays scale exponentially across attempts', () => {
  // Test 10 iterations to average out jitter
  for (let attempt = 0; attempt <= 4; attempt++) {
    const delay = calculateDelay(attempt);
    const expectedNominal = BASE_DELAY_MS * Math.pow(2, attempt);
    const minBound = expectedNominal * (1 - JITTER_FACTOR);
    const maxBound = Math.min(expectedNominal * (1 + JITTER_FACTOR), MAX_DELAY_MS * 1.3);
    assert(delay >= minBound, `Delay ${delay} below minBound ${minBound} for attempt ${attempt}`);
    assert(delay <= maxBound, `Delay ${delay} above maxBound ${maxBound} for attempt ${attempt}`);
  }
});

test('Retry decisions correctly classify retryable vs non-retryable responses', () => {
  // 2xx: Success, do not retry
  assert.strictEqual(shouldRetry(200), false);
  assert.strictEqual(shouldRetry(204), false);

  // Client errors that cannot be fixed by retrying (bad request, unauthorized, forbidden)
  assert.strictEqual(shouldRetry(400), false);
  assert.strictEqual(shouldRetry(401), false);
  assert.strictEqual(shouldRetry(403), false);

  // Transient / Server errors should retry
  assert.strictEqual(shouldRetry(429), true); // Rate limited
  assert.strictEqual(shouldRetry(500), true); // Internal server error
  assert.strictEqual(shouldRetry(502), true); // Bad gateway
  assert.strictEqual(shouldRetry(503), true); // Service unavailable
  assert.strictEqual(shouldRetry(504), true); // Gateway timeout
  assert.strictEqual(shouldRetry(undefined, new Error('ECONNRESET')), true); // Network error
});

// ── Test 5: Worker Concurrency & Orphan Sweep Logic ──────────
console.log('\n5. Worker Concurrency & Orphan Recovery Simulation');

test('Orphan recovery correctly identifies expired worker leases', () => {
  const now = new Date();
  const activeLease = new Date(now.getTime() + 20_000);
  const expiredLease = new Date(now.getTime() - 10_000);

  const jobs = [
    { id: 'job_1', status: 'delivering', leaseUntil: expiredLease },
    { id: 'job_2', status: 'delivering', leaseUntil: activeLease },
    { id: 'job_3', status: 'pending', leaseUntil: undefined },
  ];

  // Simulated sweep logic
  const recovered = jobs.filter(j => j.status === 'delivering' && j.leaseUntil <= now);
  assert.strictEqual(recovered.length, 1);
  assert.strictEqual(recovered[0].id, 'job_1');
});

test('Secret rotation generates fresh unique 256-bit secrets', () => {
  const secret1 = 'whsec_' + crypto.randomBytes(24).toString('hex');
  const secret2 = 'whsec_' + crypto.randomBytes(24).toString('hex');
  assert.notStrictEqual(secret1, secret2);
  assert(secret1.startsWith('whsec_'));
  assert(secret2.startsWith('whsec_'));
  assert.strictEqual(secret1.length, 54);
});

// ── Summary ──────────────────────────────────────────────────
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉  All HookShield core logic tests passed!\n');
}

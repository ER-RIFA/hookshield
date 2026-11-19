# HookShield System Architecture

HookShield is an enterprise-grade, high-throughput Webhook Reliability Platform engineered for at-least-once delivery, cryptographic authenticity verification, defense-in-depth SSRF protection, worker leasing with orphan recovery, and zero-loss exponential retry backoff.

---

## 1. High-Level Architecture

```mermaid
flowchart TD
    subgraph Clients["Clients & Producers"]
        P[Event Producer / API Client]
        UI[HookShield Web Dashboard - React 19]
    end

    subgraph API["Ingress Layer (Express API - Port 5000)"]
        RT[Rate Limiter & Security Headers]
        Auth[Multi-Tenant Auth Context Middleware]
        EController[Endpoints & Events API]
        DController[Deliveries API]
    end

    subgraph Storage["Persistence Layer (MongoDB 7.0 / Atlas)"]
        M_Events[(Events Collection)]
        M_Idempotency[(IdempotencyKeys - Unique 24h TTL)]
        M_Endpoints[(Endpoints Collection - AES-256 Encrypted Secrets)]
        M_Deliveries[(Deliveries Queue - Compound Indexed)]
        M_Attempts[(Delivery Attempts Audit Trail with Response Body)]
    end

    subgraph Engine["Execution Layer (HookShield Worker)"]
        Sweeper[Orphan / Zombie Sweeper - Lease Recovery]
        Scheduler[Poller / Job Claimer - Atomic findOneAndUpdate]
        SSRF[SSRF DNS & IP Validator]
        Signer[HMAC-SHA256 Signer]
        HTTPClient[Bounded HTTP Client - 10s Timeout, No Redirects]
        Backoff[Exponential Backoff + Jitter Engine]
    end

    subgraph Receivers["Destination Webhook Endpoints"]
        R1[Consumer Webhook Server]
        R2[Receiver Demo - Port 4000]
    end

    P -->|POST /api/events| RT
    UI -->|Admin & Mission Control| RT
    RT --> Auth
    Auth --> EController
    Auth --> DController
    EController -->|Atomic Pre-reservation| M_Idempotency
    EController -->|Persist Event| M_Events
    EController -->|Fan-out delivery records| M_Deliveries
    DController -->|Fetch Stats & Details| M_Deliveries

    Sweeper -->|Reset expired delivering leases| M_Deliveries
    Scheduler -->|Atomic Job Claim status: delivering, leaseUntil| M_Deliveries
    Scheduler --> SSRF
    SSRF -->|DNS Resolution & Private IP Guard| HTTPClient
    Signer -->|Compute t=...,v1=...| HTTPClient
    HTTPClient -->|POST with X-HookShield-Signature| Receivers
    HTTPClient -->|Response or Error| Backoff
    Backoff -->|Record attempt with responseBody| M_Attempts
    Backoff -->|Update status, nextAttemptAt or failed| M_Deliveries
```

---

## 2. End-to-End Delivery Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Event Producer
    participant API as HookShield API
    participant DB as MongoDB
    participant Worker as HookShield Worker
    participant Dest as Destination Server

    Client->>API: POST /api/events (type, payload, idempotencyKey)
    alt Has idempotencyKey
        API->>DB: Atomic insert into IdempotencyKeys (unique index)
        alt Duplicate Key Detected (E11000)
            API->>DB: Fetch existing Event
            API-->>Client: 200 OK (duplicate: true, existing event)
        else First Seen Key
            API->>DB: Save Event document
            API->>DB: Match active Endpoints subscribed to event type
            API->>DB: Bulk insert Delivery records (status: "pending", nextAttemptAt: now)
            API-->>Client: 201 Created (deliveriesCreated: N)
        end
    else No Idempotency Key
        API->>DB: Save Event document & fan-out Deliveries
        API-->>Client: 201 Created
    end

    loop Every 5000ms (configurable)
        Worker->>DB: recoverOrphanJobs(): deliveries with status='delivering' and leaseUntil <= now -> status='retrying'
        Worker->>DB: findOneAndUpdate({ status in [pending, retrying], nextAttemptAt <= now }) -> status = 'delivering', leaseUntil = now + 30s
        alt Job Claimed
            Worker->>Worker: Validate destination URL (SSRF & DNS checks)
            Worker->>Worker: Decrypt endpoint secret (AES-256-GCM)
            Worker->>Worker: Compute signature: HMAC-SHA256(timestamp + "." + body, secret)
            Worker->>Dest: POST webhook with X-HookShield-* headers (timeout: 10s, followRedirects: false)
            alt HTTP 2xx
                Worker->>DB: DeliveryAttempt(success=true, responseBody), Delivery(status="success")
            else HTTP 3xx (Redirect)
                Worker->>DB: DeliveryAttempt(success=false), Delivery(status="failed", lastError="SSRF redirect rejected")
            else HTTP 4xx (Non-retryable 400, 401, 403, 404, 410, 422)
                Worker->>DB: DeliveryAttempt(success=false), Delivery(status="failed", lastError)
            else HTTP 5xx / 429 / Timeout / Network Error
                alt attempts < MAX_ATTEMPTS (5)
                    Worker->>Worker: Calculate nextAttemptAt = now + base * 2^attempt + jitter
                    Worker->>DB: DeliveryAttempt(success=false), Delivery(status="retrying", nextAttemptAt)
                else attempts >= MAX_ATTEMPTS
                    Worker->>DB: DeliveryAttempt(success=false), Delivery(status="failed", lastError="Max retries exhausted")
                end
            end
        end
    end
```

---

## 3. Cryptographic Security Architecture

### 3.1 Secret Storage (Envelope Encryption)
- Webhook signing secrets are encrypted at rest using **AES-256-GCM**.
- Key derivation: `SHA-256(WEBHOOK_SECRET_ENCRYPTION_KEY)` produces a 256-bit symmetric key.
- A fresh, cryptographically secure 16-byte IV is generated per endpoint.
- Ciphertext format stored in database:
  $$\text{iv}_{\text{hex}} : \text{authTag}_{\text{hex}} : \text{data}_{\text{hex}}$$
- Any bit modification to the ciphertext or IV triggers authentication failure via the GCM auth tag before decryption can execute.

### 3.2 Request Signing Protocol
Every outgoing HTTP POST request includes:
1. `X-HookShield-Signature`: `t={unix_timestamp},v1={hmac_sha256_hex}`
2. `X-HookShield-Event`: event type string (e.g. `order.created`)
3. `X-HookShield-Delivery`: unique delivery job ID

**Signature Calculation:**
$$\text{payload} = \text{timestamp} \mathbin{\Vert} \text{"."} \mathbin{\Vert} \text{rawRequestBody}$$
$$\text{signature} = \text{HMAC-SHA256}(\text{payload}, \text{secret})$$

**Verification Protocol (Receiver Side):**
1. Extract `t` and `v1` from header.
2. Validate timestamp against drift: $| \text{currentTime} - t | \le 300\text{ seconds}$ (mitigates replay attacks).
3. Compute expected HMAC-SHA256 over `${t}.${rawBody}`.
4. Compare hashes using **constant-time equality** (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

---

## 4. SSRF Defense-in-Depth Architecture

To prevent Server-Side Request Forgery attacks where a malicious user supplies an internal address (such as cloud metadata `169.254.169.254` or internal microservices `10.0.0.1`):

1. **Protocol Whitelist**: Only `http:` and `https:` schemes allowed.
2. **Loopback & Hostname Filtering**: `localhost`, `127.0.0.1`, `::1` blocked in production.
3. **DNS Resolution Verification**: Both IPv4 (`dns.resolve4`) and IPv6 (`dns.resolve6`) are resolved prior to dispatch.
4. **IP Range Blacklisting**:
   - Loopback: `127.0.0.0/8`, `::1`
   - Private RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Cloud Metadata / Link-Local: `169.254.0.0/16`, `fe80::/10`
   - CGNAT: `100.64.0.0/10`
   - Reserved: `0.0.0.0/8`, `fc00::/7`
5. **No Automatic Redirects**: HTTP redirects (3xx) are rejected as terminal failures rather than being followed, closing redirect-based SSRF bypass vulnerabilities.
6. **Double Validation**: URLs are validated both at endpoint creation/update time (fail-fast API feedback) and immediately before worker HTTP dispatch (protection against DNS rebinding).

---

## 5. Retry Policy & Concurrency Control

### 5.1 Exponential Backoff with Jitter
To avoid the **thundering herd problem** where hundreds of retrying webhooks hammer a recovering recipient simultaneously, HookShield uses full jitter:

$$T_{\text{nominal}} = \min(B \times 2^{\text{attempt}}, T_{\max})$$
$$\text{delay} = T_{\text{nominal}} \times (1 \pm J)$$

Where:
- $B = 30,000\text{ ms}$ (30 seconds base delay)
- $T_{\max} = 3,600,000\text{ ms}$ (1 hour cap)
- $J = 0.3$ (30% random jitter)
- $\text{Max Attempts} = 5$

### 5.2 Concurrency & Worker Atomic Claims
- Workers poll `deliveries` using MongoDB `findOneAndUpdate` with atomic state transitions:
  - Match: `{ status: { $in: ['pending', 'retrying'] }, nextAttemptAt: { $lte: new Date() } }`
  - Update: `{ $set: { status: 'delivering', leaseUntil: new Date(now + 30000) } }`
- This ensures **zero duplicate worker claims** even when running 50+ concurrent worker instances without external locking services like Redis Redlock.
- An automated sweeper recovers abandoned jobs where `leaseUntil` has elapsed, preventing permanently hung delivery pipelines.

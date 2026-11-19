# HookShield — System Design & Engineering Interview Defense Guide

This document prepares you to defend every engineering trade-off, architectural pattern, failure mode, and scalability decision in **HookShield** during high-level system design and technical interviews.

---

## 1. Core Architecture & Philosophy

### Q1: "Why build a dedicated webhook reliability platform instead of sending HTTP requests directly from the main application?"
**Defense:**
- **Decoupling Failure Domains**: If a third-party webhook destination is slow, down, or experiencing network partitions, synchronous HTTP calls in the primary service tie up worker threads, exhaust connection pools, and degrade customer-facing transaction latencies.
- **Resilience & Durability**: A dedicated reliability platform guarantees persistence before dispatch. If our API server restarts or crashes, zero webhook payloads are lost because the event and delivery intent are already safely committed to disk.
- **Unified Observability & Compliance**: Centralized delivery histories, audit trails of every attempt, latency measurements, and payload signatures provide auditability, debugging tools for customers, and SLA monitoring across all microservices.

---

## 2. Delivery Guarantees & Concurrency

### Q2: "What delivery guarantee does HookShield provide: at-most-once, at-least-once, or exactly-once?"
**Defense:**
- In distributed systems communicating over untrusted networks (HTTP), **strictly exactly-once delivery is impossible** according to the Two Generals' Problem.
- HookShield provides **At-Least-Once Delivery**:
  - Every event is persisted.
  - Failures are retried up to 5 times with exponential backoff and jitter.
  - Deliveries are only marked `success` after the destination returns a valid HTTP `2xx` status code.
- To achieve effective end-to-end idempotency, we provide:
  - **Producer Idempotency**: Producers supply an `idempotencyKey` on `POST /api/v1/events`. If a duplicate key is presented within the retention window, HookShield returns HTTP 200 with the existing event record instead of creating duplicate deliveries.
  - **Consumer Idempotency**: Each outgoing webhook includes an immutable `id` in the JSON body and an `X-HookShield-Delivery` header so receivers can deduplicate at their end.

### Q3: "How do you prevent race conditions when multiple worker instances run simultaneously?"
**Defense:**
- We leverage MongoDB's atomic document-level operation `findOneAndUpdate`.
- The worker executes:
  ```typescript
  const job = await Delivery.findOneAndUpdate(
    {
      status: { $in: ['pending', 'retrying'] },
      nextRetryAt: { $lte: new Date() }
    },
    { $set: { status: 'delivering' } },
    { sort: { nextRetryAt: 1 }, new: true }
  );
  ```
- Because MongoDB applies atomic document locks during `findOneAndUpdate`, only **one worker** can transition a given delivery from `pending` or `retrying` to `delivering`. No two workers can ever claim the same job simultaneously, eliminating the need for complex distributed locking mechanisms like Redis Redlock or ZooKeeper.

### Q4: "What happens if a worker crashes or gets killed mid-delivery (e.g., OOM or pod restart)?"
**Defense:**
- If a worker dies while a job is in the `delivering` state, that job would ordinarily remain stuck.
- **Orphan Job Recovery**: HookShield implements an automatic zombie/orphan job sweeper:
  - Any delivery in state `delivering` whose `updatedAt` is older than `DELIVERY_TIMEOUT_MS * 2` (e.g., > 20 seconds) is treated as abandoned.
  - The scheduler resets its state back to `retrying` with an immediate `nextRetryAt: new Date()`, allowing healthy workers to re-claim and complete the dispatch.

---

## 3. Cryptography & Security

### Q5: "How does the webhook signing scheme work and why is timestamp concatenation necessary?"
**Defense:**
- **The Protocol**: We use HMAC-SHA256 with the shared endpoint secret over a canonical payload:
  $$\text{Payload} = \text{timestamp} + \text{"."} + \text{rawJsonBody}$$
  $$\text{Header} = \text{"t="} + \text{timestamp} + \text{",v1="} + \text{HMAC-SHA256}(\text{Payload}, \text{Secret})$$
- **Why include the timestamp?**:
  1. **Replay Attack Mitigation**: An eavesdropper intercepting a valid signed webhook cannot replay it later against the customer’s server because the receiver verifies that $| \text{currentTime} - t | \le 300\text{ seconds}$.
  2. **Body Tamper-Proofing**: Any mutation to the JSON body (e.g. changing an order amount from \$10 to \$1000) invalidates the HMAC.
  3. **Timing Attack Immunity**: On the receiver side, signatures are evaluated using `crypto.timingSafeEqual` to prevent attackers from inferring valid signature bytes through millisecond-level execution variance.

### Q6: "Why AES-256-GCM for storing endpoint secrets rather than hashing or AES-CBC?"
**Defense:**
- **Reversible vs Irreversible**: We cannot use one-way hashing (like bcrypt or argon2) because the worker *must* retrieve the plain-text secret to compute outgoing HMAC signatures.
- **Why GCM over CBC**:
  - AES-CBC requires a separate HMAC integrity check (Encrypt-then-MAC) to prevent padding oracle attacks.
  - AES-256-GCM is an **Authenticated Encryption with Associated Data (AEAD)** cipher. It produces a 128-bit authentication tag simultaneously with ciphertext.
  - If any byte of the ciphertext or IV is tampered with in the database, decryption immediately throws an authentication error before any plain text is emitted.

### Q7: "How does HookShield prevent SSRF (Server-Side Request Forgery) attacks?"
**Defense:**
- Without SSRF protection, an attacker could register `http://169.254.169.254/latest/meta-data/` or `http://10.0.0.1:9090` to dump cloud credentials or access internal VPC services.
- **Multi-layered defense**:
  1. Scheme whitelist: strictly `http:` and `https:`.
  2. Hostname blocklist: `localhost`, `127.0.0.1`, `::1`.
  3. **Pre-flight DNS Resolution**: We resolve both IPv4 (`A` records) and IPv6 (`AAAA` records).
  4. **IP Range Filtering**: Resolved addresses are validated against private, loopback, CGNAT, link-local, and cloud metadata subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `fc00::/7`).
  5. **Fail-Closed**: If DNS resolution fails, the job fails closed rather than proceeding.

---

## 4. Backoff, Jitter & Reliability

### Q8: "Why add jitter to exponential backoff? What is the 'Thundering Herd' problem?"
**Defense:**
- When an external API experiences a temporary outage (e.g., 2 minutes of downtime), all webhooks dispatched during that window will fail simultaneously.
- If exponential backoff is purely deterministic ($30s, 60s, 120s$), all failed webhooks will fire again at the exact same millisecond. This burst of traffic overwhelms the recovering server, knocking it offline again.
- By adding **30% random jitter** ($T_{\text{delay}} = T_{\text{nominal}} \pm 30\%$), retry requests are smoothed out across a bell-shaped window, allowing the destination to recover gracefully.

### Q9: "Which HTTP status codes trigger retries, and which do not?"
**Defense:**
- **Success (No retry)**: HTTP `200`-`299`.
- **Permanent Client Failure (No retry)**:
  - `400 Bad Request`: Payload violates receiver schema. Retrying identical payload will never succeed.
  - `401 Unauthorized` / `403 Forbidden`: Secret revoked or invalid permissions.
- **Transient Failures (Retry)**:
  - `429 Too Many Requests`: Destination rate-limited HookShield; back off and retry later.
  - `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`.
  - Network timeouts (e.g., connection reset, DNS lookup timeout, TCP socket hangup).

---

## 5. Scalability & Evolution

### Q10: "How would you scale HookShield from 10,000 to 50,000,000 webhooks per day?"
**Defense:**
1. **Queue Architecture**:
   - At 10k/day, MongoDB `findOneAndUpdate` with a compound index `{ status: 1, nextRetryAt: 1 }` is performant, durable, and simple to operate.
   - At 50M/day (~600 webhooks/sec sustained, 5,000/sec peak), transition the queueing layer to **Redis Streams** or **Apache Kafka**:
     - Fast Ingress: API writes event to a partitioned Kafka topic (`events.incoming`).
     - Fan-Out Engine: Consumer group consumes events, checks subscriber endpoints, and places delivery jobs onto delay queues.
     - Delayed Execution: Use Redis sorted sets (`ZADD` with timestamp as score) or RabbitMQ dead-letter exchanges for delayed retries.
2. **Worker Scaling**:
   - Containerize workers with Kubernetes Horizontal Pod Autoscaler (HPA) scaling on queue depth (e.g. KEDA on pending deliveries).
3. **Database Sharding**:
   - Shard the `deliveries` collection on `{ ownerId: "hashed", createdAt: 1 }` to distribute write I/O across replica sets.
   - Implement cold storage archiving: Move successful deliveries older than 30 days to S3/Parquet with AWS Athena for historical queries.

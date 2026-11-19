import dns from 'dns';
import { URL } from 'url';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

// Private/reserved IP ranges (SSRF prevention)
const PRIVATE_RANGES = [
  /^127\./,                                    // Loopback
  /^10\./,                                     // Private class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./,            // Private class B
  /^192\.168\./,                               // Private class C
  /^169\.254\./,                               // Link-local
  /^::1$/,                                     // IPv6 loopback
  /^fc00:/i,                                   // IPv6 ULA
  /^fe80:/i,                                   // IPv6 link-local
  /^0\./,                                      // Reserved
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,  // CGNAT
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

export async function validateDestination(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // Block localhost directly
  if (['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase())) {
    // In development only allow localhost for receiver-demo
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Destination is a loopback address: ${hostname}`);
    }
    return; // Allow in development
  }

  // Resolve DNS and check all resolved IPs
  try {
    const [ipv4s, ipv6s] = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
    ]);
    const allIPs: string[] = [
      ...(ipv4s.status === 'fulfilled' ? ipv4s.value : []),
      ...(ipv6s.status === 'fulfilled' ? ipv6s.value : []),
    ];

    if (allIPs.length === 0) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }

    for (const ip of allIPs) {
      if (isPrivateIP(ip)) {
        throw new Error(`Destination resolves to a private address (SSRF prevention): ${ip}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('SSRF')) throw err;
    if (err instanceof Error && err.message.includes('resolve')) throw err;
    // DNS resolution failure — allow? No — fail safe.
    if ((err as NodeJS.ErrnoException).code === 'ENOTFOUND') {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }
    throw err;
  }
}

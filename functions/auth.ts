import type { Env } from "./types";

// Admin authentication via Cloudflare Access.
//
// The admin area (`/admin`) and the admin-only API (DELETE /api/entries/:id)
// sit behind a Cloudflare Access application. Access authenticates the user at
// the edge (email one-time-PIN) and forwards a signed JWT identifying them. We
// verify that JWT here so the endpoint is safe even if hit directly, not only
// because the edge gated the path.
//
// The list of who is an admin lives in the Access policy (an email allowlist),
// not in this code — adding/removing an admin is an Access policy edit, no
// deploy. All this module decides is "is this request a verified admin?".

const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";
const ACCESS_COOKIE = "CF_Authorization";

export interface Admin {
  /** The authenticated admin's email (from the Access JWT `email` claim). */
  email: string;
}

/**
 * Resolve the admin identity for a request, or null if it is not an
 * authenticated admin. Fails closed: any missing/invalid token or
 * misconfiguration yields null rather than throwing.
 */
export async function getAdmin(
  request: Request,
  env: Env
): Promise<Admin | null> {
  // Local-development bypass. Only ever set in a gitignored .dev.vars, never in
  // production, so it cannot weaken the deployed site. Lets the admin UI be
  // exercised under `wrangler pages dev`, where the Access edge is absent.
  if (env.ACCESS_DEV_BYPASS) {
    return { email: env.ACCESS_DEV_BYPASS };
  }

  const token = accessToken(request);
  if (!token) return null;

  // Without the team domain / AUD we cannot verify a token: fail closed.
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  const claims = await verifyAccessJwt(token, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    aud: env.ACCESS_AUD,
  });
  if (!claims || typeof claims.email !== "string" || claims.email === "") {
    return null;
  }
  return { email: claims.email };
}

/** Pull the Access JWT from the request header, falling back to the cookie. */
function accessToken(request: Request): string | null {
  const header = request.headers.get(ACCESS_HEADER);
  if (header) return header;

  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ACCESS_COOKIE) return rest.join("=") || null;
  }
  return null;
}

interface AccessClaims {
  email?: string;
  sub?: string;
  [claim: string]: unknown;
}

interface VerifyOptions {
  teamDomain: string;
  aud: string;
  /** Override the current time (ms) — for tests. Defaults to Date.now(). */
  now?: number;
}

/**
 * Verify a Cloudflare Access JWT and return its claims, or null if it is
 * invalid (bad signature, wrong audience/issuer, expired, malformed). The
 * signing keys are fetched from the team's JWKS endpoint and matched by `kid`.
 */
export async function verifyAccessJwt(
  token: string,
  opts: VerifyOptions
): Promise<AccessClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(decodeSegment(headerB64)) as {
      alg?: string;
      kid?: string;
    };
    // We only accept RS256, the algorithm Cloudflare Access signs with.
    if (header.alg !== "RS256" || !header.kid) return null;

    const jwk = await fetchSigningKey(opts.teamDomain, header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToBytes(signatureB64);
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      signed
    );
    if (!ok) return null;

    const claims = JSON.parse(decodeSegment(payloadB64)) as AccessClaims & {
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
    };

    // Audience: the token must be issued for this application's AUD tag.
    const auds = Array.isArray(claims.aud)
      ? claims.aud
      : claims.aud
        ? [claims.aud]
        : [];
    if (!auds.includes(opts.aud)) return null;

    // Issuer: must be this team's Access domain.
    if (claims.iss !== `https://${opts.teamDomain}`) return null;

    // Expiry / not-before (seconds since epoch), with a small clock skew.
    const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
    const skew = 60;
    if (typeof claims.exp !== "number" || claims.exp + skew < nowSec) {
      return null;
    }
    if (typeof claims.nbf === "number" && claims.nbf - skew > nowSec) {
      return null;
    }

    return claims;
  } catch {
    // Network failure, malformed JSON/base64, key import error — fail closed.
    return null;
  }
}

/** Fetch the JWK matching `kid` from the team's Access JWKS endpoint. */
async function fetchSigningKey(
  teamDomain: string,
  kid: string
): Promise<JsonWebKey | null> {
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) return null;
  const jwks = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  return jwks.keys?.find((k) => k.kid === kid) ?? null;
}

/** Decode a base64url JWT segment to its UTF-8 string. */
function decodeSegment(segment: string): string {
  return new TextDecoder().decode(base64UrlToBytes(segment));
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

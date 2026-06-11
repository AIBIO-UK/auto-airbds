// Runs under Node (not jsdom) so WebCrypto's `crypto.subtle` is reliably
// available for signing/verifying the test JWTs.
// @vitest-environment node
import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { getAdmin, verifyAccessJwt } from "./auth";
import type { Env } from "./types";

const TEAM_DOMAIN = "team.cloudflareaccess.com";
const AUD = "test-application-aud-tag";
const ISS = `https://${TEAM_DOMAIN}`;
const KID = "test-key-1";

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid?: string };

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
  privateKey = pair.privateKey;
  publicJwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: KID };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Make the JWKS endpoint return our test key (plus, optionally, others).
function stubJwks(keys: JsonWebKey[] = [publicJwk]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      if (String(url) === `https://${TEAM_DOMAIN}/cdn-cgi/access/certs`) {
        return new Response(JSON.stringify({ keys }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    })
  );
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSegment(obj: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

function defaultClaims(over: Record<string, unknown> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    aud: AUD,
    iss: ISS,
    email: "admin@example.com",
    sub: "user-1",
    iat: nowSec,
    exp: nowSec + 3600,
    ...over,
  };
}

async function makeJwt(
  claims: Record<string, unknown> = defaultClaims(),
  header: Record<string, unknown> = { alg: "RS256", kid: KID }
): Promise<string> {
  const signingInput = `${encodeSegment(header)}.${encodeSegment(claims)}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64Url(new Uint8Array(sig))}`;
}

const opts = { teamDomain: TEAM_DOMAIN, aud: AUD };

describe("verifyAccessJwt", () => {
  it("accepts a valid token and returns its claims", async () => {
    stubJwks();
    const claims = await verifyAccessJwt(await makeJwt(), opts);
    expect(claims?.email).toBe("admin@example.com");
  });

  it("rejects an expired token", async () => {
    stubJwks();
    const nowSec = Math.floor(Date.now() / 1000);
    const token = await makeJwt(defaultClaims({ exp: nowSec - 3600 }));
    expect(await verifyAccessJwt(token, opts)).toBeNull();
  });

  it("rejects a token for the wrong audience", async () => {
    stubJwks();
    const token = await makeJwt(defaultClaims({ aud: "some-other-app" }));
    expect(await verifyAccessJwt(token, opts)).toBeNull();
  });

  it("rejects a token from the wrong issuer", async () => {
    stubJwks();
    const token = await makeJwt(defaultClaims({ iss: "https://evil.example" }));
    expect(await verifyAccessJwt(token, opts)).toBeNull();
  });

  it("rejects a token whose payload was tampered with after signing", async () => {
    stubJwks();
    const token = await makeJwt();
    const [h, , s] = token.split(".");
    const forged = encodeSegment(defaultClaims({ email: "attacker@example.com" }));
    expect(await verifyAccessJwt(`${h}.${forged}.${s}`, opts)).toBeNull();
  });

  it("rejects a token signed with an unknown key id", async () => {
    stubJwks([{ ...publicJwk, kid: "different-kid" }]);
    expect(await verifyAccessJwt(await makeJwt(), opts)).toBeNull();
  });

  it("rejects a non-RS256 token", async () => {
    stubJwks();
    const token = await makeJwt(defaultClaims(), { alg: "HS256", kid: KID });
    expect(await verifyAccessJwt(token, opts)).toBeNull();
  });

  it("rejects a malformed token", async () => {
    stubJwks();
    expect(await verifyAccessJwt("not-a-jwt", opts)).toBeNull();
  });
});

describe("getAdmin", () => {
  const baseEnv: Env = {
    DB: {} as Env["DB"],
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    ACCESS_AUD: AUD,
  };

  it("authenticates via the Cf-Access-Jwt-Assertion header", async () => {
    stubJwks();
    const req = new Request("https://site/api/entries/x", {
      method: "DELETE",
      headers: { "Cf-Access-Jwt-Assertion": await makeJwt() },
    });
    expect(await getAdmin(req, baseEnv)).toEqual({ email: "admin@example.com" });
  });

  it("authenticates via the CF_Authorization cookie", async () => {
    stubJwks();
    const req = new Request("https://site/api/entries/x", {
      method: "DELETE",
      headers: { Cookie: `CF_Authorization=${await makeJwt()}` },
    });
    expect(await getAdmin(req, baseEnv)).toEqual({ email: "admin@example.com" });
  });

  it("returns null when no token is present", async () => {
    stubJwks();
    const req = new Request("https://site/api/entries/x", { method: "DELETE" });
    expect(await getAdmin(req, baseEnv)).toBeNull();
  });

  it("returns null when Access config is missing (fails closed)", async () => {
    stubJwks();
    const req = new Request("https://site/api/entries/x", {
      method: "DELETE",
      headers: { "Cf-Access-Jwt-Assertion": await makeJwt() },
    });
    expect(await getAdmin(req, { DB: {} as Env["DB"] })).toBeNull();
  });

  it("honours the local dev bypass without any token", async () => {
    const req = new Request("https://site/api/entries/x", { method: "DELETE" });
    const env: Env = { DB: {} as Env["DB"], ACCESS_DEV_BYPASS: "dev@example.com" };
    expect(await getAdmin(req, env)).toEqual({ email: "dev@example.com" });
  });
});

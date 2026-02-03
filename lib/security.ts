import crypto from "node:crypto";

const ACCESS_TOKEN_TTL_MS = 10 * 60 * 1000;
const SIGNAL_SECRET_TTL_MS = 10 * 60 * 1000;

type AccessTokenPayload = {
  code: string;
  exp: number;
};

function getAccessSecret() {
  const secret = process.env.FILES_ACCESS_SECRET;
  if (!secret) {
    throw new Error("Missing FILES_ACCESS_SECRET environment variable.");
  }
  return secret;
}

export function generateAccessToken(code: string) {
  const exp = Date.now() + ACCESS_TOKEN_TTL_MS;
  const payload: AccessTokenPayload = { code, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAccessSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyAccessToken(token: string, code: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", getAccessSecret())
    .update(encoded)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as AccessTokenPayload;
    return payload.code === code && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

export function generateSignalSecret() {
  return crypto.randomBytes(16).toString("hex");
}

export function getSignalSecretTtlMs() {
  return SIGNAL_SECRET_TTL_MS;
}

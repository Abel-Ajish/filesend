import { getSignalSecretTtlMs } from "@/lib/security";

type SignalSecretEntry = {
  secret: string;
  expiresAt: number;
};

const signalSecrets = new Map<string, SignalSecretEntry>();

export function registerSignalSecret(code: string, secret: string) {
  const expiresAt = Date.now() + getSignalSecretTtlMs();
  signalSecrets.set(code, { secret, expiresAt });
}

export function verifySignalSecret(code: string, secret: string) {
  const entry = signalSecrets.get(code);
  if (!entry) {
    return false;
  }
  if (Date.now() > entry.expiresAt) {
    signalSecrets.delete(code);
    return false;
  }
  return entry.secret === secret;
}

export function hasSignalSecret(code: string) {
  return signalSecrets.has(code);
}

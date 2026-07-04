import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const encryptionVersion = "v1";

function getSecret(name: string, fallbackName?: string) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : "");

  if (!value) {
    throw new Error(`${name} is missing on the server.`);
  }

  return value;
}

function getEncryptionKey() {
  const secret = getSecret("CONNECTED_ACCOUNT_ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  return createHash("sha256").update(secret).digest();
}

function getStateSecret() {
  return getSecret("OAUTH_STATE_SECRET", "SUPABASE_SERVICE_ROLE_KEY");
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [encryptionVersion, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptToken(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");

  if (version !== encryptionVersion || !iv || !tag || !encrypted) {
    throw new Error("Connected account token could not be read.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), fromBase64Url(iv));
  decipher.setAuthTag(fromBase64Url(tag));

  return Buffer.concat([decipher.update(fromBase64Url(encrypted)), decipher.final()]).toString("utf8");
}

export type OAuthStatePayload = {
  provider: "gmail" | "outlook";
  workspaceId: string;
  userId: string;
  createdAt: number;
};

export function signOAuthState(payload: OAuthStatePayload) {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getStateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  const [encoded, signature] = state.split(".");

  if (!encoded || !signature) {
    throw new Error("The connection link was invalid. Please start again.");
  }

  const expected = createHmac("sha256", getStateSecret()).update(encoded).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error("The connection link was invalid. Please start again.");
  }

  const payload = JSON.parse(fromBase64Url(encoded).toString("utf8")) as OAuthStatePayload;
  const ageMs = Date.now() - payload.createdAt;

  if (ageMs > 15 * 60 * 1000) {
    throw new Error("The connection link expired. Please start again.");
  }

  return payload;
}

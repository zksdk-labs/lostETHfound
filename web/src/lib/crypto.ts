import { serialToKey } from "./zk";

/**
 * Encrypts data using AES-GCM with the serial number as the key.
 * The serial number is hashed to produce a 256-bit key.
 *
 * @param serial - The item's serial number (encryption key)
 * @param data - The data to encrypt (questions, contact info, etc.)
 * @returns Base64-encoded encrypted data with IV prepended
 */
export async function encryptWithSerial(
  serial: string,
  data: string
): Promise<string> {
  const key = serialToKey(serial);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Encrypt
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(data)
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts data using AES-GCM with the serial number as the key.
 *
 * @param serial - The item's serial number (decryption key)
 * @param encryptedData - Base64-encoded encrypted data with IV prepended
 * @returns Decrypted string, or null if decryption fails (wrong serial)
 */
export async function decryptWithSerial(
  serial: string,
  encryptedData: string
): Promise<string | null> {
  try {
    const key = serialToKey(serial);

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedData), (c) =>
      c.charCodeAt(0)
    );

    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    // Decryption failed - wrong serial or corrupted data
    return null;
  }
}

/**
 * Data structure for encrypted question pack
 */
export interface EncryptedQuestionPack {
  questions: string[];
  contact: string;
}

/**
 * Encrypts a question pack (questions + contact) with the serial.
 */
export async function encryptQuestionPack(
  serial: string,
  pack: EncryptedQuestionPack
): Promise<string> {
  return encryptWithSerial(serial, JSON.stringify(pack));
}

/**
 * Decrypts a question pack with the serial.
 * Returns null if decryption fails (wrong serial).
 */
export async function decryptQuestionPack(
  serial: string,
  encryptedData: string
): Promise<EncryptedQuestionPack | null> {
  const decrypted = await decryptWithSerial(serial, encryptedData);
  if (!decrypted) return null;

  try {
    const parsed = JSON.parse(decrypted);
    if (
      typeof parsed === "object" &&
      Array.isArray(parsed.questions) &&
      typeof parsed.contact === "string"
    ) {
      return parsed as EncryptedQuestionPack;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tries to decrypt with a serial. Returns true if decryption succeeds.
 * Useful for checking if a serial matches a pack without parsing the data.
 */
export async function tryDecrypt(
  serial: string,
  encryptedData: string
): Promise<boolean> {
  const result = await decryptWithSerial(serial, encryptedData);
  return result !== null;
}

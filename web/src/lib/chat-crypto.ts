/**
 * Chat encryption utilities
 * Uses Web Crypto API for AES-GCM encryption
 */

/**
 * Derive room ID from return code using SHA-256
 * Only people with the return code can derive the same room ID
 */
export async function deriveRoomId(returnCode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(returnCode);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `lef_${hashHex.slice(0, 32)}`; // lef = LostETHFound
}

/**
 * Derive encryption key from return code using PBKDF2
 */
export async function deriveKey(returnCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(returnCode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("lostethfound-chat-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a message using AES-GCM
 */
export async function encryptMessage(
  message: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(message)
  );

  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a message using AES-GCM
 */
export async function decryptMessage(
  encryptedBase64: string,
  key: CryptoKey
): Promise<string | null> {
  try {
    const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
      c.charCodeAt(0)
    );
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

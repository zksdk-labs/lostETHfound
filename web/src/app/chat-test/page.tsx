"use client";

import { useState, useEffect } from "react";
import { Chat } from "@/components/Chat";
import { Nav } from "@/components/Nav";

export default function ChatTestPage() {
  const [returnCode, setReturnCode] = useState("test-return-code-123");
  const [role, setRole] = useState<"owner" | "finder">("owner");
  const [testAddress, setTestAddress] = useState(
    "0x1234567890abcdef1234567890abcdef12345678"
  );
  const [derivedRoomId, setDerivedRoomId] = useState<string>("");

  // Show derived room ID for debugging (dynamic import to avoid SSR)
  useEffect(() => {
    import("@/lib/chat-crypto").then(({ deriveRoomId }) => {
      deriveRoomId(returnCode).then(setDerivedRoomId);
    });
  }, [returnCode]);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-4 text-2xl font-bold">Chat Test Page (Gun.js)</h1>
        <p className="mb-6 text-gray-600">
          Test the P2P encrypted chat. Open this page in two browser windows
          with the same Return Code to test real-time messaging.
        </p>

        <div className="mb-6 rounded-xl border border-black/10 bg-white/80 p-4">
          <h2 className="mb-3 font-medium">Settings</h2>

          <div className="mb-3">
            <label className="mb-1 block text-sm text-gray-600">
              Return Code (secret key for the chat room)
            </label>
            <input
              type="text"
              value={returnCode}
              onChange={(e) => setReturnCode(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2"
              placeholder="Enter return code..."
            />
            <p className="mt-1 text-xs text-gray-400">
              Both windows need the same return code to join the same encrypted
              room
            </p>
          </div>

          {derivedRoomId && (
            <div className="mb-3 rounded-lg bg-gray-50 p-2">
              <p className="text-xs text-gray-500">
                Derived Room ID:{" "}
                <code className="text-gray-700">
                  {derivedRoomId.slice(0, 24)}...
                </code>
              </p>
            </div>
          )}

          <div className="mb-3">
            <label className="mb-1 block text-sm text-gray-600">
              Test Wallet Address
            </label>
            <input
              type="text"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
              placeholder="0x..."
            />
            <p className="mt-1 text-xs text-gray-400">
              Use different addresses in each window to simulate different users
            </p>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-sm text-gray-600">Role</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={role === "owner"}
                  onChange={() => setRole("owner")}
                />
                <span>Owner</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="finder"
                  checked={role === "finder"}
                  onChange={() => setRole("finder")}
                />
                <span>Finder</span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white/80 p-4">
          <h2 className="mb-3 font-medium">
            Encrypted Chat Room
            {derivedRoomId && (
              <span className="ml-2 font-mono text-sm text-[var(--accent)]">
                ({derivedRoomId.slice(0, 12)}...)
              </span>
            )}
          </h2>
          <Chat
            returnCode={returnCode}
            isOwner={role === "owner"}
            testAddress={testAddress}
          />
        </div>

        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <h3 className="font-medium text-green-800">How it works</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-green-700">
            <li>
              Return code is used to derive both the room ID and encryption key
            </li>
            <li>
              Only people with the same return code can join the same room
            </li>
            <li>Messages are encrypted with AES-GCM before being sent</li>
            <li>
              P2P sync via Gun.js - no central server stores your messages
            </li>
            <li>Messages persist locally in your browser</li>
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-medium text-blue-800">Testing Instructions</h3>
          <ol className="mt-2 list-inside list-decimal text-sm text-blue-700">
            <li>
              Open this page in two different browser windows (or incognito)
            </li>
            <li>Enter the same Return Code in both windows</li>
            <li>Use different Test Wallet Addresses in each window</li>
            <li>Wait for &quot;Connected (P2P)&quot; status</li>
            <li>Send messages from both sides</li>
            <li>Messages should appear encrypted in Gun, decrypted in UI</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

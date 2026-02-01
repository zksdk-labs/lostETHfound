"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface Props {
  returnCode: string;
  isOwner: boolean;
  /** For testing without wallet */
  testAddress?: string;
}

// localStorage key for chat messages
const getStorageKey = (roomId: string) => `lostethfound-chat-${roomId}`;

// Load messages from localStorage
const loadMessages = (roomId: string): ChatMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(getStorageKey(roomId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save messages to localStorage
const saveMessages = (roomId: string, messages: ChatMessage[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(roomId), JSON.stringify(messages));
  } catch {
    // Storage full or unavailable
  }
};

// WebSocket relay URL
const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || "ws://localhost:8765";

export function Chat({ returnCode, isOwner, testAddress }: Props) {
  const { address: walletAddress } = useAccount();
  const address = testAddress || walletAddress;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());

  const addDebug = useCallback(
    (msg: string) => {
      console.log(`[Chat ${returnCode.slice(0, 8)}...]`, msg);
      setDebugLog((prev) => [
        ...prev.slice(-9),
        `${new Date().toLocaleTimeString()}: ${msg}`,
      ]);
    },
    [returnCode]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize crypto and WebSocket connection
  useEffect(() => {
    let mounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = async () => {
      try {
        addDebug("Initializing...");

        // Import crypto utilities
        const { deriveRoomId, deriveKey, decryptMessage } = await import(
          "@/lib/chat-crypto"
        );

        if (!mounted) return;

        // Derive room ID and encryption key
        const derivedRoomId = await deriveRoomId(returnCode);
        const derivedKey = await deriveKey(returnCode);

        if (!mounted) return;

        setRoomId(derivedRoomId);
        keyRef.current = derivedKey;

        addDebug(`Room: ${derivedRoomId.slice(0, 16)}...`);

        // Load existing messages from localStorage
        const stored = loadMessages(derivedRoomId);
        if (stored.length > 0) {
          setMessages(stored);
          stored.forEach((m) => seenMessageIds.current.add(m.id));
          addDebug(`Loaded ${stored.length} messages from storage`);
        }

        // Connect to WebSocket relay
        addDebug(`Connecting to relay...`);
        ws = new WebSocket(RELAY_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          addDebug("Connected to relay");
          // Join the room
          ws?.send(JSON.stringify({ type: "join", room: derivedRoomId }));
        };

        ws.onmessage = async (event) => {
          if (!mounted) return;
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === "joined") {
              setConnected(true);
              addDebug("Joined room");
              return;
            }

            if (msg.type === "message") {
              // Skip if already seen
              if (seenMessageIds.current.has(msg.id)) return;

              // Decrypt the message
              const text = await decryptMessage(msg.encrypted, derivedKey);
              if (!text) {
                addDebug(`Failed to decrypt message`);
                return;
              }

              const chatMsg: ChatMessage = {
                id: msg.id,
                sender: msg.from,
                text,
                timestamp: msg.timestamp,
              };

              seenMessageIds.current.add(msg.id);
              addDebug(`Received: "${text.slice(0, 20)}..." from ${msg.from}`);

              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, chatMsg].sort(
                  (a, b) => a.timestamp - b.timestamp
                );
              });
            }
          } catch (err) {
            addDebug(`Error: ${err}`);
          }
        };

        ws.onclose = () => {
          if (!mounted) return;
          setConnected(false);
          addDebug("Disconnected from relay");
          // Try to reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            if (mounted) {
              addDebug("Reconnecting...");
              connect();
            }
          }, 3000);
        };

        ws.onerror = () => {
          if (!mounted) return;
          addDebug("Connection error");
          setError("Failed to connect to chat relay. Is it running?");
        };
      } catch (err) {
        if (!mounted) return;
        addDebug(`Error: ${String(err)}`);
        setError(`Failed to initialize chat: ${String(err)}`);
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [returnCode, addDebug]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (roomId && messages.length > 0) {
      saveMessages(roomId, messages);
    }
  }, [roomId, messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !wsRef.current || !address || !keyRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const { encryptMessage } = await import("@/lib/chat-crypto");

      const text = input.trim();
      const senderDisplay = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const timestamp = Date.now();
      const id = `${timestamp}_${Math.random().toString(36).slice(2, 9)}`;

      // Encrypt the message
      const encrypted = await encryptMessage(text, keyRef.current);

      // Add to local state immediately
      const localMsg: ChatMessage = {
        id,
        sender: senderDisplay,
        text,
        timestamp,
      };

      seenMessageIds.current.add(id);
      setMessages((prev) => [...prev, localMsg]);
      setInput("");

      // Send to relay
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          id,
          encrypted,
          from: senderDisplay,
          timestamp,
        })
      );

      addDebug(`Sent: "${text.slice(0, 20)}..."`);
    } catch (err) {
      addDebug(`Send error: ${err}`);
    }
  }, [input, address, addDebug]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
        <p className="mt-2 text-xs text-red-500">
          Make sure the relay server is running: <code>bun run relay</code>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">
          {isOwner ? "Chat with Finder" : "Chat with Owner"}
        </h3>
        <span
          className={`text-xs ${
            connected ? "text-green-600" : "text-gray-500"
          }`}
        >
          {connected ? "Connected" : "Connecting..."}
        </span>
      </div>

      <div className="mb-3 h-48 overflow-y-auto rounded-lg border border-black/10 bg-gray-50 p-2">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            {connected
              ? "No messages yet. Start the conversation!"
              : "Connecting to chat..."}
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-2 rounded-lg p-2 ${
                msg.sender.startsWith(address?.slice(0, 6) || "")
                  ? "ml-8 bg-[var(--accent)]/20"
                  : "mr-8 bg-white"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono">{msg.sender}</span>
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <p className="mt-1 text-sm">{msg.text}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            connected ? "Type a message..." : "Connecting to chat..."
          }
          disabled={!connected}
          className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Messages are end-to-end encrypted. Only you and the other party can read
        them.
      </p>

      {/* Debug panel - collapsible */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
          Debug info
        </summary>
        <div className="mt-2 max-h-32 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs">
          {debugLog.length === 0 ? (
            <p className="text-gray-400">No debug messages</p>
          ) : (
            debugLog.map((log, i) => (
              <div key={i} className="text-gray-600">
                {log}
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              seenMessageIds.current.clear();
              if (roomId) {
                localStorage.removeItem(getStorageKey(roomId));
              }
              addDebug("Chat cleared");
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Clear chat
          </button>
          <button
            type="button"
            onClick={() => {
              addDebug(`Room: ${roomId?.slice(0, 20)}...`);
              addDebug(`Messages: ${messages.length}`);
              addDebug(`Connected: ${connected}`);
            }}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Show status
          </button>
        </div>
      </details>
    </div>
  );
}

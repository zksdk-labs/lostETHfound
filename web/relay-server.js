/**
 * LostETHFound Chat Relay Server
 *
 * A simple WebSocket relay for encrypted P2P chat.
 * Messages are encrypted client-side - relay can't read them.
 *
 * Usage: node relay-server.js
 * Or: PORT=3001 node relay-server.js
 */

const { WebSocketServer } = require("ws");
const http = require("http");

const PORT = process.env.PORT || 8765;

// Room -> Set of WebSocket connections
const rooms = new Map();

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("LostETHFound Chat Relay\n");
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "join":
          // Leave old room if any
          if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            if (rooms.get(currentRoom).size === 0) {
              rooms.delete(currentRoom);
            }
          }

          // Join new room
          currentRoom = msg.room;
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set());
          }
          rooms.get(currentRoom).add(ws);

          // Confirm join
          ws.send(JSON.stringify({ type: "joined", room: currentRoom }));
          console.log(`[+] Client joined room ${currentRoom.slice(0, 16)}...`);
          break;

        case "message":
          // Broadcast encrypted message to all in room (except sender)
          if (currentRoom && rooms.has(currentRoom)) {
            const payload = JSON.stringify({
              type: "message",
              id: msg.id,
              encrypted: msg.encrypted,
              from: msg.from,
              timestamp: msg.timestamp,
            });

            for (const client of rooms.get(currentRoom)) {
              if (client !== ws && client.readyState === 1) {
                client.send(payload);
              }
            }
          }
          break;
      }
    } catch (err) {
      console.error("Invalid message:", err.message);
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
      console.log(`[-] Client left room ${currentRoom.slice(0, 16)}...`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          LostETHFound Chat Relay Server               ║
╠═══════════════════════════════════════════════════════╣
║  Status:    Running                                   ║
║  Port:      ${PORT}                                       ║
║  WebSocket: ws://localhost:${PORT}                        ║
╠═══════════════════════════════════════════════════════╣
║  Messages are encrypted end-to-end.                   ║
║  This relay only forwards data it cannot read.        ║
╚═══════════════════════════════════════════════════════╝
  `);
});

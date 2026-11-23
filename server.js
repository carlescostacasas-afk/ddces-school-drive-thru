const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname));

const active = new Map(); // code -> { code, calledAt }
io.on("connection", socket => {
  socket.emit("state", [...active.values()]);
  socket.on("call-student", raw => {
    const code = String(raw || "").toUpperCase().replace(/\s/g, "");
    if (!/^DDCES(?:[1-9]|[1-9]\d|1[0-5]\d|160)$/.test(code)) {
      socket.emit("notice", { type: "error", text: "Código no válido. Usa DDCES1 a DDCES160." });
      return;
    }
    if (!active.has(code)) active.set(code, { code, calledAt: Date.now() });
    io.emit("state", [...active.values()]);
    socket.emit("notice", { type: "success", text: `${code} enviado al aula.` });
  });
  socket.on("picked-up", code => {
    active.delete(String(code || "").toUpperCase());
    io.emit("state", [...active.values()]);
  });
  socket.on("clear-all", () => {
    active.clear();
    io.emit("state", []);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => console.log(`DDCES app listening on ${port}`));

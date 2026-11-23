const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { timingSafeEqual } = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

// The school day follows the school's local timezone.
const SCHOOL_TIME_ZONE = process.env.SCHOOL_TIME_ZONE || "America/New_York";
const callsToday = new Map(); // code -> { code, calledAt }

function schoolDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

let currentSchoolDay = schoolDateKey();

function resetAtNewSchoolDay() {
  const today = schoolDateKey();
  if (today !== currentSchoolDay) {
    callsToday.clear();
    currentSchoolDay = today;
    io.to("authenticated").emit("state", []);
    console.log(`DDCES call list cleared for the new school day (${today}, ${SCHOOL_TIME_ZONE}).`);
  }
}

const dailyResetCheck = setInterval(resetAtNewSchoolDay, 15 * 1000);
dailyResetCheck.unref?.();

function getCallsInOrder() {
  return [...callsToday.values()].sort((a, b) => a.calledAt - b.calledAt);
}

function passwordMatches(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || expected.length === 0) {
    return false;
  }
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

io.on("connection", socket => {
  resetAtNewSchoolDay();
  socket.data.authAttempts = 0;

  socket.on("authenticate", (credentials, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};
    const role = credentials?.role;
    const providedPassword = credentials?.password;

    // An authentication attempt always replaces any previous role on this socket.
    socket.leave("authenticated");
    delete socket.data.role;

    const expectedPassword = role === "drive"
      ? process.env.DDCES_DRIVE_PASSWORD
      : role === "classroom"
        ? process.env.DDCES_CLASSROOM_PASSWORD
        : undefined;

    if (!expectedPassword) {
      reply({ ok: false, message: "El acceso aún no está configurado en el servidor." });
      return;
    }

    if (!passwordMatches(providedPassword, expectedPassword)) {
      socket.data.authAttempts += 1;
      reply({ ok: false, message: "Contraseña incorrecta. Inténtalo de nuevo." });
      if (socket.data.authAttempts >= 8) socket.disconnect(true);
      return;
    }

    socket.data.role = role;
    socket.join("authenticated");
    socket.data.authAttempts = 0;
    reply({ ok: true, role });
    socket.emit("state", getCallsInOrder());
  });

  socket.on("logout", () => {
    socket.leave("authenticated");
    delete socket.data.role;
  });

  socket.on("call-student", raw => {
    if (socket.data.role !== "drive") {
      socket.emit("notice", { type: "error", text: "Necesitas acceder con la contraseña de Drive-Thru." });
      return;
    }

    resetAtNewSchoolDay();
    const code = String(raw || "").toUpperCase().replace(/\s/g, "");
    if (!/^DDCES(?:[1-9]|[1-9]\d|1[0-5]\d|160)$/.test(code)) {
      socket.emit("notice", { type: "error", text: "Código no válido. Usa DDCES1 a DDCES160." });
      return;
    }

    // Keep the first call and its timestamp; duplicate calls do not reset its place in the queue.
    if (!callsToday.has(code)) {
      callsToday.set(code, { code, calledAt: Date.now() });
    }

    io.to("authenticated").emit("state", getCallsInOrder());
    socket.emit("notice", { type: "success", text: `${code} enviado al aula.` });
  });
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`DDCES app listening on ${port}; school timezone: ${SCHOOL_TIME_ZONE}`);
  if (!process.env.DDCES_DRIVE_PASSWORD || !process.env.DDCES_CLASSROOM_PASSWORD) {
    console.warn("DDCES access passwords are not configured. Set DDCES_DRIVE_PASSWORD and DDCES_CLASSROOM_PASSWORD in the service environment.");
  }
});

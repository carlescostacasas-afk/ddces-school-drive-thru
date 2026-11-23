const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

// The school day follows the school's local timezone.
// Override with SCHOOL_TIME_ZONE if the school is in another timezone.
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
    io.emit("state", []);
    console.log(`DDCES call list cleared for the new school day (${today}, ${SCHOOL_TIME_ZONE}).`);
  }
}

// Check frequently so calls are cleared at midnight in the school's timezone.
const dailyResetCheck = setInterval(resetAtNewSchoolDay, 15 * 1000);
dailyResetCheck.unref?.();

function getCallsInOrder() {
  return [...callsToday.values()].sort((a, b) => a.calledAt - b.calledAt);
}

io.on("connection", socket => {
  resetAtNewSchoolDay();
  socket.emit("state", getCallsInOrder());

  socket.on("call-student", raw => {
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

    io.emit("state", getCallsInOrder());
    socket.emit("notice", { type: "success", text: `${code} enviado al aula.` });
  });
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`DDCES app listening on ${port}; school timezone: ${SCHOOL_TIME_ZONE}`);
});

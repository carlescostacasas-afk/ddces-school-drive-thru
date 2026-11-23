const socket = io();
const home = document.getElementById("home");
const drive = document.getElementById("drive");
const classroom = document.getElementById("classroom");
const codeInput = document.getElementById("code");
const notice = document.getElementById("notice");
const courseSelect = document.getElementById("courseSelect");
let calls = [];

function show(view) {
  [home, drive, classroom].forEach(x => x.classList.add("hidden"));
  ({home, drive, classroom})[view].classList.remove("hidden");
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
document.querySelectorAll(".back").forEach(b => b.addEventListener("click", () => show("home")));
socket.on("connect", () => document.getElementById("connection").textContent = "● Conectado");
socket.on("disconnect", () => document.getElementById("connection").textContent = "● Sin conexión");
socket.on("notice", n => { notice.textContent=n.text; notice.className="notice "+(n.type==="success"?"ok":"err"); });
socket.on("state", list => { calls=list; renderCallLog(); });

function sendCode() {
  let value=codeInput.value.toUpperCase().replace(/\s/g,"");
  if (/^\d+$/.test(value)) value="DDCES"+value;
  socket.emit("call-student", value);
  codeInput.value="";
}
document.getElementById("send").addEventListener("click", sendCode);
codeInput.addEventListener("keydown", e => { if(e.key==="Enter") sendCode(); });
document.getElementById("keypad").addEventListener("click", e => {
  const key=e.target.dataset.key; if(!key)return;
  if(key==="clear") codeInput.value="";
  else if(key==="back") codeInput.value=codeInput.value.slice(0,-1);
  else codeInput.value += key;
  codeInput.focus();
});

courseSelect.addEventListener("change", renderCallLog);
document.getElementById("fullscreen").addEventListener("click", () => {
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

function formatCallTime(timestamp) {
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(new Date(timestamp));
}

function renderCallLog() {
  if (!courseSelect) return;
  const selectedGrade = Number(courseSelect.value);
  const firstStudent = (selectedGrade - 1) * 20 + 1;
  const lastStudent = selectedGrade * 20;

  const courseCalls = calls
    .filter(call => {
      const studentNumber = Number(call.code.replace("DDCES", ""));
      return studentNumber >= firstStudent && studentNumber <= lastStudent;
    })
    .sort((a, b) => a.calledAt - b.calledAt);

  document.getElementById("courseSummary").textContent =
    courseCalls.length + (courseCalls.length === 1 ? " llamada registrada hoy" : " llamadas registradas hoy");

  const log = document.getElementById("callLog");
  log.replaceChildren();

  if (courseCalls.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-log";
    empty.textContent = "Todavía no hay llamadas para este curso hoy.";
    log.appendChild(empty);
    return;
  }

  courseCalls.forEach((call, index) => {
    const row = document.createElement("div");
    row.className = "call-row";

    const order = document.createElement("span");
    order.className = "call-order";
    order.textContent = String(index + 1).padStart(2, "0");

    const student = document.createElement("strong");
    student.className = "call-code";
    student.textContent = call.code;

    const status = document.createElement("span");
    status.className = "call-status";
    status.textContent = "LLAMADO";

    const time = document.createElement("time");
    time.className = "call-time";
    time.dateTime = new Date(call.calledAt).toISOString();
    time.textContent = formatCallTime(call.calledAt);

    row.append(order, student, status, time);
    log.appendChild(row);
  });
}

renderCallLog();

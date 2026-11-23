const socket = io();
const home = document.getElementById("home");
const login = document.getElementById("login");
const drive = document.getElementById("drive");
const classroom = document.getElementById("classroom");
const codeInput = document.getElementById("code");
const notice = document.getElementById("notice");
const courseSelect = document.getElementById("courseSelect");
const passwordInput = document.getElementById("accessPassword");
const loginError = document.getElementById("loginError");

let calls = [];
let selectedRole = null;
let currentRole = null;
let sessionPassword = "";

function show(view) {
  [home, login, drive, classroom].forEach(section => section.classList.add("hidden"));
  ({home, login, drive, classroom})[view].classList.remove("hidden");
}

function openLogin(role) {
  if (currentRole) socket.emit("logout");
  currentRole = null;
  sessionPassword = "";
  selectedRole = role;
  passwordInput.value = "";
  loginError.textContent = "";

  const isDrive = role === "drive";
  document.getElementById("loginTitle").textContent = isDrive ? "Acceso Drive-Thru" : "Acceso Profesor / Aula";
  document.getElementById("loginDescription").textContent = isDrive
    ? "Introduce la contraseña para acceder a la pantalla de entrada de códigos."
    : "Introduce la contraseña para consultar el registro de llamadas de tu curso.";
  document.getElementById("loginBadge").textContent = isDrive ? "ACCESO DRIVE-THRU" : "ACCESO PROFESOR / AULA";
  show("login");
  passwordInput.focus();
}

function logout() {
  socket.emit("logout");
  currentRole = null;
  selectedRole = null;
  sessionPassword = "";
  calls = [];
  codeInput.value = "";
  notice.textContent = "";
  renderCallLog();
  show("home");
}

document.querySelectorAll("[data-role]").forEach(button => {
  button.addEventListener("click", () => openLogin(button.dataset.role));
});
document.getElementById("loginBack").addEventListener("click", () => {
  selectedRole = null;
  passwordInput.value = "";
  loginError.textContent = "";
  show("home");
});
document.querySelectorAll(".app-back").forEach(button => button.addEventListener("click", logout));

document.getElementById("loginForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!selectedRole) return;
  if (!socket.connected) {
    loginError.textContent = "No hay conexión con el servidor. Comprueba la conexión e inténtalo de nuevo.";
    return;
  }

  const submittedPassword = passwordInput.value;
  loginError.textContent = "";
  socket.emit("authenticate", { role: selectedRole, password: submittedPassword }, result => {
    if (!result?.ok) {
      loginError.textContent = result?.message || "No se ha podido validar la contraseña.";
      passwordInput.select();
      return;
    }

    currentRole = result.role;
    sessionPassword = submittedPassword;
    passwordInput.value = "";
    loginError.textContent = "";
    show(currentRole);
    if (currentRole === "classroom") renderCallLog();
  });
});

socket.on("connect", () => {
  document.getElementById("connection").textContent = "● Conectado";
  // Re-authenticate after a temporary network interruption.
  if (currentRole && sessionPassword) {
    socket.emit("authenticate", { role: currentRole, password: sessionPassword }, result => {
      if (!result?.ok) {
        currentRole = null;
        sessionPassword = "";
        selectedRole = null;
        show("home");
        loginError.textContent = "La sesión ha caducado. Vuelve a introducir la contraseña.";
      }
    });
  }
});
socket.on("disconnect", () => {
  document.getElementById("connection").textContent = "● Sin conexión";
});
socket.on("notice", message => {
  notice.textContent = message.text;
  notice.className = "notice " + (message.type === "success" ? "ok" : "err");
});
socket.on("state", list => {
  if (!currentRole) return;
  calls = list;
  renderCallLog();
});

function sendCode() {
  if (currentRole !== "drive") return;
  let value = codeInput.value.toUpperCase().replace(/\s/g, "");
  if (/^\d+$/.test(value)) value = "DDCES" + value;
  socket.emit("call-student", value);
  codeInput.value = "";
}
document.getElementById("send").addEventListener("click", sendCode);
codeInput.addEventListener("keydown", event => {
  if (event.key === "Enter") sendCode();
});
document.getElementById("keypad").addEventListener("click", event => {
  const key = event.target.dataset.key;
  if (!key || currentRole !== "drive") return;
  if (key === "clear") codeInput.value = "";
  else if (key === "back") codeInput.value = codeInput.value.slice(0, -1);
  else codeInput.value += key;
  codeInput.focus();
});

courseSelect.addEventListener("change", renderCallLog);
document.getElementById("fullscreen").addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
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

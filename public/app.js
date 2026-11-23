const socket = io();
const schoolLogo = document.getElementById("schoolLogo");
if (schoolLogo && window.DDCES_LOGO_DATA) schoolLogo.src = window.DDCES_LOGO_DATA;
const home = document.getElementById("home");
const login = document.getElementById("login");
const drive = document.getElementById("drive");
const classroom = document.getElementById("classroom");
const codeInput = document.getElementById("code");
const notice = document.getElementById("notice");
const courseSelect = document.getElementById("courseSelect");
const passwordInput = document.getElementById("accessPassword");
const loginError = document.getElementById("loginError");

// Nombres ficticios de demostración, asignados en orden a DDCES1–DDCES160.
// Sustituir esta lista por el roster autorizado del colegio antes del uso oficial.
const STUDENT_NAMES = [
  "Sofia Alvarez", "Mateo Rivera", "Isabella Torres", "Lucas Bennett", "Valentina Cruz",
  "Noah Williams", "Camila Morales", "Ethan Brooks", "Mia Castillo", "Liam Johnson",
  "Gabriel Reyes", "Olivia Thompson", "Daniel Ortiz", "Ava Martinez", "Adrian Garcia",
  "Emma Wilson", "Sebastian Flores", "Chloe Davis", "Julian Herrera", "Grace Miller",

  "Diego Ramirez", "Amelia Anderson", "Nicolas Vega", "Harper Moore", "Lucia Sanchez",
  "James Carter", "Elena Mendoza", "Benjamin Scott", "Thiago Silva", "Charlotte Lewis",
  "Andres Navarro", "Ella Walker", "Samuel Perez", "Victoria Hall", "Emilio Castro",
  "Aria Young", "Rafael Jimenez", "Lily Allen", "Marco Delgado", "Zoe King",

  "Isabel Romero", "Mason Wright", "Paula Medina", "Henry Green", "Dylan Cooper",
  "Natalia Rojas", "Alexander Hill", "Abigail Baker", "Javier Molina", "Layla Nelson",
  "Carlos Herrera", "Avery Mitchell", "Eva Dominguez", "Logan Roberts", "Manuel Ortiz",
  "Scarlett Turner", "Santiago Fuentes", "Penelope Phillips", "Andres Cruz", "Riley Campbell",

  "Mariana Vargas", "Elijah Parker", "Ana Beltran", "Michael Evans", "Ximena Aguilar",
  "Jackson Edwards", "Sara Cabrera", "Aiden Collins", "Renata Salazar", "Carter Stewart",
  "Francisco Luna", "Nora Morris", "Leonardo Pineda", "Stella Rogers", "Pablo Acosta",
  "Addison Reed", "Dario Guerra", "Hannah Cook", "Cristian Soto", "Audrey Morgan",

  "Alma Valencia", "Wyatt Bell", "Bianca Fuentes", "Caleb Murphy", "Danna Lozano",
  "Owen Bailey", "Abril Campos", "Luke Rivera", "Emiliano Pena", "Ellie Richardson",
  "Sergio Fuentes", "Mila Cox", "Gael Mendoza", "Lucy Howard", "Enzo Carrillo",
  "Paisley Ward", "Bruno Vega", "Violet Torres", "Maxwell Diaz", "Ariana Foster",

  "Maya Espinoza", "Jayden Gray", "Catalina Pardo", "Isaac James", "Julieta Marin",
  "Levi Watson", "Diana Solis", "Ezra Brooks", "Alonso Cardenas", "Samantha Price",
  "Kevin Rivas", "Madeline Bennett", "Alvaro Ibarra", "Brooklyn Hughes", "Esteban Vidal",
  "Claire Patterson", "Miranda Cabrera", "Austin Long", "Tomas Benitez", "Sadie Ross",

  "Ines Serrano", "Hunter Powell", "Mireya Lozano", "Nolan Perry", "Alexa Fuentes",
  "Easton Butler", "Belen Montoya", "Roman Henderson", "Celeste Pacheco", "Dominic Jenkins",
  "Anais Laurent", "Miles Barnes", "Karla Meza", "Xavier Fisher", "Noemi Arias",
  "Connor Simmons", "Felipe Duarte", "Ruby Coleman", "Derek Suarez", "Elisa Guerra",

  "Amir Hassan", "Naomi Pierre", "Talia Bernard", "Andre Joseph", "Kiara Charles",
  "Malik Washington", "Jasmine Clarke", "Ibrahim Diallo", "Malia Toussaint", "Kendall Wright",
  "Jorge Espada", "Leila Haddad", "Zion Thomas", "Yasmin Ali", "Calvin Reed",
  "Amara Jean", "Dante Lewis", "Selena Martinez", "Rayan Morin", "Nadia Baptiste"
];

if (STUDENT_NAMES.length !== 160) {
  console.error("La lista de alumnos debe contener exactamente 160 nombres.");
}

function studentNameForCode(code) {
  const number = Number(String(code).replace("DDCES", ""));
  return Number.isInteger(number) && number >= 1 && number <= 160
    ? STUDENT_NAMES[number - 1]
    : "Nombre no asignado";
}

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
  let value = codeInput.value.toUpperCase().replace(/\\s/g, "");
  if (/^\\d+$/.test(value)) value = "DDCES" + value;
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
  const selectedCourse = courseSelect.value;
  const allCoursesSelected = selectedCourse === "all";
  const selectedGrade = Number(selectedCourse);
  const firstStudent = (selectedGrade - 1) * 20 + 1;
  const lastStudent = selectedGrade * 20;
  const courseCalls = calls
    .filter(call => {
      if (allCoursesSelected) return true;
      const studentNumber = Number(call.code.replace("DDCES", ""));
      return studentNumber >= firstStudent && studentNumber <= lastStudent;
    })
    .sort((a, b) => a.calledAt - b.calledAt);

  const summary = courseCalls.length +
    (courseCalls.length === 1 ? " llamada registrada hoy" : " llamadas registradas hoy");
  document.getElementById("courseSummary").textContent =
    allCoursesSelected ? summary + " · TODOS LOS GRADOS" : summary;

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

    const identity = document.createElement("div");
    identity.className = "call-identity";

    const studentName = document.createElement("strong");
    studentName.className = "call-name";
    studentName.textContent = studentNameForCode(call.code);

    const studentCode = document.createElement("span");
    studentCode.className = "call-code";
    studentCode.textContent = call.code;

    // Show the student's name first and the DDCES code as secondary information.
    identity.append(studentName, studentCode);

    if (allCoursesSelected) {
      const studentNumber = Number(call.code.replace("DDCES", ""));
      const grade = Math.floor((studentNumber - 1) / 20) + 1;
      const courseTag = document.createElement("span");
      courseTag.className = "call-grade";
      courseTag.textContent = grade + ".º grado";
      identity.appendChild(courseTag);
    }

    const status = document.createElement("span");
    status.className = "call-status";
    status.textContent = "LLAMADO";

    const time = document.createElement("time");
    time.className = "call-time";
    time.dateTime = new Date(call.calledAt).toISOString();
    time.textContent = formatCallTime(call.calledAt);

    row.append(order, identity, status, time);
    log.appendChild(row);
  });
}

renderCallLog();


// Register the installable app shell over HTTPS (Render production URL).
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(error => {
      console.warn("DDCES app shell registration failed:", error);
    });
  });
}

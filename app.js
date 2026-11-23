const socket = io();
const home = document.getElementById("home");
const drive = document.getElementById("drive");
const classroom = document.getElementById("classroom");
const codeInput = document.getElementById("code");
const notice = document.getElementById("notice");
let active = [];

function show(view) {
  [home, drive, classroom].forEach(x => x.classList.add("hidden"));
  ({home, drive, classroom})[view].classList.remove("hidden");
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
document.querySelectorAll(".back").forEach(b => b.addEventListener("click", () => show("home")));
socket.on("connect", () => document.getElementById("connection").textContent = "● Conectado");
socket.on("disconnect", () => document.getElementById("connection").textContent = "● Sin conexión");
socket.on("notice", n => { notice.textContent=n.text; notice.className="notice "+(n.type==="success"?"ok":"err"); });
socket.on("state", list => { active=list; render(); });

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
document.getElementById("clearAll").addEventListener("click", () => {
  if(confirm("¿Limpiar todas las llamadas activas?")) socket.emit("clear-all");
});
document.getElementById("fullscreen").addEventListener("click", () => {
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});
function render(){
  const nums=active.map(x=>Number(x.code.replace("DDCES",""))).sort((a,b)=>a-b);
  const latest=document.getElementById("latest");
  latest.className="latest"+(nums.length?"":" empty");
  latest.textContent=nums.length ? "LLAMADA ACTIVA: "+active[active.length-1].code : "ESPERANDO LLAMADAS";
  const wrap=document.getElementById("classes"); wrap.innerHTML="";
  for(let c=0;c<8;c++){
    const card=document.createElement("div"); card.className="class-card";
    const title=document.createElement("h3"); title.textContent=`CLASE ${c+1} · DDCES${c*20+1}–${c*20+20}`; card.appendChild(title);
    const grid=document.createElement("div"); grid.className="students";
    for(let i=c*20+1;i<=c*20+20;i++){
      const code="DDCES"+i, isCalled=active.some(x=>x.code===code);
      const cell=document.createElement("div"); cell.className="student"+(isCalled?" called":"");
      cell.textContent=code.replace("DDCES","");
      if(isCalled){cell.title="Pulsar para marcar como recogido";cell.addEventListener("click",()=>socket.emit("picked-up",code));}
      grid.appendChild(cell);
    }
    card.appendChild(grid);wrap.appendChild(card);
  }
}
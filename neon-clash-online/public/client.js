(() => {
const socket = io();
const $ = id => document.getElementById(id);
const lobby = $("lobby"), roomPanel = $("roomPanel"), gamePanel = $("gamePanel");
const canvas = $("game"), ctx = canvas.getContext("2d");
let mySlot = 0, roomCode = "", state = null, effects = [], matchFinished = false;
const controls = { left:false,right:false,jump:false,block:false,punch:false,kick:false,special:false };
const keyMap = {a:"left",d:"right",w:"jump",s:"block",j:"punch",k:"kick",l:"special"};
function show(el){el.classList.remove("hidden")} function hide(el){el.classList.add("hidden")}
function message(el,text,error=false){el.textContent=text;el.classList.toggle("error",error)}
function sendInput(){if(mySlot && state?.status==="playing")socket.emit("input",controls)}
function clearControls(){Object.keys(controls).forEach(k=>controls[k]=false);sendInput()}
function enterRoom(data){
  mySlot=data.slot;roomCode=data.code;
  $("roomCode").textContent=roomCode;
  hide(lobby);show(roomPanel);message($("roomStatus"),"Waiting for your friend to join…");
}
$("createBtn").onclick=()=>{ $("createBtn").disabled=true;socket.emit("createRoom",{},res=>{$("createBtn").disabled=false;if(res?.ok)enterRoom(res);else message($("lobbyMessage"),"Could not create room. Try again.",true)})};
$("joinBtn").onclick=()=>{const code=$("roomInput").value.trim().toUpperCase();if(code.length!==5)return message($("lobbyMessage"),"Enter the 5-character room code.",true);$("joinBtn").disabled=true;socket.emit("joinRoom",code,res=>{$("joinBtn").disabled=false;if(res?.ok)enterRoom(res);else message($("lobbyMessage"),res?.error||"Could not join room.",true)})};
$("roomInput").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5));
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyBtn").textContent="Copied!";setTimeout(()=>$("copyBtn").textContent="Copy code",1200)}catch(e){message($("roomStatus"),"Room code: "+roomCode)}};
$("leaveBtn").onclick=leaveRoom;$("backBtn").onclick=leaveRoom;
function leaveRoom(){clearControls();socket.emit("leaveRoom");mySlot=0;roomCode="";state=null;hide(roomPanel);hide(gamePanel);show(lobby);message($("lobbyMessage"),"You left the room.");}
socket.on("connect",()=>message($("lobbyMessage"),"Connected. Create a room or enter a friend's code."));
socket.on("connect_error",()=>message($("lobbyMessage"),"Can't connect to the game server. Refresh and try again.",true));
socket.on("gameState",s=>{state=s;updateUI()});
socket.on("gameStarted",s=>{state=s;hide(lobby);hide(roomPanel);show(gamePanel);$("gameMessage").textContent="FIGHT!";hide($("endActions"));updateUI()});
socket.on("roundReset",s=>{state=s;matchFinished=false;$("gameMessage").textContent="FIGHT!";hide($("endActions"));updateUI()});
socket.on("roundOver",s=>{state=s;updateUI();const me=state.fighters[mySlot-1],opp=state.fighters[2-mySlot];matchFinished=true;const won=me && opp && me.wins>opp.wins;$("gameMessage").textContent=me?.wins>=2?"MATCH VICTORY!":opp?.wins>=2?"MATCH LOST":won?"ROUND WON!":"ROUND LOST!";show($("endActions"))});
socket.on("opponentLeft",()=>{message($("roomStatus"),"Your friend disconnected. Waiting for another player…");hide(gamePanel);show(roomPanel)});
socket.on("hitEffect",e=>{effects.push({...e,life:18})});
function updateUI(){
 if(!state)return;
 const mine=state.fighters[mySlot-1],opp=state.fighters[2-mySlot];
 if(!mine)return;
 if(state.status==="waiting"){show(roomPanel);hide(gamePanel);message($("roomStatus"),opp?"Opponent connected. Starting…":"Waiting for your friend to join…");$("playerSlots").innerHTML=`<span>You: connected</span><span>Opponent: ${opp?"connected":"waiting"}</span>`}
 if(state.status==="playing"){hide(roomPanel);show(gamePanel);$("youHealth").style.width=mine.hp+"%";$("friendHealth").style.width=(opp?.hp||0)+"%";$("youWins").textContent=mine.wins;$("friendWins").textContent=opp?.wins||0;$("roundLabel").textContent="ROUND "+state.round}
}
function setControl(name,value){if(!(name in controls))return;controls[name]=value;sendInput()}
document.addEventListener("keydown",e=>{const k=e.key.toLowerCase(),control=keyMap[k];if(control){e.preventDefault();setControl(control,true)}});
document.addEventListener("keyup",e=>{const control=keyMap[e.key.toLowerCase()];if(control)setControl(control,false)});
window.addEventListener("blur",clearControls);
document.querySelectorAll("[data-control]").forEach(btn=>{
 const name=btn.dataset.control;
 btn.addEventListener("pointerdown",e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);setControl(name,true)});
 const release=e=>{e.preventDefault();setControl(name,false)};
 btn.addEventListener("pointerup",release);btn.addEventListener("pointercancel",release);btn.addEventListener("lostpointercapture",()=>setControl(name,false));
});
$("rematchBtn").onclick=()=>{socket.emit("rematch");$("rematchBtn").disabled=true;setTimeout(()=>$("rematchBtn").disabled=false,500)};
function drawBackground(){
 const g=ctx.createLinearGradient(0,0,0,500);g.addColorStop(0,"#101a3a");g.addColorStop(1,"#27355a");ctx.fillStyle=g;ctx.fillRect(0,0,960,500);
 ctx.fillStyle="#19294b";for(let i=0;i<10;i++){let x=i*110-20;ctx.fillRect(x,180+(i%3)*24,65,228);ctx.fillStyle="#334b78";for(let j=0;j<4;j++)ctx.fillRect(x+12+(j%2)*22,195+(i%3)*24+j*38,9,15);ctx.fillStyle="#19294b"}
 ctx.fillStyle="#0c1429";ctx.fillRect(0,408,960,92);ctx.strokeStyle="#5be4e8";ctx.globalAlpha=.35;ctx.lineWidth=2;for(let i=0;i<960;i+=60){ctx.beginPath();ctx.moveTo(i,408);ctx.lineTo(i-45,500);ctx.stroke()}ctx.globalAlpha=1;
 ctx.fillStyle="#8dfaff";ctx.font="bold 14px system-ui";ctx.fillText("NEON ARENA",20,30);
}
function drawFighter(f,slot){
 if(!f)return;const x=f.x,y=f.y,cy=y-105,face=f.face;
 ctx.fillStyle="#02061188";ctx.beginPath();ctx.ellipse(x+27,411,42,8,0,0,Math.PI*2);ctx.fill();
 ctx.lineCap="round";ctx.lineWidth=15;ctx.strokeStyle=slot===mySlot?"#168e9b":"#a62c56";ctx.beginPath();
 ctx.moveTo(x+20,cy+70);ctx.lineTo(x+15+(f.attack==="kick"?face*20:0),y-3);ctx.moveTo(x+36,cy+70);ctx.lineTo(x+42,y-3);ctx.stroke();
 const color=slot===mySlot?"#39e6dc":"#ff547d";
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x+8,cy+34,38,49,12);ctx.fill();
 ctx.fillStyle="#e9f4ff";ctx.beginPath();ctx.arc(x+27,cy+19,19,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=slot===mySlot?"#103c59":"#542039";ctx.fillRect(x+10,cy+13,34,9);
 ctx.strokeStyle=color;ctx.lineWidth=12;ctx.beginPath();let reach=f.attack?(f.attack==="special"?45:30):0;
 ctx.moveTo(x+12,cy+46);ctx.lineTo(x+5-face*reach,cy+61);ctx.moveTo(x+42,cy+46);ctx.lineTo(x+49+face*reach,cy+59);ctx.stroke();
 if(f.attack){ctx.fillStyle=f.attack==="special"?"#fff06a":"#d8fbff";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(x+27+face*60,cy+57,f.attack==="special"?22:10,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
 if(f.blocking){ctx.strokeStyle="#a9c8ff";ctx.lineWidth=5;ctx.beginPath();ctx.arc(x+27,cy+48,34,-1.2,1.2);ctx.stroke()}
}
function render(){
 drawBackground();
 if(state?.fighters){drawFighter(state.fighters[0],1);drawFighter(state.fighters[1],2)}
 for(const e of effects){ctx.globalAlpha=e.life/18;ctx.strokeStyle=e.blocked?"#a9c8ff":"#fff06a";ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,28-e.life*.5,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;e.life--}
 effects=effects.filter(e=>e.life>0);
 if(!state){ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 30px system-ui";ctx.fillText("CREATE OR JOIN A ROOM",480,240);ctx.textAlign="left"}
 requestAnimationFrame(render);
}
$("game").addEventListener("contextmenu",e=>e.preventDefault());
render();
})();
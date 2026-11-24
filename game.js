(()=>{"use strict";
const $=id=>document.getElementById(id);
const canvas=$("game");
if(!window.BABYLON){showError("Babylon.js not loaded","The 3D engine library failed to load. Check your internet connection and reload the page.");return;}
const B=window.BABYLON;
let engine;
try{
 engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,antialias:false,powerPreference:"low-power"});
 engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio>1?1.35:1));
 canvas.width=canvas.clientWidth||800;
 canvas.height=canvas.clientHeight||600;
 canvas.style.backgroundColor="#111820";
}catch(e){
 showError("3D engine failed to start",""+e.message,e.stack);
 return;
}
// Global error handler: show JS errors on screen instead of hidden console
window.addEventListener("error",e=>{
 const msg=e.message||e.error&&e.error.message||String(e);
 showError("JavaScript error",msg,e.error&&e.error.stack);
 console.error(e);
});
window.addEventListener("unhandledrejection",e=>{
 showError("Unhandled promise rejection",""+(e.reason&&e.reason.message?e.reason.message:String(e.reason)),e.reason&&e.reason.stack);
});
// Keep canvas sized to the preview iframe container
if(window.ResizeObserver){
 new ResizeObserver(()=>{
  if(canvas){canvas.width=canvas.clientWidth||800;canvas.height=canvas.clientHeight||600;if(engine)engine.resize();}
 }).observe(canvas.parentElement||document.body);
}
let scene,camera,gunRoot=null,baseFov=Math.PI/2.8,started=false,paused=false,mouseHeld=false,eHeld=false,aimHeld=false,aimZoom=1,health=100,shield=50,maxShield=50,ammo=30,kills=0,reloading=false,reloadTimer=0,lastTime=0,jumpVelocity=0,onGround=true,fireCooldown=0,targets=[],keys={},toastTimer=0,gun=null,barrelMesh=null,muzzleFlash=null,recoilKick=0,gunKick=0,spreadKick=0,firingSpreadDeg=0,lookPitch=0,lookYaw=Math.PI,recoilPitchDeg=0,recoilYawDeg=0,recoilHoldTimer=0,recoilPeakPitch=8,recoilPeakYaw=2.5,crouched=false,burstRemaining=0,burstTimer=0,activeWeaponIndex=0,credits=999999,netSocket=null,myName="Operator",myTeam="red",tdmRoomCode=null,netLastSend=0,mpCount=1,remotes=new Map();
const agentApi=window.CustomFPSAgents;
const selectedAgent=agentApi?agentApi.getAgent(agentApi.getSelectedAgentId()):null;
let abCharges={c:2,q:1,e:1},ultPoints=0,ultKnives=0,tailwindPrimedTimer=0,tailwindKills=0,dashTimer=0,dashVel=null,orbHoldTimer=0,ultOrbs=[],smokeProjectiles=[],smokeClouds=[],ultKnifeMeshes=[];
function syncAbilityHUD(){
 const cEl=$("ab-c-charges"),qEl=$("ab-q-charges"),eEl=$("ab-e-charges"),xEl=$("ab-x-ult");
 if(cEl)cEl.textContent=abCharges.c+"/2";
 if(qEl)qEl.textContent=abCharges.q+"/1";
 if(eEl)eEl.textContent=tailwindPrimedTimer>0?"PRIMED":(abCharges.e+"/1");
 if(xEl)xEl.textContent=ultKnives>0?("KNIVES: "+ultKnives):(ultPoints+"/8");
}
try{
 const sess=JSON.parse(localStorage.getItem("customfps_session_v1")||"null");
 if(sess&&sess.username)myName=sess.username;
 const params=new URLSearchParams(window.location.search);
 tdmRoomCode=params.get("room");
 if(tdmRoomCode){
  const matches=JSON.parse(localStorage.getItem("customfps_matches_v1")||"{}")||{};
  const room=matches[tdmRoomCode];
  if(room&&room.teams&&room.teams[myName])myTeam=room.teams[myName];
 }
}catch{}
const MOVE_SPEED=6.75, WALK_SPEED=4.5, ARENA=100, DEG2RAD=Math.PI/180, MAX_RECOIL_PITCH_DEG=8, MAX_RECOIL_YAW_DEG=2.5, RECOIL_RETURN_TIME=0.3;
function getRecoilProfile(){
 return {pitchCap:8.0,kickMult:1.6,yawCap:2.5,minYawStep:0.6};
}
function getMovementSpreadDeg(){
 if(!onGround)return 10.0;
 const crouchHeld=!!(keys.ShiftLeft||keys.ShiftRight);
 const walkHeld=!!(keys.ControlLeft||keys.ControlRight);
 const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0);
 const right=(keys.KeyD?1:0)-(keys.KeyA?1:0);
 if(forward===0&&right===0)return 0.0;
 if(crouchHeld)return 0.8;
 if(walkHeld)return 3.0;
 return 6.0;
}
function syncCameraRotation(){
 if(!camera)return;
 camera.rotation.x=Math.max(-1.48,Math.min(1.25,lookPitch-recoilPitchDeg*DEG2RAD));
 camera.rotation.y=lookYaw+recoilYawDeg*DEG2RAD;
}
const catalog=window.CustomFPSWeapons;

function readMatchLoadout(){
 // Session-only: read loadout saved from lobby via sessionStorage.
 // Clears automatically when the tab is closed — no persistent storage.
 try{
  const saved=JSON.parse(sessionStorage.getItem("customfps-loadout")||"null");
  if(saved&&saved.loadout&&catalog.getWeapon(saved.loadout.core)) return catalog.normalizeLoadout(saved.loadout);
 }catch(e){}
 return catalog.defaultLoadout();
}
let matchLoadout,matchPrimary,matchSecondary,matchKnife,activeWeapon,activeSecondary,activeKnife,weaponIndex;
try{
 matchLoadout=Object.freeze(readMatchLoadout());
 matchPrimary=catalog.getWeapon(matchLoadout.core);
 matchSecondary=catalog.getWeapon(matchLoadout.secondary||"classic");
 matchKnife=catalog.getWeapon("knife");
 activeWeapon=Object.freeze(catalog.matchWeapon(matchPrimary));
 activeSecondary=Object.freeze(catalog.matchWeapon(matchSecondary));
 activeKnife=Object.freeze(catalog.matchWeapon(matchKnife));
 weaponIndex=catalog.weapons.indexOf(matchPrimary);
 initNetwork();
}catch(e){
 showError("GAME SETUP ERROR",""+(e.message||String(e)),e.stack);}
try{
 const matchLoadout=Object.freeze(readMatchLoadout());
 const matchPrimary=catalog.getWeapon(matchLoadout.core);
 const matchSecondary=catalog.getWeapon(matchLoadout.secondary||"classic");
 const matchKnife=catalog.getWeapon("knife");
 const activeWeapon=Object.freeze(catalog.matchWeapon(matchPrimary));
 const activeSecondary=Object.freeze(catalog.matchWeapon(matchSecondary));
 const activeKnife=Object.freeze(catalog.matchWeapon(matchKnife));
 const weaponIndex=catalog.weapons.indexOf(matchPrimary);
}catch(e){}
function material(name,color,roughness=1,emissive=null){const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.12,.12);m.roughness=roughness;if(emissive)m.emissiveColor=B.Color3.FromHexString(emissive);return m;}
function block(name,x,y,z,sx,sy,sz,mat){const o=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function flat(name,x,z,sx,sz,y,mat){const o=B.MeshBuilder.CreateGround(name,{width:sx,height:sz,subdivisions:1},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
let weaponModelRoot=null,gunMat,gunAccent,gunDark,gunMetal,gunGrip,gunWood,gunOlive,gunFlash;
let currentWeapon=activeWeapon;
function getCurrentWeapon(){return activeWeaponIndex===0?activeWeapon:activeWeaponIndex===1?activeSecondary:activeKnife;}
function setWeapon(idx){
 activeWeaponIndex=idx;
 currentWeapon=getCurrentWeapon();
 if(currentWeapon.classId !== "melee"){ammo=currentWeapon.mag;}
 syncHUD();
 buildWeaponModel(currentWeapon);
}
function buildWeaponModel(w){
 if(weaponModelRoot)weaponModelRoot.dispose();
 weaponModelRoot=new B.TransformNode("viewmodel "+w.id,scene);weaponModelRoot.parent=gunRoot;weaponModelRoot.position.x=.34;
 const sidearmScale=w.classId==="sidearm"?0.4:1;
 const melee=w.classId==="melee";
 const box=(name,width,height,depth,x,y,z,mat=gunMat)=>{const m=B.MeshBuilder.CreateBox(w.id+" "+name,{width: width*sidearmScale, height: height*sidearmScale, depth: depth*sidearmScale},scene);m.parent=weaponModelRoot;m.position.set(x*sidearmScale,y*sidearmScale,z*sidearmScale);m.material=mat;m.isPickable=false;return m;};
 const tube=(name,diameter,length,x,y,z,mat=gunMetal,segments=12)=>{const m=B.MeshBuilder.CreateCylinder(w.id+" "+name,{height: length*sidearmScale, diameter: diameter*sidearmScale, tessellation: segments},scene);m.parent=weaponModelRoot;m.rotation.x=Math.PI/2;m.position.set(x*sidearmScale,y*sidearmScale,z*sidearmScale);m.material=mat;m.isPickable=false;return m;};
 if(melee){
  const blade=box("knife blade",.025,.38,.08,0,-.06,.52,gunMetal);blade.rotation.x=.35;blade.rotation.z=-.18;
  const guard=box("knife guard",.09,.03,.11,0,-.22,.56,gunAccent);guard.rotation.x=.35;guard.rotation.z=-.18;
  const handle=box("knife handle",.045,.22,.06,0,-.32,.60,gunDark);handle.rotation.x=.35;handle.rotation.z=-.18;
  const pommel=box("knife pommel",.055,.05,.07,0,-.43,.64,gunMetal);pommel.rotation.x=.35;pommel.rotation.z=-.18;
  gun=blade;barrelMesh=null;muzzleFlash=null;
  return;
 }
 const wood=["remington870","svd","pkm","rpk"].includes(w.model);
 const furniture=wood?gunWood:w.model==="aw"?gunOlive:gunGrip;
 const long=["sniper","lmg","shotgun","sidearm"].includes(w.classId), compact=w.classId==="smg";
 const receiverLength=long ? .54 : .48;
 const receiverZ=long ? .72 : .60;
 gunMat.diffuseColor=B.Color3.FromHexString(w.model==="vector"?"#303b3f":"#263238");
 gun=box("receiver",w.model==="m82" ? .27 : .22,w.model==="m82" ? .22 : .17,receiverLength,0,-.27,receiverZ);
 box("upper receiver",.205,.085,receiverLength,0,-.155,receiverZ,gunDark);
 const barrelLength=w.model==="m82" ? .70:w.classId==="sniper" ? .62:w.classId==="lmg" ? .48:w.classId==="shotgun" ? .58:w.classId==="sidearm" ? .22:compact ? .20 : .34;
 const barrelEnd=.34-barrelLength;
 barrelMesh=tube("barrel",w.model==="m82" ? .075 : .052,barrelLength,0,-.23,barrelEnd+barrelLength/2,gunAccent);
 tube("muzzle",w.model==="m82" ? .13 : .08,w.model==="m82" ? .18 : .08,0,-.23,barrelEnd-.025,gunDark);
 if(w.classId==="shotgun"){
  tube("shell tube",.065,barrelLength*.85,0,-.31,.30-barrelLength*.425,gunDark);
  if(w.fireMode==="pump")box("pump fore-end",.19,.14,.25,0,-.29,.10,furniture);
  else box("semi-auto fore-end",.18,.13,.30,0,-.29,.12,gunGrip);
 }else{
  box("handguard",.205,.145,compact ? .25 : .36,0,-.25,.20,furniture);
  for(let i=0;i<4;i++)box("handguard rib "+i,.022,.035,.04,.112,-.25,.08+i*.07,gunMetal);
 }
 box("stock",.18,.18,.28,0,-.29,1.02,furniture);
 box("buttpad",.20,.21,.05,0,-.29,1.18,gunDark);
 tube("buffer tube",.09,.22,0,-.27,.84,gunDark);
 box("cheek rest",.16,.045,.20,0,-.17,1.0,w.model==="svd"?gunWood:gunAccent);
 const grip=box("pistol grip",.12,.24,.15,0,-.46,.72,gunGrip);grip.rotation.x=-.14;
 if(w.classId!=="shotgun"&&w.classId!=="sidearm"){
  const magZ=w.model==="rpk" ? .50 : .48;
  if(w.model==="rpk"){
   const drum=tube("drum magazine",.30,.17,0,-.48,magZ,gunDark,16);drum.rotation.x=0;drum.rotation.z=Math.PI/2;
  }else if(w.classId==="lmg"){
   box("ammunition box",.32,.27,.27,0,-.46,magZ,w.model==="pkm"?gunOlive:gunDark);
   box("box latch",.34,.04,.20,0,-.60,magZ,gunAccent);
  }else{
   const mag=box("magazine",w.model==="vector" ? .16 : .14,compact ? .30 : .28,w.model==="ump45" ? .13 : .18,0,-.48,magZ,gunDark);
   mag.rotation.x=w.model==="svd"?-.30:w.model==="mp5"?-.18:-.06;
   box("magazine base",.16,.04,.19,0,-.63,magZ,gunAccent);
  }
 }
 if(w.model==="vector")box("vector action housing",.24,.25,.28,0,-.36,.43,gunMat);
 if(w.model==="m82")box("heavy muzzle brake",.16,.13,.18,0,-.23,barrelEnd-.04,gunMetal);
 box("top rail",.12,.035,receiverLength*.85,0,-.095,receiverZ,gunDark);
 if(w.zoom>=6){
  tube("precision optic",.12,.32,0,-.015,.57,gunDark);
  tube("optic front lens",.105,.018,0,-.015,.40,gunAccent);
  box("optic mount",.08,.08,.15,0,-.065,.57,gunMetal);
 }else{
  box("front sight",.045,.11,.05,0,-.15,.16,gunDark);
  box("rear sight",.075,.075,.06,0,-.07,.72,gunDark);
 }
 if(w.classId==="lmg"||w.model==="m82"){
  const left=box("bipod left",.035,.28,.035,-.11,-.40,.10,gunMetal);left.rotation.z=-.25;
  const right=box("bipod right",.035,.28,.035,.11,-.40,.10,gunMetal);right.rotation.z=.25;
 }
 muzzleFlash=B.MeshBuilder.CreateSphere(w.id+" muzzle flash",{diameter:w.model==="m82" ? .25 : .18,segments:6},scene);
 muzzleFlash.parent=weaponModelRoot;muzzleFlash.position.set(0,-.23,barrelEnd-.10);
 muzzleFlash.material=gunFlash;muzzleFlash.isVisible=false;muzzleFlash.isPickable=false;
 gunAccent.diffuseColor=B.Color3.FromHexString(w.color);gunAccent.emissiveColor=B.Color3.FromHexString(w.color);
 gunFlash.diffuseColor=B.Color3.FromHexString(w.color);gunFlash.emissiveColor=B.Color3.FromHexString(w.color);
}
function createArena(){
scene=new B.Scene(engine);scene.clearColor=new B.Color4(.5,.72,.82,1);scene.collisionsEnabled=true;scene.gravity=new B.Vector3(0,-18,0);
scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogColor=new B.Color3(.6,.78,.88);scene.fogDensity=.003;
const sky=new B.HemisphericLight("ambient",new B.Vector3(0,1,0),scene);sky.intensity=.95;sky.groundColor=new B.Color3(.3,.38,.42);
const sun=new B.DirectionalLight("sun",new B.Vector3(-.5,-.8,.3),scene);sun.position.set(30,50,-20);sun.intensity=.85;
const ground=material("plain ground","#8a9a85"),wall=material("outer wall","#6b7a72"),siteCover=material("site cover","#5a6a62"),spawnCover=material("spawn cover","#7a8a82"),siteAMat=material("site A mat","#33a1ff",.25,"#1b6ca8"),siteBMat=material("site B mat","#33a1ff",.25,"#1b6ca8");
const stuccoMat=material("town stucco","#8d8273"),brickMat=material("town brick","#7c5b4f"),slateMat=material("town slate","#56656d"),trimMat=material("roof trim","#2f393e"),windowMat=material("window glow","#9ad9ea",.3,"#3c6e7d"),roadMat=material("town road","#495256"),plazaMat=material("town plaza","#636b66");
const skyDome=B.MeshBuilder.CreateSphere("sky dome",{diameter:900,segments:32,ringCount:16},scene);
const skyMat=new B.StandardMaterial("sky dome material",scene);skyMat.backFaceCulling=false;skyMat.disableLighting=true;skyMat.vertexColors=true;skyMat.fogEnabled=false;skyMat.diffuseColor=B.Color3.White();skyMat.emissiveColor=B.Color3.White();
const skyPos=skyDome.getVerticesData(B.VertexBuffer.PositionKind),skyCol=[];
for(let i=0;i<skyPos.length;i+=3){const t=Math.max(0,Math.min(1,(skyPos[i+1]+450)/900));const c=B.Color3.Lerp(new B.Color3(.82,.9,.94),new B.Color3(.3,.5,.7),t);skyCol.push(c.r,c.g,c.b,1);}
skyDome.setVerticesData(B.VertexBuffer.ColorKind,skyCol);skyDome.material=skyMat;skyDome.infiniteDistance=true;skyDome.isPickable=false;
const groundMat=new B.StandardMaterial("arena ground",scene);groundMat.diffuseColor=new B.Color3(.54,.6,.52);groundMat.specularColor=new B.Color3(.04,.04,.04);
const groundMesh=flat("wide flat plain",60,60,120,120,0,groundMat);groundMesh.receiveShadows=true;
const road=(name,x,z,sx,sz,y=.02,mat=roadMat)=>{const r=flat(name,x,z,sx,sz,y,mat);r.checkCollisions=false;r.isPickable=false;return r;};
const building=(name,x,z,w,h,d,mat=stuccoMat)=>{
 const b=block(name,x,h/2,z,w,h,d,mat);
 const roof=B.MeshBuilder.CreateBox(name+" roof",{width:w+.5,height:.45,depth:d+.5},scene);
 roof.position.set(x,h+.22,z);roof.material=trimMat;roof.checkCollisions=false;
 if(h>=8){
  const win=B.MeshBuilder.CreateBox(name+" windows",{width:w+.12,height:.65,depth:d+.12},scene);
  win.position.set(x,Math.min(h-1.8,5.2),z);win.material=windowMat;win.checkCollisions=false;
 }
 return b;
};
const archway=(name,x,z,w,d,mat=trimMat)=>{
 const a=B.MeshBuilder.CreateBox(name,{width:w,height:2.2,depth:d},scene);
 a.position.set(x,6.8,z);a.material=mat;a.checkCollisions=false;return a;
};
// Outer perimeter walls (taller town boundary)
block("north wall",60,5,120,120,10,1.2,wall);
block("south wall",60,5,0,120,10,1.2,wall);
block("west wall",2,5,60,4,10,120,wall);
block("east wall",118,5,60,4,10,120,wall);

// Paved town streets and plazas
road("main mid street",60,60,92,8,.02,roadMat);
road("north street",60,22,76,7,.02,roadMat);
road("south street",60,98,76,7,.02,roadMat);
road("west connector road",26,60,7,76,.02,roadMat);
road("east connector road",94,60,7,76,.02,roadMat);
road("mid cross street",60,60,8,76,.02,roadMat);
road("central plaza",60,60,22,22,.025,plazaMat);
road("site A plaza",34,22,16,16,.025,plazaMat);
road("site B plaza",86,98,16,16,.025,plazaMat);

// Attacker spawn (East, red ground + recessed side walls)
road("attacker spawn ground",112,60,10,10,0.05,material("attacker spawn ground","#ff4444",.6));
building("attacker spawn north wall",110,68,10,8,3,spawnCover);
building("attacker spawn south wall",110,52,10,8,3,spawnCover);
building("attacker spawn gatehouse",99,60,5,9,10,brickMat);
archway("attacker north arch",104,64,6,3,trimMat);
archway("attacker south arch",104,56,6,3,trimMat);

// Defender spawn (West, blue ground + recessed side walls)
road("defender spawn ground",8,60,10,10,0.05,material("defender spawn ground","#33a1ff",.6));
building("defender spawn north wall",10,68,10,8,3,spawnCover);
building("defender spawn south wall",10,52,10,8,3,spawnCover);
building("defender spawn gatehouse",21,60,5,9,10,slateMat);
archway("defender north arch",16,64,6,3,trimMat);
archway("defender south arch",16,56,6,3,trimMat);

// Spike Sites — smaller blue rectangular prisms + compact site pad markers
road("site A pad",34,22,5.5,5.5,0.04,material("site A pad mat","#204e7a",.7));
block("site A",34,1.4,22,1.6,2.8,1.6,siteAMat);
road("site B pad",86,98,5.5,5.5,0.04,material("site B pad mat","#204e7a",.7));
block("site B",86,1.4,98,1.6,2.8,1.6,siteBMat);

// --- Site A District (North-West Town Square & Hallways) ---
building("A north hall",34,10,18,10,5,stuccoMat);
building("A west tower",18,22,7,12,16,slateMat);
building("A southwest corner",22,36,8,9,8,brickMat);
building("A south hall",36,35,10,8,5,stuccoMat);
building("A east longhouse",47,22,6,10,15,brickMat);
archway("A north entry arch",42,13,6,3,trimMat);
archway("A south entry arch",42,32,6,3,trimMat);

// --- North-Mid & North-East Town District (Hallways linking East Spawn -> A) ---
building("north mid apartments",62,12,14,11,7,stuccoMat);
building("north alley block",62,28,12,9,7,slateMat);
building("northeast watchtower",80,14,10,12,8,brickMat);
building("northeast market hall",82,30,10,9,9,stuccoMat);
building("east north corner",102,24,10,10,12,slateMat);
building("east mid-north block",90,44,8,9,8,stuccoMat);
archway("north street arch",62,20,4,7,trimMat);

// --- Central Town Square & Mid Hallways ---
building("central clocktower",60,60,4.5,14,4.5,brickMat);
building("mid northwest building",46,48,9,10,9,stuccoMat);
building("mid northeast building",74,48,9,9,9,slateMat);
building("mid southwest building",46,72,9,9,9,slateMat);
building("mid southeast building",74,72,9,10,9,stuccoMat);
building("west mid hall",32,48,7,8,9,brickMat);
building("west south hall",30,76,8,9,9,stuccoMat);
building("east mid hall",88,72,7,8,9,brickMat);
archway("mid west arch",46,60,3,8,trimMat);
archway("mid east arch",74,60,3,8,trimMat);

// --- South-West & South-Mid Town District (Hallways linking West Spawn -> B) ---
building("southwest warehouse",18,96,10,10,12,slateMat);
building("southwest watchtower",40,106,10,12,8,brickMat);
building("south market hall",38,90,10,9,9,stuccoMat);
building("south alley block",58,92,12,9,7,slateMat);
building("south mid apartments",58,108,14,11,7,stuccoMat);
archway("south street arch",58,100,4,7,trimMat);

// --- Site B District (South-East Town Square & Hallways) ---
building("B south hall",86,110,18,10,5,stuccoMat);
building("B east tower",102,98,7,12,16,slateMat);
building("B northeast corner",98,84,8,9,8,brickMat);
building("B north hall",84,85,10,8,5,stuccoMat);
building("B west longhouse",73,98,6,10,15,brickMat);
archway("B north entry arch",78,88,6,3,trimMat);
archway("B south entry arch",78,107,6,3,trimMat);

// Tactical wooden crates & low cover boxes across streets and sites
const crateMat=material("crate wood","#6f4f2e");crateMat.edgesWidth=.04;crateMat.edgesColor=new B.Color3(.22,.15,.08);
[
 [28,17,1.8],[39,27,1.8],[29,28,1.6],[54,22,2.0],[72,22,1.8],[94,36,2.0],
 [53,55,1.8],[67,65,1.8],[53,65,1.6],[67,55,1.6],[38,60,2.0],[82,60,2.0],
 [26,84,2.0],[48,98,1.8],[66,98,2.0],[81,93,1.8],[91,103,1.8],[91,92,1.6]
].forEach((c,i)=>block("crate "+i,c[0],c[2]/2,c[1],c[2],c[2],c[2],crateMat));
camera=new B.UniversalCamera("player camera",new B.Vector3(112,1.7,60),scene);camera.inertia=0;camera.angularSensibility=2400;camera.speed=0;camera.minZ=.08;camera.fov=baseFov=Math.PI/2.8;camera.checkCollisions=true;camera.applyGravity=false;camera.ellipsoid=new B.Vector3(.35,.85,.35);camera.ellipsoidOffset=new B.Vector3(0,.8,0);camera.inputs.clear();
lookPitch=0;lookYaw=Math.PI;recoilPitchDeg=0;recoilYawDeg=0;recoilHoldTimer=0;syncCameraRotation();scene.activeCamera=camera;
gunMat=material("weapon graphite body","#263238");gunAccent=material("weapon accent",currentWeapon.color,.45,currentWeapon.color);
gunDark=material("weapon dark components","#11191e");gunMetal=material("weapon metal","#7b898b");gunGrip=material("weapon grip","#35464a");
gunWood=material("weapon wood furniture","#795033");gunOlive=material("weapon olive furniture","#566344");gunFlash=material("weapon muzzle flash",currentWeapon.color,.5,currentWeapon.color);
gunRoot=new B.TransformNode("weapon viewmodel root",scene);gunRoot.parent=camera;
buildWeaponModel(currentWeapon);
if(!tdmRoomCode){createTargets();}
spawnUltOrbs();
syncAbilityHUD();
const shadowGen=new B.ShadowGenerator(1024,sun);
shadowGen.useBlurExponentialShadowMap=true;shadowGen.blurKernel=8;shadowGen.darkness=.4;
scene.meshes.forEach(m=>{
 if(m.name==="sky dome"||m.name==="player camera"||m.name.startsWith("health bar"))return;
 let par=m.parent;while(par){if(par===camera)return;par=par.parent;}
 m.receiveShadows=true;
 if(m.name!=="wide flat plain")shadowGen.addShadowCaster(m);
});
try{
 const pp=new B.DefaultRenderingPipeline("default",true,engine,[camera]);
 pp.bloomEnabled=true;pp.bloomWeight=.22;pp.bloomThreshold=.75;pp.bloomKernel=64;pp.bloomScale=.5;
 pp.vignetteEnabled=true;pp.vignetteWeight=1.1;pp.vignetteColor=new B.Color4(0,0,0,.35);
}catch(e){console.warn("Post-processing unavailable:",e);}
 return scene;
}
function spawnUltOrbs(){
 ultOrbs=[];
 for(let i=0;i<3;i++){
  const ox=26+Math.random()*32; // middle, biased toward defender side (West x=8..60)
  const oz=36+Math.random()*48;
  const mesh=B.MeshBuilder.CreateSphere("ult orb "+i,{diameter:.45,segments:10},scene);
  mesh.position.set(ox,0.35,oz);
  mesh.material=material("ult orb mat "+i,"#050507",.1,"#111118");
  mesh.isPickable=false;
  ultOrbs.push({mesh,active:true,respawnTimer:0});
 }
}
function spawnSmokeCloud(pos){
 const cloud=B.MeshBuilder.CreateSphere("smoke cloud",{diameter:5.5,segments:12},scene);
 cloud.position.copyFrom(pos);
 const mat=new B.StandardMaterial("smoke mat",scene);
 mat.diffuseColor=B.Color3.FromHexString("#94a3b8");
 mat.emissiveColor=B.Color3.FromHexString("#334155");
 mat.alpha=1.0;
 cloud.material=mat;
 cloud.isPickable=false;
 smokeClouds.push({mesh:cloud,timer:2.5});
}
function useAbilityC(){
 if(abCharges.c<=0){showToast("NO CLOUDBURST CHARGES");return;}
 abCharges.c--;syncAbilityHUD();
 const proj=B.MeshBuilder.CreateSphere("smoke proj",{diameter:.45,segments:8},scene);
 proj.position.copyFrom(camera.position).addInPlace(camera.getDirection(B.Axis.Z).scale(1.1));
 proj.material=material("smoke proj mat","#cbd5e1",.5,"#7dd3fc");
 proj.isPickable=false;
 smokeProjectiles.push({mesh:proj,dir:camera.getDirection(B.Axis.Z).normalize(),timer:2.5,steerTimer:2.0,steering:true});
}
function useAbilityQ(){
 if(abCharges.q<=0){showToast("NO UPDRAFT CHARGES");return;}
 abCharges.q--;syncAbilityHUD();
 jumpVelocity=17.0;onGround=false;
 showToast("UPDRAFT");
}
function useAbilityE(){
 if(tailwindPrimedTimer>0){
  tailwindPrimedTimer=0;
  abCharges.e=Math.max(0,abCharges.e-1);
  syncAbilityHUD();
  const fwd=camera.getDirection(B.Axis.Z);fwd.y=0;if(fwd.length()>0.01)fwd.normalize();
  const rgt=camera.getDirection(B.Axis.X);rgt.y=0;if(rgt.length()>0.01)rgt.normalize();
  const moveF=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  const moveR=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  let dashDir=(moveF===0&&moveR===0)?fwd:fwd.scale(moveF).add(rgt.scale(moveR)).normalize();
  dashVel=dashDir.scale(38);
  dashTimer=0.22;
  showToast("TAILWIND DASH");
  return;
 }
 if(abCharges.e<=0){showToast("TAILWIND ON COOLDOWN (2 KILLS)");return;}
 tailwindPrimedTimer=7.0;syncAbilityHUD();
 showToast("TAILWIND PRIMED — PRESS E TO DASH");
}
function updateUltKnifeVisuals(){
 ultKnifeMeshes.forEach(m=>{if(m&&!m.isDisposed())m.dispose();});
 ultKnifeMeshes=[];
 if(ultKnives<=0)return;
 for(let i=0;i<ultKnives;i++){
  const angle=((i-(ultKnives-1)/2)/Math.max(1,ultKnives-1))*Math.PI*0.85;
  const k=B.MeshBuilder.CreateBox("ult knife "+i,{width:.035,height:.015,depth:.28},scene);
  k.parent=camera;
  k.position.set(Math.sin(angle)*0.32,-0.16+Math.cos(angle)*0.08,0.55);
  k.rotation.z=-angle*0.4;
  k.material=material("ult knife mat "+i,"#e0f2fe",.9,"#38bdf8");
  k.isPickable=false;
  ultKnifeMeshes.push(k);
 }
}
function useAbilityX(){
 if(ultKnives>0){showToast("BLADE SPIN ALREADY ACTIVE");return;}
 if(ultPoints<8){showToast("NEED 8 ULT POINTS ("+ultPoints+"/8)");return;}
 ultPoints-=8;ultKnives=5;updateUltKnifeVisuals();syncAbilityHUD();
 showToast("BLADE SPIN — 5 KNIVES EQUIPPED");
}
function createTargets(){
 targets=[];
 const spots=[[29,1.1,22],[39,1.1,21],[56,1.1,42],[64,1.1,78],[81,1.1,99],[91,1.1,97]];
 spots.forEach((v,i)=>{
  const root=new B.TransformNode("drone root "+i,scene);root.position.set(v[0],v[1],v[2]);
  const shell=material("drone shell "+i,"#52666a");
  const body=B.MeshBuilder.CreateSphere("drone body",{diameter:.9,segments:10},scene);body.parent=root;body.material=shell;body.isPickable=true;
  const headMat=material("drone head mat "+i,"#f1bd63",.4,"#f1bd63");
  const head=B.MeshBuilder.CreateSphere("drone head",{diameter:.42,segments:8},scene);head.parent=root;head.position.y=.42;head.material=headMat;head.isPickable=true;
  const eye=B.MeshBuilder.CreateBox("drone eye",{width:.38,height:.08,depth:.08},scene);eye.parent=head;eye.position.y=.0;eye.position.z=-.22;eye.material=material("drone eye glow "+i,"#b7f34a",.4,"#b7f34a");eye.isPickable=false;
  const legsMat=material("drone legs mat "+i,"#8c9ea8",.4,"#8c9ea8");
  const legs=B.MeshBuilder.CreateCylinder("drone legs",{diameter:.42,height:.34,tessellation:8},scene);legs.parent=root;legs.position.y=-.42;legs.rotation.x=Math.PI/2;legs.material=legsMat;legs.isPickable=true;
  const ring=B.MeshBuilder.CreateTorus("drone ring",{diameter:1.15,thickness:.045,tessellation:12},scene);ring.parent=root;ring.rotation.x=Math.PI/2;ring.material=material("drone ring mat "+i,"#b7f34a",.4,"#273b0c");ring.isPickable=true;
  const barRoot=new B.TransformNode("health bar root "+i,scene);barRoot.parent=root;barRoot.position.set(0,.9,0);
  const back=B.MeshBuilder.CreatePlane("health bar backing "+i,{width:1.35,height:.14},scene);back.parent=barRoot;back.position.z=-.04;back.billboardMode=B.Mesh.BILLBOARDMODE_ALL;back.material=material("health bar dark "+i,"#142024");back.isPickable=false;
  const fill=B.MeshBuilder.CreatePlane("health bar fill "+i,{width:1.25,height:.075},scene);fill.parent=barRoot;fill.position.z=-.02;fill.billboardMode=B.Mesh.BILLBOARDMODE_ALL;fill.material=material("health bar fill mat "+i,"#70ed63",.5,"#285d20");fill.isPickable=false;
  targets.push({root,body,head,legs,alive:true,hp:100,maxHp:100,phase:i*1.2,baseY:v[1],barRoot,barFill:fill});
 });
}
function setMpStatus(text,cls){const el=$("mp-status");if(!el)return;el.textContent=text;el.className="mp-status"+(cls?(" "+cls):"");}
function initNetwork(){
 try{ if(window.io) netSocket=window.io(); }catch(e){ netSocket=null; }
 if(!netSocket){setMpStatus("OFFLINE · LOCAL SIMULATION","connecting");return;}
 setMpStatus("CONNECTING…","connecting");
 netSocket.on("connect",()=>{setMpStatus("ONLINE · "+mpCount+" PLAYERS","");});
 netSocket.on("disconnect",()=>{setMpStatus("RECONNECTING…","connecting");});
 netSocket.on("hello",info=>{if(info&&info.name)myName=info.name;if(info&&info.playerCount)mpCount=info.playerCount;});
 netSocket.on("player:join",()=>{mpCount++;setMpStatus("ONLINE · "+mpCount+" PLAYERS","");});
 netSocket.on("player:leave",info=>{if(info&&info.id)removeRemotePlayer(info.id);mpCount=Math.max(1,mpCount-1);setMpStatus("ONLINE · "+mpCount+" PLAYERS","");});
 netSocket.on("player:update",data=>updateRemotePlayer(data));
}
function sendPlayerState(){
 if(!netSocket||!started||paused||!camera)return;
 const now=performance.now();
 if(now-netLastSend<33)return;
 netLastSend=now;
 try{
  netSocket.emit("state",{
   x:camera.position.x,y:camera.position.y,z:camera.position.z,
   rotY:camera.rotation.y,rotX:camera.rotation.x,
   health,ammo,weaponIndex,kills,name:myName
  });
 }catch(e){}
}
function remoteColor(i){const core=catalog.weapons[i];return core?catalog.getClass(core.classId).color:"#b7f34a";}
function createRemotePlayer(data){
 const id=data.id, color=remoteColor(data.weaponIndex||0);
 const root=new B.TransformNode("remote "+id,scene);
 const bodyMat=material("remote body "+id,"#2b3b40");
 const accentMat=material("remote accent "+id,color,.5,color);
 const body=B.MeshBuilder.CreateBox("remote body mesh "+id,{width:.6,height:1.0,depth:.35},scene);body.parent=root;body.material=bodyMat;body.isPickable=false;
 const head=B.MeshBuilder.CreateSphere("remote head "+id,{diameter:.5,segments:8},scene);head.parent=root;head.position.y=.62;head.material=bodyMat;head.isPickable=false;
 const gunMesh=B.MeshBuilder.CreateBox("remote gun "+id,{width:.08,height:.08,depth:.6},scene);gunMesh.parent=root;gunMesh.position.set(.22,0,.30);gunMesh.rotation.x=Math.PI/2.2;gunMesh.material=accentMat;gunMesh.isPickable=false;
 const barRoot=new B.TransformNode("remote bar "+id,scene);barRoot.parent=root;barRoot.position.set(0,1.35,0);
 const back=B.MeshBuilder.CreatePlane("remote bar back "+id,{width:1.0,height:.12},scene);back.parent=barRoot;back.position.z=-.04;back.billboardMode=B.Mesh.BILLBOARDMODE_ALL;back.material=material("remote bar dark "+id,"#142024");back.isPickable=false;
 const fill=B.MeshBuilder.CreatePlane("remote bar fill "+id,{width:.92,height:.07},scene);fill.parent=barRoot;fill.position.z=-.02;fill.billboardMode=B.Mesh.BILLBOARDMODE_ALL;fill.material=material("remote bar fill mat "+id,"#70ed63",.5,"#285d20");fill.isPickable=false;
 const p={root,body,head,gunMesh,barRoot,barFill:fill,hp:data.health||100,maxHp:100,weaponIndex:data.weaponIndex||0,kills:data.kills||0,name:data.name||"Operator"};
 updateRemoteBar(p);
 return p;
}
function updateRemoteBar(p){
 const ratio=Math.max(0,p.hp/p.maxHp);
 if(p.barFill){
  p.barFill.scaling.x=ratio;
  p.barFill.position.x=-(1-ratio)*.46;
  p.barFill.material.diffuseColor=ratio>.6?B.Color3.FromHexString("#70ed63"):ratio>.3?B.Color3.FromHexString("#ffd45a"):B.Color3.FromHexString("#ff6262");
  p.barFill.material.emissiveColor=p.barFill.material.diffuseColor.scale(.25);
 }
}
function updateRemotePlayer(data){
 if(!data||!data.id)return;
 const hasPos=data.x!==undefined&&data.y!==undefined&&data.z!==undefined;
 let p=remotes.get(data.id);
 if(hasPos&&!p){p=createRemotePlayer(data);remotes.set(data.id,p);}
 if(!p)return;
 if(data.name)p.name=data.name;
 if(data.weaponIndex!==undefined)p.weaponIndex=data.weaponIndex;
 if(data.kills!==undefined)p.kills=data.kills;
 if(hasPos)p.root.position.set(data.x,data.y,data.z);
 if(data.rotY!==undefined)p.root.rotation.y=data.rotY;
 if(p.head&&data.rotX!==undefined)p.head.rotation.x=Math.max(-1,Math.min(1,data.rotX));
 if(data.health!==undefined){p.hp=data.health;updateRemoteBar(p);}
}
function removeRemotePlayer(id){
 const p=remotes.get(id);
 if(!p)return;
 remotes.delete(id);
 try{p.root.dispose(true,true);}catch(e){}
}
function showToast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),1300);}
function showError(title,msg,stack){
 try{
  const el=$("engine-error");
  if(el){
   el.classList.remove("hide");
   el.style.cssText="display:flex!important;z-index:99999!important;";
   $("error-title").textContent=title||"Game Error";
   $("error-message").textContent=msg||"An unknown error occurred.";
   if(stack){$("error-details").style.display="block";$("error-stack").textContent=stack;}else{$("error-details").style.display="none";}
  }
  canvas.style.backgroundColor="#330000";
 }catch(e){}
 alert("GAME ERROR: "+title+"\n"+(msg||"An unknown error occurred."));
 console.error(title,msg,stack);
}
function syncHUD(){
 const w=currentWeapon;
 const total=Math.min(health+shield,150);const pct=Math.min(total/150*100,100);const hpPct=Math.min(health/150*100,100);
 $("health").textContent=health;$("hpbar").style.width=pct+"%";
 if(shield>0){$("hpbar").style.background="linear-gradient(to right,#b7f34a "+hpPct+"%,#4cc9f0 "+hpPct+"%,#4cc9f0 100%)";}else{$("hpbar").style.background="#b7f34a";}
 if($("credits"))$("credits").textContent=credits;
 $("ammo").textContent=ammo;
 $("objective").textContent="Eliminate training drones · "+kills+" / 6";
 $("weapon-name").textContent=w.name;
 $("weapon-class").textContent=catalog.getClass(w.classId).name+" · SLOT "+(activeWeaponIndex===0?"PRIMARY":"SECONDARY");
 if($("deployed-weapon"))$("deployed-weapon").textContent=w.name;
 $("weapon-stats").textContent=w.damage+(w.pellets>1?" × "+w.pellets:"")+" DMG · "+Math.round(60/w.rate)+" RPM · "+w.fireMode.toUpperCase();
 const ammoMax=document.querySelector(".hud em");if(ammoMax)ammoMax.textContent=" / "+w.mag;
 const reloadButton=$("reload");
 reloadButton.disabled=reloading;
 reloadButton.textContent=reloading?(w.classId==="shotgun"?"LOADING SHELLS…":"RELOADING…"):"RELOAD [R]";
 reloadButton.setAttribute("aria-busy",String(reloading));
}
function resetGame(){remotes.forEach((v,k)=>removeRemotePlayer(k));aimHeld=false;aimZoom=1;if(gunRoot){gunRoot.position.set(0,0,0);gunRoot.rotation.set(0,0,0);}if(camera)camera.fov=baseFov;$("scope-overlay").classList.add("hide");$("reticle").classList.remove("hide");health=100;shield=maxShield;kills=0;activeWeaponIndex=0;currentWeapon=activeWeapon;ammo=currentWeapon.mag;reloading=false;reloadTimer=0;fireCooldown=0;burstRemaining=0;burstTimer=0;recoilKick=0;gunKick=0;spreadKick=0;firingSpreadDeg=0;lookPitch=0;lookYaw=Math.PI;recoilPitchDeg=0;recoilYawDeg=0;recoilHoldTimer=0;crouched=false;
const spawnX=myTeam==="blue"?8:112;
const spawnYaw=myTeam==="blue"?0:Math.PI;
lookYaw=spawnYaw;
camera.position.set(spawnX,1.7,60);syncCameraRotation();
if(tdmRoomCode){showToast("TDM MATCH ("+tdmRoomCode+") — "+myTeam.toUpperCase()+" TEAM");}jumpVelocity=0;onGround=true;targets.forEach(t=>{t.alive=true;t.hp=t.maxHp;t.root.setEnabled(true);updateTargetBar(t);});syncHUD();}
function updateTargetBar(t){const ratio=Math.max(0,t.hp/t.maxHp);t.barFill.scaling.x=ratio;t.barFill.position.x=-(1-ratio)*.625;t.barFill.material.diffuseColor=ratio>.6?B.Color3.FromHexString("#70ed63"):ratio>.3?B.Color3.FromHexString("#ffd45a"):B.Color3.FromHexString("#ff6262");t.barFill.material.emissiveColor=t.barFill.material.diffuseColor.scale(.25);}
function startGame(){
 try{
  if(!scene){showError("Scene not ready","The 3D scene failed to load. Refresh the page.");return;}
  started=true;paused=false;
  try{$("intro").style.display="none";}catch(e){showError("Intro hide failed",""+e.message);}
  try{$("pausemenu").style.display="none";}catch(e){}
  try{canvas.focus();}catch(e){}
  try{Promise.resolve(canvas.requestPointerLock?.()).catch(()=>{});}catch(e){}
  try{showToast("Click and drag to look around");}catch(e){}
 }catch(e){showError("startGame failed",""+e.message,e.stack);}
}
window.gameStartGame=startGame;
function togglePause(){if(!started)return;paused=!paused;$("pausemenu").classList.toggle("hide",!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&canvas.requestPointerLock)Promise.resolve(canvas.requestPointerLock()).catch(()=>{});}
function endGame(win){paused=true;$("endtitle").textContent=win?"TEST COMPLETE":"OPERATOR DOWN";$("endcopy").textContent=win?"All five training drones eliminated. Arena clear.":"You were tagged out during testing. Reset and try again.";$("endmenu").classList.remove("hide");if(document.pointerLockElement)document.exitPointerLock();}
function leave(){if(document.pointerLockElement)document.exitPointerLock();location.href="index.html";}
function showDamagePopup(amount){
 let el=$("damage-popup");
 if(!el){
  el=document.createElement("div");el.id="damage-popup";
  Object.assign(el.style,{position:"absolute",left:"50%",top:"calc(50% - 42px)",transform:"translate(-50%,-50%)",zIndex:"5",font:"900 20px Inter,system-ui,sans-serif",letterSpacing:".04em",color:"#fff",textShadow:"0 2px 5px #000,0 0 8px #000",pointerEvents:"none",opacity:"0",transition:"opacity .08s"});
  document.body.appendChild(el);
 }
 el.textContent="-"+Math.round(amount);
 el.style.opacity="1";
 clearTimeout(el._hideTimer);
 el._hideTimer=setTimeout(()=>{el.style.opacity="0";},650);
}
function showImpactDot(point,normal){
 const dot=B.MeshBuilder.CreateSphere("temporary bullet impact",{diameter:.095,segments:6},scene);
 const mat=new B.StandardMaterial("black bullet impact material",scene);
 mat.diffuseColor=B.Color3.Black();mat.emissiveColor=B.Color3.Black();mat.disableLighting=true;
 dot.material=mat;dot.isPickable=false;
 dot.position.copyFrom(point);
 if(normal)dot.position.addInPlace(normal.scale(.035));
 setTimeout(()=>{if(!dot.isDisposed())dot.dispose();mat.dispose();},1800);
}
function calcDamage(w,location,distance){
 let base;
 if(location==="head")base=w.headshot||w.damage;
 else if(location==="legs")base=w.legs||w.damage;
 else base=w.damage;
 if(w.damageBrackets){
  for(const br of w.damageBrackets){
   if(distance>=br.start&&distance<=br.end){
    base=location==="head"?br.headshot:location==="legs"?br.legs:br.body;
    break;
   }
  }
 }else if(w.damageDrop&&distance>w.rangeStart&&distance<w.rangeEnd){
  const t=(distance-w.rangeStart)/(w.rangeEnd-w.rangeStart);
  const min=location==="head"?w.minHeadshot:location==="legs"?w.minLegs:w.minBody;
  base=base+(min-base)*t;
 }
 return base*(w.pellets||1);
}
function shoot(){
 if(!started||paused||fireCooldown>0)return;
 const w=getCurrentWeapon();
 if(reloading){
  if(w.classId==="shotgun"&&ammo>0){reloading=false;reloadTimer=0;syncHUD();}else return;
 }
 if(w.classId==="melee"){
  // Knife melee swing
  fireCooldown=60/w.rate;
  gunKick=Math.min(.22,gunKick+.18);
  syncHUD();
  const ray=camera.getForwardRay(w.range);
  const pick=scene.pickWithRay(ray,m=>m.isPickable&&m.parent!==camera&&m.name!=="skybox"&&!m.name.startsWith("health bar"));
  const hitPoint=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint:ray.origin.add(ray.direction.scale(w.range));
  let target=null,hitLocation="body";
  if(pick&&pick.hit&&pick.pickedMesh){
   const mesh=pick.pickedMesh;
   target=targets.find(t=>t.alive&&(mesh===t.body||mesh===t.head||mesh===t.legs||mesh.parent===t.root));
   if(target){
    if(mesh===target.head)hitLocation="head";
    else if(mesh===target.legs)hitLocation="legs";
    else hitLocation="body";
   }
  }
  if(target){
   const dx=camera.position.x-target.root.position.x;const dy=camera.position.y-target.root.position.y;const dz=camera.position.z-target.root.position.z;const distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
   const damage=calcDamage(w,hitLocation,distance);
   target.hp=Math.max(0,target.hp-damage);updateTargetBar(target);
   if(target.hp===0){target.alive=false;target.root.setEnabled(false);kills++;syncHUD();showToast("DRONE ELIMINATED");}
  }
  return;
 }
 if(w.classId !== "melee"){
  if(ammo<=0){reload();mouseHeld=false;return;}
  ammo--;
}
 const isBurstShot=burstRemaining>0&&w.adsRate;
 fireCooldown=isBurstShot?(60/w.adsRate):w.rate;
 const baseRay=camera.getForwardRay(w.range);
 const baseSpreadDeg=aimHeld?(w.adsFirstShotSpread??0):(w.firstShotSpread??0);
 const maxSpreadDeg=aimHeld?w.adsMaxSpread:w.maxSpread;
 const bloomDeg=(maxSpreadDeg!==null&&maxSpreadDeg!==undefined&&maxSpreadDeg>baseSpreadDeg)?Math.min(maxSpreadDeg-baseSpreadDeg,firingSpreadDeg):0;
 const totalSpreadDeg=baseSpreadDeg+bloomDeg+getMovementSpreadDeg();
 const spreadRad=totalSpreadDeg*DEG2RAD;
 const spreadAngle=Math.random()*Math.PI*2;
 const spreadMag=Math.sqrt(Math.random())*spreadRad;
 const camRight=camera.getDirection(B.Axis.X);
 const camUp=camera.getDirection(B.Axis.Y);
 const shotDir=baseRay.direction.add(camRight.scale(Math.cos(spreadAngle)*Math.sin(spreadMag))).add(camUp.scale(Math.sin(spreadAngle)*Math.sin(spreadMag))).normalize();
 const ray=new B.Ray(baseRay.origin,shotDir,w.range);
 if(maxSpreadDeg!==null&&maxSpreadDeg!==undefined&&maxSpreadDeg>baseSpreadDeg){
  firingSpreadDeg=Math.min(maxSpreadDeg-baseSpreadDeg,firingSpreadDeg+(maxSpreadDeg-baseSpreadDeg)/5);
 }
 const pick=scene.pickWithRay(ray,m=>m.isPickable&&m.parent!==camera&&m.name!=="skybox"&&!m.name.startsWith("health bar"));
 const hitPoint=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint:ray.origin.add(ray.direction.scale(w.range));
 const hitNormal=pick&&pick.hit&&pick.getNormal?pick.getNormal(true):null;
 gunKick=Math.min(.22,gunKick+.12+w.recoil);
 recoilKick=Math.min(.16,recoilKick+w.recoil);
 spreadKick=Math.min(.12,spreadKick+w.spread);
 if(muzzleFlash){
  muzzleFlash.isVisible=true;
  const flash=muzzleFlash;setTimeout(()=>{if(flash&&!flash.isDisposed())flash.isVisible=false;},55);
 }
 syncHUD();
 // Recoil add-on (tracked separately from lookPitch/lookYaw, scaled by movement state):
 // - Running & moving: +1.6 deg/shot on Vandal -> +8.0 deg cap in 5 shots, ±2.5 deg yaw at cap
 // - Walking & moving: +1.1 deg/shot on Vandal -> +5.5 deg cap in 5 shots, ±1.65 deg yaw at cap
 // - Stationary or crouched: +0.6 deg/shot on Vandal -> +3.0 deg cap in 5 shots, ±0.8 deg yaw at cap
 const profile=getRecoilProfile();
 const kickDeg=(w.recoil/0.014)*profile.kickMult;
 if(recoilPitchDeg<profile.pitchCap-1e-6){
  recoilPitchDeg=Math.min(profile.pitchCap,recoilPitchDeg+kickDeg);
  if(recoilPitchDeg>=profile.pitchCap-1e-6)recoilPitchDeg=profile.pitchCap;
 }else{
  recoilPitchDeg=Math.min(MAX_RECOIL_PITCH_DEG,Math.max(profile.pitchCap,recoilPitchDeg));
  let nextYaw=(Math.random()*2-1)*profile.yawCap;
  if(Math.abs(nextYaw-recoilYawDeg)<profile.minYawStep){
   nextYaw=recoilYawDeg+(recoilYawDeg>=0?-1:1)*(profile.minYawStep*1.3+Math.random()*profile.minYawStep);
   nextYaw=Math.max(-profile.yawCap,Math.min(profile.yawCap,nextYaw));
  }
  recoilYawDeg=nextYaw;
 }
 recoilPeakPitch=Math.max(recoilPitchDeg,profile.pitchCap);
 recoilPeakYaw=Math.max(Math.abs(recoilYawDeg),profile.yawCap);
 recoilHoldTimer=Math.min(0.22,Math.max(fireCooldown+0.04,0.10));
 syncCameraRotation();
 const tracerColor = w.suppressed ? "#11191e" : w.color;
 const muzzle= camera.getDirection(B.Axis.Z);
 const origin=camera.position.add(muzzle.scale(.55));
 const tracer=B.MeshBuilder.CreateLines("bullet tracer",{points:[origin,hitPoint]},scene);
 tracer.color=B.Color3.FromHexString(tracerColor);tracer.alpha=.95;tracer.isPickable=false;
 setTimeout(()=>{if(!tracer.isDisposed())tracer.dispose();},85);
 let target=null,hitLocation="body";
 if(pick&&pick.hit&&pick.pickedMesh){
  const mesh=pick.pickedMesh;
  target=targets.find(t=>t.alive&&(mesh===t.body||mesh===t.head||mesh===t.legs||mesh.parent===t.root));
  if(target){
   if(mesh===target.head)hitLocation="head";
   else if(mesh===target.legs)hitLocation="legs";
   else hitLocation="body";
  }
 }
 if(target){
  const dx=camera.position.x-target.root.position.x;const dy=camera.position.y-target.root.position.y;const dz=camera.position.z-target.root.position.z;const distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
  const damage=calcDamage(w,hitLocation,distance);
  target.hp=Math.max(0,target.hp-damage);updateTargetBar(target);showDamagePopup(Math.round(damage));
  if(target.hp<=0){
   target.alive=false;target.root.setEnabled(false);kills++;syncHUD();showToast("DRONE ELIMINATED");
   if(kills===6)endGame(true);
  }else{
   $("objective").textContent="Eliminate training drones · "+kills+" / 6";
  }
 }else if(pick&&pick.hit&&pick.pickedPoint){
  showImpactDot(hitPoint,hitNormal);
 }
}
function altFire(){
 if(!started||paused||fireCooldown>0||reloading)return;const w=getCurrentWeapon();if(w.classId==="melee")return;
 if(!w.altFireMode)return;
 if(ammo<=0){showToast("EMPTY MAGAZINE — PRESS R");mouseHeld=false;return;}
 ammo--;
 burstRemaining=w.altFireBurst;
 fireCooldown=60/w.rate;
 syncHUD();
}
function reload(){const w=getCurrentWeapon();if(!started||paused||reloading||w.classId==="melee"||ammo===w.mag)return;reloading=true;reloadTimer=w.reload;syncHUD();showToast(w.classId==="shotgun"?"LOADING SHELLS…":"RELOADING…");}
function update(dt){
 if(!started||paused)return;
 const cooldownRemaining=fireCooldown-dt;
 fireCooldown=Math.max(0,cooldownRemaining);
 if(burstRemaining>0&&!reloading&&cooldownRemaining<=1e-9){
  shoot();
  if(fireCooldown>0)fireCooldown=Math.max(0,fireCooldown+Math.min(0,cooldownRemaining));
 }
 if((mouseHeld||eHeld)&&getCurrentWeapon().automatic&&!reloading&&burstRemaining===0&&cooldownRemaining<=1e-9){
  shoot();
  if(fireCooldown>0)fireCooldown=Math.max(0,fireCooldown+Math.min(0,cooldownRemaining));
 }
 if(reloading){
  reloadTimer-=dt;
  if(reloadTimer<=0){
   const w=getCurrentWeapon();
   ammo=w.classId==="shotgun"?Math.min(w.mag,ammo+1):w.mag;
   if(ammo===w.mag){reloading=false;reloadTimer=0;showToast(w.classId==="shotgun"?"SHELL TUBE LOADED":"MAGAZINE RELOADED");}
   else reloadTimer+=w.reload;
   syncHUD();
  }
 }
 const profile=getRecoilProfile();
 const activelyFiring=(mouseHeld||eHeld||burstRemaining>0)&&!reloading&&(getCurrentWeapon().classId==="melee"||ammo>0);
 if(!activelyFiring&&getCurrentWeapon().automatic)recoilHoldTimer=Math.min(recoilHoldTimer,0.04);
 recoilHoldTimer=Math.max(0,recoilHoldTimer-dt);
 const pitchDecayRate=(recoilPeakPitch||profile.pitchCap)/RECOIL_RETURN_TIME;
 const yawDecayRate=(recoilPeakYaw||profile.yawCap)/RECOIL_RETURN_TIME;
 if(recoilHoldTimer<=0){
  recoilPitchDeg=Math.max(0,recoilPitchDeg-pitchDecayRate*dt);
  if(recoilYawDeg>0)recoilYawDeg=Math.max(0,recoilYawDeg-yawDecayRate*dt);
  else if(recoilYawDeg<0)recoilYawDeg=Math.min(0,recoilYawDeg+yawDecayRate*dt);
 }else{
  if(recoilPitchDeg>profile.pitchCap){
   recoilPitchDeg=Math.max(profile.pitchCap,recoilPitchDeg-(MAX_RECOIL_PITCH_DEG/RECOIL_RETURN_TIME)*dt);
  }
  if(recoilYawDeg>profile.yawCap){
   recoilYawDeg=Math.max(profile.yawCap,recoilYawDeg-(MAX_RECOIL_YAW_DEG/RECOIL_RETURN_TIME)*dt);
  }else if(recoilYawDeg<-profile.yawCap){
   recoilYawDeg=Math.min(-profile.yawCap,recoilYawDeg+(MAX_RECOIL_YAW_DEG/RECOIL_RETURN_TIME)*dt);
  }
  if(recoilPitchDeg<profile.pitchCap-1e-6&&recoilYawDeg!==0){
   if(recoilYawDeg>0)recoilYawDeg=Math.max(0,recoilYawDeg-yawDecayRate*dt);
   else if(recoilYawDeg<0)recoilYawDeg=Math.min(0,recoilYawDeg+yawDecayRate*dt);
  }
 }
 syncCameraRotation();
 // Passive: Drift (hold Space while falling to glide)
 if(!onGround&&jumpVelocity<0&&keys.Space){
  jumpVelocity=Math.max(jumpVelocity,-2.2);
 }
 // Smooth Tailwind dash
 if(dashTimer>0&&dashVel){
  camera.position.addInPlace(dashVel.scale(dt));
  dashTimer=Math.max(0,dashTimer-dt);
 }
 // Ult Orbs: hold F for 2 seconds straight while near an orb
 let nearOrb=null;
 for(const orb of ultOrbs){
  if(orb.active){
   orb.mesh.rotation.y+=dt*2;
   const dx=camera.position.x-orb.mesh.position.x,dz=camera.position.z-orb.mesh.position.z;
   if(dx*dx+dz*dz<6.25)nearOrb=orb;
  }else{
   orb.respawnTimer-=dt;
   if(orb.respawnTimer<=0){
    orb.active=true;
    orb.mesh.position.set(26+Math.random()*32,0.35,36+Math.random()*48);
    orb.mesh.setEnabled(true);
   }
  }
 }
 if(nearOrb&&keys.KeyF){
  orbHoldTimer+=dt;
  if(orbHoldTimer>=2.0){
   orbHoldTimer=0;nearOrb.active=false;nearOrb.mesh.setEnabled(false);nearOrb.respawnTimer=20;
   ultPoints=Math.min(8,ultPoints+1);syncAbilityHUD();
   showToast("ULT ORB COLLECTED ("+ultPoints+"/8)");
  }
 }else{
  orbHoldTimer=0;
 }
 // Tailwind primed timer
 if(tailwindPrimedTimer>0){
  tailwindPrimedTimer=Math.max(0,tailwindPrimedTimer-dt);
  if(tailwindPrimedTimer===0)syncAbilityHUD();
 }
 // Smoke projectiles (hold C to steer toward crosshair for up to 2s; releasing C ends steering)
 for(let i=smokeProjectiles.length-1;i>=0;i--){
  const sp=smokeProjectiles[i];
  if(!keys.KeyC)sp.steering=false;
  if(sp.steering&&keys.KeyC&&sp.steerTimer>0){
   sp.dir=camera.getDirection(B.Axis.Z).normalize();
   sp.steerTimer-=dt;
  }
  sp.mesh.position.addInPlace(sp.dir.scale(22*dt));
  sp.timer-=dt;
  if(sp.timer<=0||sp.mesh.position.y<=0.3){
   spawnSmokeCloud(sp.mesh.position);
   sp.mesh.dispose();smokeProjectiles.splice(i,1);
  }
 }
 // Smoke clouds lifetime
 for(let i=smokeClouds.length-1;i>=0;i--){
  smokeClouds[i].timer-=dt;
  if(smokeClouds[i].timer<=0){smokeClouds[i].mesh.dispose();smokeClouds.splice(i,1);}
 }
 recoilKick=Math.max(0,recoilKick-dt*.5);gunKick=Math.max(0,gunKick-dt*1.5);spreadKick=Math.max(0,spreadKick-dt*.4);firingSpreadDeg=Math.max(0,firingSpreadDeg-dt*3.5);
 if(gunRoot&&camera){
  const w=getCurrentWeapon();
  const opticZoom=w.zoom;
  const isScoped=opticZoom>=6;
  const targetZoom=aimHeld?opticZoom:1;
  aimZoom+=(targetZoom-aimZoom)*Math.min(1,dt*14);
  if(Math.abs(targetZoom-aimZoom)<0.015)aimZoom=targetZoom;
  camera.fov=baseFov/Math.max(1,aimZoom);
  const aimBlend=aimHeld?1:0;
  if(w.classId==="melee"){
   gunRoot.position.x=0;
   gunRoot.position.y=-gunKick*.12;
   gunRoot.position.z=gunKick*.45;
   gunRoot.rotation.x=gunKick*1.8;
   gunRoot.rotation.z=-gunKick*1.4;
  }else{
   gunRoot.position.x=-0.34*aimBlend;
   gunRoot.position.y=(aimHeld?0.02:0)+gunKick*.04;
   gunRoot.position.z=(aimHeld?-0.18:0)-gunKick*.14;
   gunRoot.rotation.x=-gunKick*.18;
   gunRoot.rotation.z=0;
  }
  $("scope-overlay").classList.toggle("hide",!(aimHeld&&isScoped));
  $("scope-overlay").setAttribute("aria-hidden",String(!(aimHeld&&isScoped)));
  $("reticle").classList.toggle("hide",aimHeld&&isScoped);
 }
 const crouchHeld=!!(keys.ShiftLeft||keys.ShiftRight);
 const walkHeld=!!(keys.ControlLeft||keys.ControlRight);
 crouched=crouchHeld;const targetY=crouched?1.05:1.7;camera.position.y+=(targetY-camera.position.y)*Math.min(1,dt*12);
 let forward=0,right=0;if(keys.KeyW)forward++;if(keys.KeyS)forward--;if(keys.KeyD)right++;if(keys.KeyA)right--;const len=Math.hypot(forward,right)||1;forward/=len;right/=len;
 const speedMult=catalog.speedMultiplier(getCurrentWeapon().classId);
 const speed=crouched?3.2:walkHeld?WALK_SPEED:MOVE_SPEED;
 const adjustedSpeed=speed*speedMult;
 const yaw=lookYaw;
 const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*adjustedSpeed*dt;
 const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*right)*adjustedSpeed*dt;
 const old=camera.position.clone();camera.position.x+=dx;camera.position.z+=dz;
 if(camera.position.x<2||camera.position.x>118||camera.position.z<2||camera.position.z>118||scene.meshes.some(m=>m.checkCollisions&&m.isEnabled()&&m.getBoundingInfo&&m.name!=="player camera"&&m.name!=="wide flat plain"&&m.intersectsPoint(new B.Vector3(camera.position.x,camera.position.y-.7,camera.position.z)))){camera.position.x=old.x;camera.position.z=old.z;}
 if(keys.Space&&onGround){jumpVelocity=8.5;onGround=false;}
 if(!onGround||camera.position.y>targetY){jumpVelocity-=18*dt;camera.position.y+=jumpVelocity*dt;if(camera.position.y<=targetY){camera.position.y=targetY;jumpVelocity=0;onGround=true;}}
 targets.forEach(t=>{if(t.alive){t.root.position.y=t.baseY+Math.sin(performance.now()*.002+t.phase)*.12;t.root.rotation.y+=dt*.5;if(Math.random()<dt*.012){if(shield>0){shield=Math.max(0,shield-1);}else{health=Math.max(0,health-1);}syncHUD();if(health===0&&shield===0)endGame(false);}}});
 sendPlayerState();
}
function loop(){const now=performance.now();const dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;if(scene){update(dt);scene.render();} }
try{
 createArena();resetGame();engine.runRenderLoop(loop);window.addEventListener("resize",()=>engine.resize());
}catch(e){
 showError("GAME INIT ERROR",""+(e.message||String(e)),e.stack);
}
canvas.addEventListener("click",()=>{if(!started)startGame();else if(!paused&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
canvas.addEventListener("pointerdown",e=>{if(e.button!==0||!started||paused)return;mouseHeld=true;if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();if(getCurrentWeapon().adsFireMode&&aimHeld)burstRemaining=getCurrentWeapon().adsBurst;shoot();});
document.addEventListener("pointerup",e=>{if(e.button===0)mouseHeld=false;});
document.addEventListener("mouseup",e=>{if(e.button===0)mouseHeld=false;});
window.addEventListener("blur",()=>{mouseHeld=false;eHeld=false;aimHeld=false;keys.KeyE=false;});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("pointerdown",e=>{if(e.button===2&&started&&!paused){aimHeld=true;if(getCurrentWeapon().altFireMode)altFire();e.preventDefault();}},true);
document.addEventListener("pointerup",e=>{if(e.button===2)aimHeld=false;});
document.addEventListener("mouseup",e=>{if(e.button===2)aimHeld=false;});
window.addEventListener("keydown",e=>{if(e.code!=="KeyE"||!started||paused)return;eHeld=true;e.preventDefault();if(!e.repeat){if(getCurrentWeapon().adsFireMode&&aimHeld)burstRemaining=getCurrentWeapon().adsBurst;shoot();}},true);
window.addEventListener("keyup",e=>{if(e.code==="KeyE"){eHeld=false;keys.KeyE=false;}},true);
document.addEventListener("pointerlockchange",()=>{if(document.pointerLockElement!==canvas)mouseHeld=false;});
let dragStartX=0,dragStartY=0,isDragging=false;
canvas.addEventListener("mousedown",e=>{if(started&&!paused&&document.pointerLockElement!==canvas){isDragging=true;dragStartX=e.clientX;dragStartY=e.clientY;canvas.requestPointerLock?.();}});
document.addEventListener("mousemove",e=>{
 if(document.pointerLockElement===canvas&&started&&!paused){
  lookYaw+=e.movementX*.0023;lookPitch=Math.max(-1.25,Math.min(1.25,lookPitch+e.movementY*.0023));syncCameraRotation();
 }else if(isDragging&&started&&!paused){
  const dx=(typeof e.movementX==="number"&&e.movementX!==0)?e.movementX*.0023:(e.clientX-dragStartX)*.0023;
  const dy=(typeof e.movementY==="number"&&e.movementY!==0)?e.movementY*.0023:(e.clientY-dragStartY)*.0023;
  lookYaw+=dx;lookPitch=Math.max(-1.25,Math.min(1.25,lookPitch+dy));
  dragStartX=e.clientX;dragStartY=e.clientY;
  syncCameraRotation();
 }
});
document.addEventListener("mouseup",e=>{isDragging=false;});
document.addEventListener("keydown",e=>{if(!e.repeat){keys[e.code]=true;if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();if(e.code==="Escape"&&started)togglePause();if(e.code==="KeyR")reload();if(e.code==="Digit1")setWeapon(0);if(e.code==="Digit2")setWeapon(1);if(e.code==="Digit3")setWeapon(2);if(e.code==="KeyC")useAbilityC();if(e.code==="KeyQ")useAbilityQ();if(e.code==="KeyE")useAbilityE();if(e.code==="KeyX")useAbilityX();}});
document.addEventListener("keyup",e=>{keys[e.code]=false;});
try{$("start").addEventListener("click",()=>startGame());}catch(e){showError("START BUTTON ERROR",""+(e.message||String(e)),e.stack);}
if(tdmRoomCode){
 $("intro")?.classList.add("hide");
 $("tdm-scoreboard")?.classList.remove("hide");
 startGame();
}
try{$("pause").addEventListener("click",togglePause);}catch(e){showError("PAUSE BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("resume").addEventListener("click",togglePause);}catch(e){showError("RESUME BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("exit").addEventListener("click",leave);}catch(e){showError("EXIT BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("exit2").addEventListener("click",leave);}catch(e){showError("EXIT2 BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("exit3").addEventListener("click",leave);}catch(e){showError("EXIT3 BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("reload").addEventListener("click",reload);}catch(e){showError("RELOAD BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("again").addEventListener("click",()=>{resetGame();try{$("endmenu").style.display="none";}catch(e){}try{$("intro").style.display="grid";}catch(e){}started=false;paused=false;});}catch(e){showError("AGAIN BUTTON ERROR",""+(e.message||String(e)),e.stack);}
})();
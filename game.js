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
let scene,camera,gunRoot=null,baseFov=Math.PI/2.8,started=false,paused=false,mouseHeld=false,eHeld=false,aimHeld=false,aimZoom=1,health=100,shield=50,maxShield=50,ammo=30,kills=0,reloading=false,reloadTimer=0,lastTime=0,jumpVelocity=0,onGround=true,fireCooldown=0,targets=[],keys={},toastTimer=0,gun=null,barrelMesh=null,muzzleFlash=null,recoilKick=0,gunKick=0,spreadKick=0,crouched=false,burstRemaining=0,burstTimer=0,activeWeaponIndex=0,credits=999999,netSocket=null,myName="Operator",netLastSend=0,mpCount=1,remotes=new Map();
const MOVE_SPEED=6.75, WALK_SPEED=8, ARENA=100;
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
  const blade=box("knife blade",.03,.55,.015,0,.15,-.35,gunMetal);blade.rotation.z=-.3;
  const handle=box("knife handle",.035,.30,.05,0,.05,-.08,gunDark);handle.rotation.z=.1;
  const pommel=box("knife pommel",.035,.08,.05,0,-.10,-.08,gunDark);
  gun=null;barrelMesh=null;muzzleFlash=null;
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
const ground=material("plain ground","#8a9a85"),wall=material("outer wall","#6b7a72"),siteCover=material("site cover","#5a6a62"),spawnCover=material("spawn cover","#7a8a82"),siteAMat=material("site A mat","#ff4444",.25,"#ff4444"),siteBMat=material("site B mat","#33a1ff",.25,"#33a1ff");
const skyDome=B.MeshBuilder.CreateSphere("sky dome",{diameter:900,segments:32,ringCount:16},scene);
const skyMat=new B.StandardMaterial("sky dome material",scene);skyMat.backFaceCulling=false;skyMat.disableLighting=true;skyMat.vertexColors=true;skyMat.fogEnabled=false;skyMat.diffuseColor=B.Color3.White();skyMat.emissiveColor=B.Color3.White();
const skyPos=skyDome.getVerticesData(B.VertexBuffer.PositionKind),skyCol=[];
for(let i=0;i<skyPos.length;i+=3){const t=Math.max(0,Math.min(1,(skyPos[i+1]+450)/900));const c=B.Color3.Lerp(new B.Color3(.82,.9,.94),new B.Color3(.3,.5,.7),t);skyCol.push(c.r,c.g,c.b,1);}
skyDome.setVerticesData(B.VertexBuffer.ColorKind,skyCol);skyDome.material=skyMat;skyDome.infiniteDistance=true;skyDome.isPickable=false;
const groundMat=new B.StandardMaterial("arena ground",scene);groundMat.diffuseColor=new B.Color3(.54,.6,.52);groundMat.specularColor=new B.Color3(.04,.04,.04);
const groundMesh=flat("wide flat plain",60,60,120,120,0,groundMat);groundMesh.receiveShadows=true;
// Taller outer walls (building-scale)
block("north wall",60,4,120,120,8,1.2,wall);
block("south wall",60,4,0,120,8,1.2,wall);
block("west wall",2,4,60,4,8,120,wall);
block("east wall",118,4,60,4,8,120,wall);

// Spawn indents into outer walls - color coded ground circles
// Attacker spawn (red) on east wall - color the ground beneath instead of floating geometry
block("attacker spawn indent",112,4,60,6,8,12,spawnCover);
flat("attacker spawn ground",112,60,10,10,0,material("attacker spawn ground","#ff4444",.6));
// Defender spawn (blue) on west wall
block("defender spawn indent",8,4,60,6,8,12,spawnCover);
flat("defender spawn ground",8,60,10,10,0,material("defender spawn ground","#33a1ff",.6));

// Sites moved off to sides - small blue rectangular prisms
// Site A: top-left area (off to side, not visible from attacker spawn)
block("site A",35,3,30,4,6,4,siteAMat);
// Site B: bottom-right area (off to side, not visible from defender spawn)
block("site B",85,3,90,4,6,4,siteBMat);

// Cover blocks - taller, building-scale
block("mid left cover",35,3,50,5,6,6,siteCover);
block("mid right cover",65,3,50,5,6,6,siteCover);
block("mid center cover",50,3,50,4,6,4,siteCover);
block("A approach cover",25,3,35,5,6,4,siteCover);
block("B approach cover",75,3,85,5,6,4,siteCover);
const crateMat=material("crate wood","#6f4f2e");crateMat.edgesWidth=.04;crateMat.edgesColor=new B.Color3(.22,.15,.08);
[[15,15],[105,15],[15,105],[105,105],[25,35],[75,35],[25,65],[75,65],[40,40],[60,40],[40,60],[60,60],[35,25],[65,25],[35,75],[65,75]].forEach((c,i)=>block("crate "+i,c[0],c[2]/2,c[1],c[2],c[2],c[2],crateMat));
camera=new B.UniversalCamera("player camera",new B.Vector3(112,1.7,60),scene);camera.attachControl(canvas,true);camera.inertia=0;camera.angularSensibility=2400;camera.speed=0;camera.minZ=.08;camera.fov=baseFov=Math.PI/2.8;camera.checkCollisions=true;camera.applyGravity=false;camera.ellipsoid=new B.Vector3(.35,.85,.35);camera.ellipsoidOffset=new B.Vector3(0,.8,0);camera.keysUp=[87,38];camera.keysDown=[83,40];camera.keysLeft=[65];camera.keysRight=[68];camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
camera.rotation.set(0,Math.PI,0);scene.activeCamera=camera;
gunMat=material("weapon graphite body","#263238");gunAccent=material("weapon accent",currentWeapon.color,.45,currentWeapon.color);
gunDark=material("weapon dark components","#11191e");gunMetal=material("weapon metal","#7b898b");gunGrip=material("weapon grip","#35464a");
gunWood=material("weapon wood furniture","#795033");gunOlive=material("weapon olive furniture","#566344");gunFlash=material("weapon muzzle flash",currentWeapon.color,.5,currentWeapon.color);
gunRoot=new B.TransformNode("weapon viewmodel root",scene);gunRoot.parent=camera;
buildWeaponModel(currentWeapon);
createTargets();
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
function createTargets(){
 targets=[];
 const spots=[[30,1.1,25],[35,1.1,30],[40,1.1,35],[80,1.1,85],[85,1.1,90],[90,1.1,95]];
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
function resetGame(){remotes.forEach((v,k)=>removeRemotePlayer(k));aimHeld=false;aimZoom=1;if(gunRoot)gunRoot.position.set(0,0,0);if(camera)camera.fov=baseFov;$("scope-overlay").classList.add("hide");$("reticle").classList.remove("hide");health=100;shield=maxShield;kills=0;activeWeaponIndex=0;currentWeapon=activeWeapon;ammo=currentWeapon.mag;reloading=false;reloadTimer=0;fireCooldown=0;burstRemaining=0;burstTimer=0;recoilKick=0;gunKick=0;spreadKick=0;crouched=false;camera.position.set(112,1.7,60);camera.rotation.set(0,Math.PI,0);jumpVelocity=0;onGround=true;targets.forEach(t=>{t.alive=true;t.hp=t.maxHp;t.root.setEnabled(true);updateTargetBar(t);});syncHUD();}
function updateTargetBar(t){const ratio=Math.max(0,t.hp/t.maxHp);t.barFill.scaling.x=ratio;t.barFill.position.x=-(1-ratio)*.625;t.barFill.material.diffuseColor=ratio>.6?B.Color3.FromHexString("#70ed63"):ratio>.3?B.Color3.FromHexString("#ffd45a"):B.Color3.FromHexString("#ff6262");t.barFill.material.emissiveColor=t.barFill.material.diffuseColor.scale(.25);}
function startGame(){
 try{
  if(!scene){showError("Scene not ready","The 3D scene failed to load. Refresh the page.");return;}
  started=true;paused=false;
  try{$("intro").style.display="none";}catch(e){showError("Intro hide failed",""+e.message);}
  try{$("pausemenu").style.display="none";}catch(e){}
  try{canvas.focus();}catch(e){}
  try{canvas.requestPointerLock?.();}catch(e){}
  try{showToast("Click and drag to look around");}catch(e){}
 }catch(e){showError("startGame failed",""+e.message,e.stack);}
}
window.gameStartGame=startGame;
function togglePause(){if(!started)return;paused=!paused;$("pausemenu").classList.toggle("hide",!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&canvas.requestPointerLock)canvas.requestPointerLock();}
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
  gunKick=Math.min(.22,gunKick+.15);
  recoilKick=Math.min(.16,recoilKick+.15);
  gunRoot.position.y=(aimHeld ? .20 : 0)-gunKick*.4;
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
 const ray=camera.getForwardRay(w.range);
 const pick=scene.pickWithRay(ray,m=>m.isPickable&&m.parent!==camera&&m.name!=="skybox"&&!m.name.startsWith("health bar"));
 const hitPoint=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint:ray.origin.add(ray.direction.scale(w.range));
 const hitNormal=pick&&pick.hit&&pick.getNormal?pick.getNormal(true):null;
 gunKick=Math.min(.22,gunKick+.12+w.recoil);
 recoilKick=Math.min(.16,recoilKick+w.recoil);
 spreadKick=Math.min(.12,spreadKick+w.spread);
 muzzleFlash.isVisible=true;
 const flash=muzzleFlash;setTimeout(()=>{if(flash&&!flash.isDisposed())flash.isVisible=false;},55);
 gunRoot.position.y=(aimHeld ? .20 : 0)-gunKick*.4;
 camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x-w.recoil));
 syncHUD();
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
 const previousRecoil=recoilKick;recoilKick=Math.max(0,recoilKick-dt*.15);camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x+(previousRecoil-recoilKick)*3));gunKick=Math.max(0,gunKick-dt*.7);spreadKick=Math.max(0,spreadKick-dt*.12);
 if(gunRoot&&camera){
  const opticZoom=getCurrentWeapon().zoom;
  const isScoped=opticZoom>=6;
  const targetZoom=aimHeld?opticZoom:1;
  aimZoom+=(targetZoom-aimZoom)*Math.min(1,dt*14);
  if(Math.abs(targetZoom-aimZoom)<0.015)aimZoom=targetZoom;
  camera.fov=baseFov/Math.max(1,aimZoom);
  const aimBlend=aimHeld?1:0;
  gunRoot.position.x=-0.34*aimBlend;
  gunRoot.position.y=(aimHeld?0.02:0)-gunKick*.4;
  gunRoot.position.z=aimHeld?-0.18:0;
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
 const yaw=camera.rotation.y;
 const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*adjustedSpeed*dt;
 const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*right)*adjustedSpeed*dt;
 const old=camera.position.clone();camera.position.x+=dx;camera.position.z+=dz;
 if(camera.position.x<2||camera.position.x>118||camera.position.z<2||camera.position.z>118||scene.meshes.some(m=>m.checkCollisions&&m.isEnabled()&&m.getBoundingInfo&&m.name!=="player camera"&&m.name!=="wide flat plain"&&m.intersectsPoint(new B.Vector3(camera.position.x,camera.position.y-.7,camera.position.z)))){camera.position.x=old.x;camera.position.z=old.z;}
 if(keys.Space&&onGround){jumpVelocity=6.5;onGround=false;keys.Space=false;}
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
canvas.addEventListener("mousedown",e=>{if(started&&!paused&&document.pointerLockElement!==canvas){isDragging=true;dragStartX=e.clientX;dragStartY=e.clientY;e.preventDefault();}});
document.addEventListener("mousemove",e=>{
 if(document.pointerLockElement===canvas&&started&&!paused){
  camera.rotation.y+=e.movementX*.0023;camera.rotation.x+=e.movementY*.0023;camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x));
 }else if(isDragging&&started&&!paused){
  const dx=(e.clientX-dragStartX)*.0023;const dy=(e.clientY-dragStartY)*.0023;
  camera.rotation.y+=dx;camera.rotation.x+=dy;camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x));
  dragStartX=e.clientX;dragStartY=e.clientY;
 }
});
document.addEventListener("mouseup",e=>{isDragging=false;});
document.addEventListener("keydown",e=>{if(e.code==="KeyE"&&started&&!paused){keys.KeyE=true;e.preventDefault();return;}if(!e.repeat){keys[e.code]=true;if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();if(e.code==="Escape"&&started)togglePause();if(e.code==="KeyR")reload();if(e.code==="Digit1")setWeapon(0);if(e.code==="Digit2")setWeapon(1);if(e.code==="Digit3")setWeapon(2);if(e.code==="KeyQ")setWeapon(activeWeaponIndex===0?1:0);}});
document.addEventListener("keyup",e=>{keys[e.code]=false;});
try{$("start").addEventListener("click",()=>startGame());}catch(e){showError("START BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("pause").addEventListener("click",togglePause);}catch(e){showError("PAUSE BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("resume").addEventListener("click",togglePause);}catch(e){showError("RESUME BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("exit").addEventListener("click",leave);}catch(e){showError("EXIT BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("exit2").addEventListener("click",leave);}catch(e){showError("EXIT2 BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("exit3").addEventListener("click",leave);}catch(e){showError("EXIT3 BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("reload").addEventListener("click",reload);}catch(e){showError("RELOAD BUTTON ERROR",""+(e.message||String(e)),e.stack);}
try{$("again").addEventListener("click",()=>{resetGame();try{$("endmenu").style.display="none";}catch(e){}try{$("intro").style.display="grid";}catch(e){}started=false;paused=false;});}catch(e){showError("AGAIN BUTTON ERROR",""+(e.message||String(e)),e.stack);}
})();
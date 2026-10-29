(()=>{"use strict";
const $=id=>document.getElementById(id);
const canvas=$("game");
if(!window.BABYLON){$("engine-error").classList.remove("hide");return;}
const B=window.BABYLON;
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,antialias:false,powerPreference:"low-power"});
engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio>1?1.35:1));
let scene,camera,gunRoot=null,baseFov=Math.PI/2.8,started=false,paused=false,mouseHeld=false,eHeld=false,aimHeld=false,aimZoom=1,health=100,ammo=30,kills=0,reloading=false,reloadTimer=0,lastTime=0,jumpVelocity=0,onGround=true,fireCooldown=0,targets=[],keys={},toastTimer=0,gun=null,barrelMesh=null,muzzleFlash=null,weaponIndex=0,recoilKick=0,gunKick=0,spreadKick=0,crouched=false,savedLoadout=null;
const MOVE_SPEED=9.5, WALK_SPEED=8, ARENA=100;
// ---- Multiplayer (Socket.IO) ----
const remotes=new Map();
let myName="Operator", netSocket=null, netLastSend=0, mpCount=1;
const weapons=[
 {name:"M4A1 CARBINE",damage:31,rate:.08,recoil:.018,spread:.012,mag:30,range:100,color:"#b7f34a",reload:2.2},
 {name:"MP5",damage:20,rate:.075,recoil:.009,spread:.025,mag:30,range:75,color:"#63d7ff",reload:2.0},
 {name:"REMINGTON 870",damage:12,rate:.8,recoil:.055,spread:.09,mag:7,range:35,color:"#ffbd59",reload:.55,pellets:6},
 {name:"ARCTIC WARFARE",damage:100,rate:1.5,recoil:.09,spread:.001,mag:5,range:140,color:"#ff78a8",reload:2.8},
 {name:"M249 SAW",damage:24,rate:.08,recoil:.028,spread:.02,mag:100,range:90,color:"#c7a5ff",reload:4.5}
];
const coreToWeapon={vanguard:0,viper:1,breacher:2,scope:3,bastion:4};
function loadSavedLoadout(){
 try{savedLoadout=JSON.parse(localStorage.getItem("customfps-loadout")||"null");}catch(e){savedLoadout=null;}
 if(!savedLoadout||!savedLoadout.loadout||!savedLoadout.stats)return;
 const i=coreToWeapon[savedLoadout.loadout.core];
 if(i===undefined)return;
 weaponIndex=i;
 const st=savedLoadout.stats,w=weapons[i];
 // Convert the loadout builder's displayed stats into match behavior.
 w.damage=Math.max(1,Number(st.damage)||w.damage);
 w.rate=Math.max(.055,Math.min(1.5,60/Math.max(1,Number(st.rate)||60)));
 w.recoil=Math.max(.004,Math.min(.14,(Number(st.recoil)||1)/100));
 w.mag=Math.max(1,Math.round(Number(st.capacity)||w.mag));
 w.range=Math.max(10,Number(st.range)||w.range);
 w.reload=Math.max(.5,Number(st.reload)||w.reload);
 w.name=(savedLoadout.core.name&&savedLoadout.core.className)?savedLoadout.core.name+" · "+savedLoadout.core.className:(savedLoadout.core.name||w.name);
}
loadSavedLoadout();
initNetwork();
function material(name,color,roughness=1,emissive=null){const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.12,.12);m.roughness=roughness;if(emissive)m.emissiveColor=B.Color3.FromHexString(emissive);return m;}
function block(name,x,y,z,sx,sy,sz,mat){const o=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function flat(name,x,z,sx,sz,y,mat){const o=B.MeshBuilder.CreateGround(name,{width:sx,height:sz,subdivisions:1},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function createArena(){
scene=new B.Scene(engine);scene.clearColor=new B.Color4(.48,.72,.88,1);scene.collisionsEnabled=true;scene.gravity=new B.Vector3(0,-18,0);
scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogColor=new B.Color3(.55,.74,.9);scene.fogDensity=.0045;
const sky=new B.HemisphericLight("ambient",new B.Vector3(0,1,0),scene);sky.intensity=.9;sky.groundColor=new B.Color3(.35,.4,.38);
const sun=new B.DirectionalLight("sun",new B.Vector3(-.45,-1,.25),scene);sun.position.set(20,40,-20);sun.intensity=.7;
const ground=material("plain ground","#65716a"),wall=material("end walls","#263941"),barrier=material("side barriers","#52696b"),trim=material("lime trim","#b7f34a",.6,"#273b0c"),tower=material("tower concrete","#63767b"),cover=material("simple cover","#3c5054");
// A gradient sky dome with soft haze near the horizon.
const skyDome=B.MeshBuilder.CreateSphere("sky dome",{diameter:900,segments:32,ringCount:16},scene);
const skyMat=new B.StandardMaterial("sky dome material",scene);skyMat.backFaceCulling=false;skyMat.disableLighting=true;skyMat.vertexColors=true;skyMat.fogEnabled=false;skyMat.diffuseColor=B.Color3.White();skyMat.emissiveColor=B.Color3.White();
const skyPos=skyDome.getVerticesData(B.VertexBuffer.PositionKind),skyCol=[];
for(let i=0;i<skyPos.length;i+=3){const t=Math.max(0,Math.min(1,(skyPos[i+1]+450)/900));const c=B.Color3.Lerp(new B.Color3(.8,.88,.94),new B.Color3(.22,.46,.82),t);skyCol.push(c.r,c.g,c.b,1);}
skyDome.setVerticesData(B.VertexBuffer.ColorKind,skyCol);skyDome.material=skyMat;skyDome.infiniteDistance=true;skyDome.isPickable=false;
// Procedural grid texture for the play area (repeats every 10 units).
const gridTex=new B.DynamicTexture("arena grid",{width:512,height:512},scene);const gctx=gridTex.getContext();
gctx.fillStyle="#39433e";gctx.fillRect(0,0,512,512);
gctx.strokeStyle="#4c5952";gctx.lineWidth=8;gctx.strokeRect(0,0,512,512);
gctx.strokeStyle="#5b6a62";gctx.lineWidth=2;for(let i=1;i<10;i++){const p=(i/10)*512;gctx.beginPath();gctx.moveTo(p,0);gctx.lineTo(p,512);gctx.stroke();gctx.beginPath();gctx.moveTo(0,p);gctx.lineTo(512,p);gctx.stroke();}
gctx.strokeStyle="#b7f34a";gctx.lineWidth=4;gctx.strokeRect(6,6,500,500);
gridTex.update();
const groundMat=new B.StandardMaterial("arena ground",scene);groundMat.diffuseTexture=gridTex;groundMat.diffuseTexture.wrapU=B.Texture.WRAP_ADDRESSMODE;groundMat.diffuseTexture.wrapV=B.Texture.WRAP_ADDRESSMODE;groundMat.diffuseTexture.uScale=10;groundMat.diffuseTexture.vScale=10;groundMat.specularColor=new B.Color3(.06,.06,.06);
const groundMesh=flat("wide flat plain",50,50,100,100,0,groundMat);groundMesh.receiveShadows=true;
// Solid walls on the two short ends, where the sniper towers sit.
block("north end wall",50,2,0,100,4,1.2,wall);
block("south end wall",50,2,100,100,4,1.2,wall);
block("north wall trim",50,4.05,0,100,.25,1.3,trim);
block("south wall trim",50,4.05,100,100,.25,1.3,trim);
// No solid side walls: spaced barriers line both long sides.
for(const z of [10,22,34,46,58,70,82,94]){
  block("west side barrier",1.5,.9,z,3,1.8,2.4,barrier);
  block("east side barrier",98.5,.9,z,3,1.8,2.4,barrier);
  block("west barrier stripe",1.5,1.83,z,1.8,.05,2.0,trim);
  block("east barrier stripe",98.5,1.83,z,1.8,.05,2.0,trim);
}
// Matching sniper towers near opposite end walls, with simple steps and low parapets.
for(const z of [8,92]){
  block("sniper tower base",50,.5,z,7,1,7,tower);
  block("sniper tower platform",50,3.2,z,8, .3,8,wall);
  block("tower parapet",50,3.8,z-3.7,8,.9,.3,barrier);
  block("tower parapet",50,3.8,z+3.7,8,.9,.3,barrier);
  block("tower parapet",46.2,3.8,z,.3,.9,7.5,barrier);
  block("tower parapet",53.8,3.8,z,.3,.9,7.5,barrier);
  for(let i=0;i<8;i++)block("tower stair",50, .25+i*.35, z+(z<50?1:-1)*(2.7+i*.48),2,.35,.55,cover);
}
// A few low pieces of cover are scattered across the otherwise empty plain.
[[25,25],[50,25],[75,25],[25,50],[75,50],[25,75],[50,75],[75,75]].forEach(([x,z])=>block("field cover",x,.65,z,3,1.3,2,cover));
// Decorative cover: crates, barrels, rocks, glowing pillars and a central beacon.
const crateMat=material("crate wood","#6f4f2e");crateMat.edgesWidth=.04;crateMat.edgesColor=new B.Color3(.22,.15,.08);
const barrelMat=material("metal barrel","#7a5230");
const rockMat=material("rock","#4a5250");
[[12,12,2],[88,12,2],[12,88,2],[88,88,2],[30,18,2],[70,18,2],[30,82,2],[70,82,2],[15,52,1.6],[85,48,1.6],[42,28,1.5],[58,72,1.5]].forEach((c,i)=>block("crate "+i,c[0],c[2]/2,c[1],c[2],c[2],c[2],crateMat));
[[20,14],[80,14],[20,86],[80,86],[44,12],[56,12],[44,88],[56,88],[16,70],[84,30]].forEach((c,i)=>{const m=B.MeshBuilder.CreateCylinder("barrel "+i,{height:1.3,diameter:.9,tessellation:14},scene);m.position.set(c[0],.65,c[1]);m.material=barrelMat;m.checkCollisions=true;});
[[10,32,.9],[90,32,.9],[10,68,.8],[90,68,.8],[40,66,1.1],[60,34,1.0],[18,58,.7],[82,46,.8],[52,30,.6],[48,70,.6]].forEach((c,i)=>{const m=B.MeshBuilder.CreateIcoSphere("rock "+i,{radius:c[2],subdivisions:2},scene);m.position.set(c[0],c[2]*.6,c[1]);m.material=rockMat;m.checkCollisions=true;});
for(const [x,z] of [[8,18],[92,18],[8,82],[92,82]])block("accent pillar",x,4,z,.7,8,.7,material("accent pillar mat","#243740",.7,"#b7f34a"));
block("beacon base",50,.25,50,8,.5,8,tower);
const beaconCore=B.MeshBuilder.CreateSphere("beacon core",{diameter:1.6,segments:14},scene);beaconCore.position.set(50,2.1,50);beaconCore.material=material("beacon glow","#b7f34a",.4,"#9ee63f");beaconCore.isPickable=false;
const beaconLight=new B.PointLight("beacon light",new B.Vector3(50,3,50),scene);beaconLight.intensity=10;beaconLight.diffuse=new B.Color3(.7,1,.45);beaconLight.range=20;
camera=new B.UniversalCamera("player camera",new B.Vector3(50,1.7,15),scene);camera.attachControl(canvas,true);camera.inertia=0;camera.angularSensibility=2400;camera.speed=0;camera.minZ=.08;camera.fov=baseFov=Math.PI/2.8;camera.checkCollisions=true;camera.applyGravity=false;camera.ellipsoid=new B.Vector3(.35,.85,.35);camera.ellipsoidOffset=new B.Vector3(0,.8,0);camera.keysUp=[87,38];camera.keysDown=[83,40];camera.keysLeft=[65];camera.keysRight=[68];camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
camera.rotation.set(0,0,0);
// Stylized medium-detail AR, built from real Babylon.js meshes (no external asset loader).
// The camera-local Z axis points down the rifle toward its muzzle.
const gunMat=material("AR graphite body","#263238"),gunAccent=material("AR accent",weapons[0].color,.45,weapons[0].color);
const gunDark=material("AR dark components","#11191e"),gunMetal=material("AR metal","#7b898b"),gunGrip=material("AR grip","#35464a");
gunRoot=new B.TransformNode("weapon viewmodel root",scene);gunRoot.parent=camera;
function gunBox(name,w,h,d,x,y,z,mat){const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.material=mat;m.parent=gunRoot;m.position.set(x,y,z);return m;}
function gunCylinder(name,diameter,length,x,y,z,mat,segments=12){const m=B.MeshBuilder.CreateCylinder(name,{height:length,diameter, tessellation:segments},scene);m.rotation.x=Math.PI/2;m.material=mat;m.parent=gunRoot;m.position.set(x,y,z);return m;}
// Receiver and raised upper receiver.
gun=gunBox("AR lower receiver",.22,.17,.48,.34,-.29,.60,gunMat);
gunBox("AR upper receiver",.205,.095,.49,.34,-.205,.60,gunDark);
gunBox("AR handguard",.205,.145,.40,.34,-.27,.30,gunGrip);
// Barrel and muzzle brake.
barrelMesh=gunCylinder("AR barrel",.052,.34,.34,-.25,.105,gunAccent);
gunCylinder("AR muzzle brake",.085,.105,.34,-.25,-.075,gunDark);
// Stock and cheek rest behind the receiver.
gunBox("AR buffer tube",.13,.105,.24,.34,-.28,.90,gunDark);
gunBox("AR shoulder stock",.19,.19,.28,.34,-.30,1.12,gunGrip);
gunBox("AR stock buttpad",.205,.205,.055,.34,-.30,1.285,gunDark);
gunBox("AR cheek rest",.17,.045,.19,.34,-.19,1.08,gunAccent);
// Angled-looking pistol grip and magazine under the receiver.
const pistolGrip=gunBox("AR pistol grip",.12,.24,.16,.34,-.47,.72,gunGrip);pistolGrip.rotation.x=-.14;
gunBox("AR grip base",.13,.045,.17,.34,-.595,.74,gunDark);
const magazine=gunBox("AR magazine",.145,.28,.18,.34,-.49,.49,gunDark);magazine.rotation.x=-.10;
gunBox("AR magazine floorplate",.16,.045,.19,.34,-.64,.51,gunAccent);
// Low-profile top rail only; removed the bulky optic assembly that obstructed the view.
gunBox("AR top rail",.12,.035,.43,.34,-.145,.55,gunDark);
// Front sight and rear sight.
gunBox("AR front sight post",.045,.13,.05,.34,-.17,.22,gunDark);
gunBox("AR front sight cap",.10,.035,.07,.34,-.105,.22,gunAccent);
gunBox("AR rear sight",.07,.085,.065,.34,-.095,.70,gunDark);
// Side ejection port and handguard rail ribs.
gunBox("AR ejection port",.018,.065,.17,.45,-.22,.59,gunDark);
gunBox("AR charging handle",.055,.035,.10,.46,-.17,.72,gunMetal);
for(let i=0;i<5;i++)gunBox("AR handguard rib "+i,.025,.035,.045,.455,-.27,.19+i*.065,gunMetal);
// Short lower handguard grip.
gunBox("AR foregrip",.11,.14,.105,.34,-.405,.31,gunDark);
muzzleFlash=B.MeshBuilder.CreateSphere("muzzle flash",{diameter:.18,segments:6},scene);muzzleFlash.parent=gunRoot;muzzleFlash.position.set(.34,-.25,-.15);muzzleFlash.material=new B.StandardMaterial("muzzle flash material",scene);muzzleFlash.material.emissiveColor=B.Color3.FromHexString(weapons[0].color);muzzleFlash.material.diffuseColor=B.Color3.FromHexString(weapons[0].color);muzzleFlash.isVisible=false;
createTargets();
// Soft shadows give the arena depth and make every object feel solid.
const shadowGen=new B.ShadowGenerator(1024,sun);
shadowGen.useBlurExponentialShadowMap=true;shadowGen.blurKernel=8;shadowGen.darkness=.4;
scene.meshes.forEach(m=>{
 if(m.name==="sky dome"||m.name==="player camera"||m.name.startsWith("health bar"))return;
 let par=m.parent;while(par){if(par===camera)return;par=par.parent;}
 m.receiveShadows=true;
 if(m.name!=="beacon core"&&m.name!=="wide flat plain")shadowGen.addShadowCaster(m);
});
// Mild post-processing for punch (bloom + vignette). Fails silently if unavailable.
try{
 const pp=new B.DefaultRenderingPipeline("default",true,engine,[camera]);
 pp.bloomEnabled=true;pp.bloomWeight=.22;pp.bloomThreshold=.75;pp.bloomKernel=64;pp.bloomScale=.5;
 pp.vignetteEnabled=true;pp.vignetteWeight=1.1;pp.vignetteColor=new B.Color4(0,0,0,.35);
}catch(e){console.warn("Post-processing unavailable:",e);}
 // Color the weapon accent to match the saved core.
 const activeWeapon=weapons[weaponIndex];barrelMesh.material.diffuseColor=B.Color3.FromHexString(activeWeapon.color);barrelMesh.material.emissiveColor=B.Color3.FromHexString(activeWeapon.color);muzzleFlash.material.diffuseColor=B.Color3.FromHexString(activeWeapon.color);muzzleFlash.material.emissiveColor=B.Color3.FromHexString(activeWeapon.color);
 return scene;
}
function createTargets(){
 targets=[];
 const spots=[[25,1.1,35],[38,1.1,48],[50,1.1,60],[64,1.1,43],[76,1.1,68]];
 spots.forEach((v,i)=>{
  const root=new B.TransformNode("drone root "+i,scene);root.position.set(v[0],v[1],v[2]);
  const shell=material("drone shell "+i,"#52666a");
  const body=B.MeshBuilder.CreateSphere("drone body",{diameter:.9,segments:10},scene);body.parent=root;body.material=shell;body.isPickable=true;
  const eye=B.MeshBuilder.CreateBox("drone eye",{width:.38,height:.08,depth:.08},scene);eye.parent=root;eye.position.z=-.41;eye.material=material("drone eye glow "+i,"#b7f34a",.4,"#b7f34a");eye.isPickable=true;
  const ring=B.MeshBuilder.CreateTorus("drone ring",{diameter:1.15,thickness:.045,tessellation:12},scene);ring.parent=root;ring.rotation.x=Math.PI/2;ring.material=material("drone ring mat "+i,"#b7f34a",.4,"#273b0c");ring.isPickable=true;
  // Floating health bar: dark backing plus a colored fill that shrinks with damage.
  const barRoot=new B.TransformNode("health bar root "+i,scene);barRoot.parent=root;barRoot.position.set(0,.9,0);
  const back=B.MeshBuilder.CreatePlane("health bar backing "+i,{width:1.35,height:.14},scene);back.parent=barRoot;back.position.z=-.04;back.billboardMode=B.Mesh.BILLBOARDMODE_ALL;back.material=material("health bar dark "+i,"#142024");back.isPickable=false;
  const fill=B.MeshBuilder.CreatePlane("health bar fill "+i,{width:1.25,height:.075},scene);fill.parent=barRoot;fill.position.z=-.02;fill.billboardMode=B.Mesh.BILLBOARDMODE_ALL;fill.material=material("health bar fill mat "+i,"#70ed63",.5,"#285d20");fill.isPickable=false;
  targets.push({root,body,alive:true,hp:100,maxHp:100,phase:i*1.2,baseY:v[1],barRoot,barFill:fill});
 });
}
// ---- Multiplayer (Socket.IO) ----
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
 if(now-netLastSend<33)return; // ~30 Hz
 netLastSend=now;
 try{
  netSocket.emit("state",{
   x:camera.position.x,y:camera.position.y,z:camera.position.z,
   rotY:camera.rotation.y,rotX:camera.rotation.x,
   health,ammo,weaponIndex,kills,name:myName
  });
 }catch(e){}
}
function remoteColor(i){return ["#b7f34a","#63d7ff","#ffbd59","#ff78a8","#c7a5ff"][i]||"#b7f34a";}
function createRemotePlayer(data){
 const id=data.id, color=remoteColor(data.weaponIndex||0);
 const root=new B.TransformNode("remote "+id,scene);
 const bodyMat=material("remote body "+id,"#2b3b40");
 const accentMat=material("remote accent "+id,color,.5,color);
 const body=B.MeshBuilder.CreateBox("remote body mesh "+id,{width:.6,height:1.0,depth:.35},scene);body.parent=root;body.material=bodyMat;body.isPickable=false;
 const head=B.MeshBuilder.CreateSphere("remote head "+id,{diameter:.5,segments:8},scene);head.parent=root;head.position.y=.62;head.material=bodyMat;head.isPickable=false;
 const gunMesh=B.MeshBuilder.CreateBox("remote gun "+id,{width:.08,height:.08,depth:.6},scene);gunMesh.parent=root;gunMesh.position.set(.22,0,.30);gunMesh.rotation.x=Math.PI/2.2;gunMesh.material=accentMat;gunMesh.isPickable=false;
 // Billboard health bar above the avatar.
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
function syncHUD(){$("health").textContent=health;$("hpbar").style.width=health+"%";$("ammo").textContent=ammo;$("objective").textContent="Eliminate training drones · "+kills+" / 5";const w=weapons[weaponIndex];$("weapon-name").textContent=w.name;$("ammo").textContent=ammo;$("weapon-slots").textContent="1 AR · 2 SMG · 3 SG · 4 SR · 5 LMG";const ammoMax=document.querySelector(".hud em");if(ammoMax)ammoMax.textContent=" / "+w.mag;}
function resetGame(){remotes.forEach((v,k)=>removeRemotePlayer(k));aimHeld=false;aimZoom=1;if(gunRoot)gunRoot.position.set(0,0,0);if(camera)camera.fov=baseFov;$("scope-overlay").classList.add("hide");$("reticle").classList.remove("hide");health=100;kills=0;ammo=weapons[weaponIndex].mag;reloading=false;reloadTimer=0;fireCooldown=0;recoilKick=0;gunKick=0;spreadKick=0;crouched=false;camera.position.set(50,1.7,15);camera.rotation.set(0,0,0);jumpVelocity=0;onGround=true;targets.forEach(t=>{t.alive=true;t.hp=t.maxHp;t.root.setEnabled(true);updateTargetBar(t);});syncHUD();}
function updateTargetBar(t){const ratio=Math.max(0,t.hp/t.maxHp);t.barFill.scaling.x=ratio;t.barFill.position.x=-(1-ratio)*.625;t.barFill.material.diffuseColor=ratio>.6?B.Color3.FromHexString("#70ed63"):ratio>.3?B.Color3.FromHexString("#ffd45a"):B.Color3.FromHexString("#ff6262");t.barFill.material.emissiveColor=t.barFill.material.diffuseColor.scale(.25);}
function equipWeapon(i){if(i<0||i>=weapons.length||i===weaponIndex)return;weaponIndex=i;const w=weapons[i];ammo=w.mag;reloading=false;reloadTimer=0;fireCooldown=0;gun.material.diffuseColor=B.Color3.FromHexString("#18252c");barrelMesh.material.diffuseColor=B.Color3.FromHexString(w.color);barrelMesh.material.emissiveColor=B.Color3.FromHexString(w.color);muzzleFlash.material.diffuseColor=B.Color3.FromHexString(w.color);muzzleFlash.material.emissiveColor=B.Color3.FromHexString(w.color);syncHUD();showToast("EQUIPPED: "+w.name);}
function startGame(){started=true;paused=false;$("intro").classList.add("hide");$("pausemenu").classList.add("hide");canvas.focus();if(canvas.requestPointerLock)canvas.requestPointerLock();}
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
function shoot(){
 if(!started||paused||reloading||fireCooldown>0)return;
 const w=weapons[weaponIndex];
 if(ammo<=0){showToast("EMPTY MAGAZINE — PRESS R");mouseHeld=false;return;}
 ammo--;fireCooldown=w.rate;
 // Hitscan: the ray follows the exact center of the camera/crosshair.
 // Compute the hit before applying this shot's visual recoil.
 const ray=camera.getForwardRay(w.range);
 const pick=scene.pickWithRay(ray,m=>m.isPickable&&m.parent!==camera&&m.name!=="skybox"&&!m.name.startsWith("health bar"));
 const hitPoint=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint:ray.origin.add(ray.direction.scale(w.range));
 const hitNormal=pick&&pick.hit&&pick.getNormal?pick.getNormal(true):null;
 gunKick=Math.min(.22,gunKick+.12+w.recoil);
 recoilKick=Math.min(.16,recoilKick+w.recoil);
 spreadKick=Math.min(.12,spreadKick+w.spread);
 muzzleFlash.isVisible=true;
 setTimeout(()=>{if(muzzleFlash)muzzleFlash.isVisible=false;},55);
 // Keep the existing weapon kick and upward camera recoil as visual effects only.
 gunRoot.position.y=(aimHeld ? .20 : 0)-gunKick*.4;
 camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x-w.recoil));
 syncHUD();
 // Tracer is cosmetic only; it never decides whether damage is dealt.
 const muzzle= camera.getDirection(B.Axis.Z);
 const origin=camera.position.add(muzzle.scale(.55));
 const tracer=B.MeshBuilder.CreateLines("bullet tracer",{points:[origin,hitPoint]},scene);
 tracer.color=B.Color3.FromHexString(w.color);tracer.alpha=.95;tracer.isPickable=false;
 setTimeout(()=>{if(!tracer.isDisposed())tracer.dispose();},85);
 let target=null;
 if(pick&&pick.hit&&pick.pickedMesh){
  target=targets.find(t=>t.alive&&(pick.pickedMesh===t.body||pick.pickedMesh.parent===t.root));
 }
 if(target){
  const damage=w.damage*(w.pellets||1);
  target.hp=Math.max(0,target.hp-damage);updateTargetBar(target);showDamagePopup(damage);
  if(target.hp<=0){
   target.alive=false;target.root.setEnabled(false);kills++;syncHUD();showToast("DRONE ELIMINATED");
   if(kills===5)endGame(true);
  }else{
   $("objective").textContent="Eliminate training drones · "+kills+" / 5";
  }
 }else if(pick&&pick.hit&&pick.pickedPoint){
  // A small black mark remains briefly on the surface when the shot hits scenery.
  showImpactDot(hitPoint,hitNormal);
 }
}
function reload(){const w=weapons[weaponIndex];if(!started||paused||reloading||ammo===w.mag)return;reloading=true;reloadTimer=w.reload;showToast("RELOADING…");}
function update(dt){
 if(!started||paused)return;
 fireCooldown=Math.max(0,fireCooldown-dt);
 // M4A1, MP5, and M249 fire continuously while the left mouse button is held.
 // Shotgun and sniper remain single-shot per click.
 if((mouseHeld||eHeld)&&[0,1,4].includes(weaponIndex)&&!reloading&&fireCooldown<=0)shoot();
 if(reloading){reloadTimer-=dt;if(reloadTimer<=0){ammo=weapons[weaponIndex].mag;reloading=false;syncHUD();showToast("MAGAZINE RELOADED");}}
 const previousRecoil=recoilKick;recoilKick=Math.max(0,recoilKick-dt*.055);camera.rotation.x=Math.min(1.25,camera.rotation.x+(previousRecoil-recoilKick));gunKick=Math.max(0,gunKick-dt*.7);spreadKick=Math.max(0,spreadKick-dt*.12);
 if(gunRoot&&camera){
  // Read the saved attachment itself as a fallback, so scope behavior does not
  // depend on a calculated stat being present in older saved loadouts.
  const scopeId=savedLoadout?.loadout?.scope||"iron-sights";
  const opticZoom=scopeId==="aw-sight"?6:scopeId==="iron-sights"?1.5:Math.max(1,Number(savedLoadout?.stats?.zoom)||1);
  const isScoped=scopeId==="aw-sight"||opticZoom>=6;
  const targetZoom=aimHeld?opticZoom:1;
  aimZoom+=(targetZoom-aimZoom)*Math.min(1,dt*14);
  if(Math.abs(targetZoom-aimZoom)<0.015)aimZoom=targetZoom;
  camera.fov=baseFov/Math.max(1,aimZoom);
  // Model parts are authored around x=+0.34. Cancel that offset while aiming
  // so the receiver lines up with the center of the screen.
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
 const speed=crouched?3.2:walkHeld?WALK_SPEED:MOVE_SPEED;const yaw=camera.rotation.y;const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed*dt;const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed*dt;
 const old=camera.position.clone();camera.position.x+=dx;camera.position.z+=dz;
 if(camera.position.x<2||camera.position.x>98||camera.position.z<2||camera.position.z>98||scene.meshes.some(m=>m.checkCollisions&&m.isEnabled()&&m.getBoundingInfo&&m.name!=="player camera"&&m.name!=="wide flat plain"&&m.intersectsPoint(new B.Vector3(camera.position.x,camera.position.y-.7,camera.position.z)))){camera.position.x=old.x;camera.position.z=old.z;}
 if(keys.Space&&onGround){jumpVelocity=6.5;onGround=false;keys.Space=false;}
 if(!onGround||camera.position.y>targetY){jumpVelocity-=18*dt;camera.position.y+=jumpVelocity*dt;if(camera.position.y<=targetY){camera.position.y=targetY;jumpVelocity=0;onGround=true;}}
 targets.forEach(t=>{if(t.alive){t.root.position.y=t.baseY+Math.sin(performance.now()*.002+t.phase)*.12;t.root.rotation.y+=dt*.5;if(Math.random()<dt*.012){health=Math.max(0,health-1);syncHUD();if(health===0)endGame(false);}}});
 sendPlayerState();
}
function loop(){const now=performance.now();const dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;if(scene){update(dt);scene.render();} }
try{createArena();resetGame();engine.runRenderLoop(loop);window.addEventListener("resize",()=>engine.resize());}catch(e){console.error(e);$("engine-error").classList.remove("hide");}
canvas.addEventListener("click",()=>{if(!started)startGame();else if(!paused&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
// Track held fire independently of pointer-lock state, including the initial press.
canvas.addEventListener("pointerdown",e=>{if(e.button!==0||!started||paused)return;mouseHeld=true;if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();shoot();});
document.addEventListener("pointerup",e=>{if(e.button===0)mouseHeld=false;});
document.addEventListener("mouseup",e=>{if(e.button===0)mouseHeld=false;});
window.addEventListener("blur",()=>{mouseHeld=false;eHeld=false;aimHeld=false;keys.KeyE=false;});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("pointerdown",e=>{if(e.button===2&&started&&!paused){aimHeld=true;e.preventDefault();}},true);
document.addEventListener("pointerup",e=>{if(e.button===2)aimHeld=false;});
document.addEventListener("mouseup",e=>{if(e.button===2)aimHeld=false;});
// Capture E at the window level so the game still sees it while the canvas has pointer lock.
window.addEventListener("keydown",e=>{if(e.code!=="KeyE"||!started||paused||![0,1,4].includes(weaponIndex))return;eHeld=true;e.preventDefault();if(!e.repeat)shoot();},true);
window.addEventListener("keyup",e=>{if(e.code==="KeyE"){eHeld=false;keys.KeyE=false;}},true);
document.addEventListener("pointerlockchange",()=>{if(document.pointerLockElement!==canvas)mouseHeld=false;});
document.addEventListener("mousemove",e=>{if(document.pointerLockElement===canvas&&started&&!paused){camera.rotation.y+=e.movementX*.0023;camera.rotation.x+=e.movementY*.0023;camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x));}});
document.addEventListener("keydown",e=>{if(e.code==="KeyE"&&started&&!paused&&[0,1,4].includes(weaponIndex)){keys.KeyE=true;e.preventDefault();return;}if(!e.repeat){keys[e.code]=true;if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();if(e.code==="Escape"&&started)togglePause();if(e.code==="KeyR")reload();if(e.code==="Digit1")equipWeapon(0);if(e.code==="Digit2")equipWeapon(1);if(e.code==="Digit3")equipWeapon(2);if(e.code==="Digit4")equipWeapon(3);if(e.code==="Digit5")equipWeapon(4);}});
document.addEventListener("keyup",e=>{keys[e.code]=false;});
$("start").addEventListener("click",startGame);$("pause").addEventListener("click",togglePause);$("resume").addEventListener("click",togglePause);$("exit").addEventListener("click",leave);$("exit2").addEventListener("click",leave);$("exit3").addEventListener("click",leave);$("reload").addEventListener("click",reload);$("again").addEventListener("click",()=>{resetGame();$("endmenu").classList.add("hide");$("intro").classList.remove("hide");started=false;paused=false;});
})();
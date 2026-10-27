(()=>{"use strict";
const $=id=>document.getElementById(id);
const canvas=$("game");
if(!window.BABYLON){$("engine-error").classList.remove("hide");return;}
const B=window.BABYLON;
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,antialias:false,powerPreference:"low-power"});
engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio>1?1.35:1));
let scene,camera,playerRoot,started=false,paused=false,health=100,ammo=30,kills=0,reloading=false,reloadTimer=0,lastTime=0,jumpVelocity=0,onGround=true,fireCooldown=0,targets=[],keys={},toastTimer=0;
const MOVE_SPEED=8, ARENA=100;
function material(name,color,roughness=1,emissive=null){const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.12,.12);m.roughness=roughness;if(emissive)m.emissiveColor=B.Color3.FromHexString(emissive);return m;}
function block(name,x,y,z,sx,sy,sz,mat){const o=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function flat(name,x,z,sx,sz,y,mat){const o=B.MeshBuilder.CreateGround(name,{width:sx,height:sz,subdivisions:1},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function createArena(){
scene=new B.Scene(engine);scene.clearColor=new B.Color4(.48,.72,.88,1);scene.collisionsEnabled=true;scene.gravity=new B.Vector3(0,-18,0);
const sky=new B.HemisphericLight("ambient",new B.Vector3(0,1,0),scene);sky.intensity=.9;sky.groundColor=new B.Color3(.35,.4,.38);
const sun=new B.DirectionalLight("sun",new B.Vector3(-.45,-1,.25),scene);sun.position.set(20,40,-20);sun.intensity=.7;
const ground=material("plain ground","#65716a"),wall=material("end walls","#263941"),barrier=material("side barriers","#52696b"),trim=material("lime trim","#b7f34a",.6,"#273b0c"),tower=material("tower concrete","#63767b"),cover=material("simple cover","#3c5054");
// A very large, untextured skybox surrounds the arena. It is deliberately open overhead.
const skybox=B.MeshBuilder.CreateBox("skybox",{size:1000},scene);const skyMat=new B.StandardMaterial("skybox material",scene);skyMat.backFaceCulling=false;skyMat.disableLighting=true;skyMat.diffuseColor=new B.Color3(.48,.72,.88);skyMat.emissiveColor=new B.Color3(.48,.72,.88);skybox.material=skyMat;skybox.infiniteDistance=true;skybox.isPickable=false;
// Large, completely flat play area.
flat("wide flat plain",50,50,100,100,0,ground);
// Solid walls on the two short ends, where the sniper towers sit.
block("north end wall",50,2,0,100,4,1.2,wall);
block("south end wall",50,2,100,100,4,1.2,wall);
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
camera=new B.UniversalCamera("player camera",new B.Vector3(50,1.7,15),scene);camera.attachControl(canvas,true);camera.inertia=0;camera.angularSensibility=2400;camera.speed=0;camera.minZ=.08;camera.fov=Math.PI/2.8;camera.checkCollisions=true;camera.applyGravity=false;camera.ellipsoid=new B.Vector3(.35,.85,.35);camera.ellipsoidOffset=new B.Vector3(0,.8,0);camera.keysUp=[87,38];camera.keysDown=[83,40];camera.keysLeft=[65];camera.keysRight=[68];camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
camera.rotation.set(0,0,0);
// Simple first-person rifle silhouette.
const gunMat=material("rifle body","#18252c"),gunAccent=material("rifle accent","#b7f34a",.4,"#334a11");
const gun=B.MeshBuilder.CreateBox("rifle receiver",{width:.22,height:.17,depth:.65},scene);gun.material=gunMat;gun.parent=camera;gun.position.set(.34,-.29,.62);
const barrelMesh=B.MeshBuilder.CreateCylinder("rifle barrel",{height:.48,diameter:.055},scene);barrelMesh.rotation.x=Math.PI/2;barrelMesh.material=gunAccent;barrelMesh.parent=camera;barrelMesh.position.set(.34,-.25,.23);
const sight=B.MeshBuilder.CreateBox("rifle sight",{width:.07,height:.06,depth:.12},scene);sight.material=gunAccent;sight.parent=camera;sight.position.set(.34,-.17,.55);
createTargets();return scene;
}
function createTargets(){targets=[];const spots=[[25,1.1,35],[38,1.1,48],[50,1.1,60],[64,1.1,43],[76,1.1,68]];spots.forEach((v,i)=>{const root=new B.TransformNode("drone root "+i,scene);root.position.set(v[0],v[1],v[2]);const body=B.MeshBuilder.CreateSphere("drone body",{diameter:.75,segments:8},scene);body.parent=root;body.material=material("drone shell "+i,"#52666a");const eye=B.MeshBuilder.CreateBox("drone eye",{width:.38,height:.08,depth:.08},scene);eye.parent=root;eye.position.z=-.34;eye.material=material("drone eye glow "+i,"#b7f34a",.4,"#b7f34a");const ring=B.MeshBuilder.CreateTorus("drone ring",{diameter:1.05,thickness:.045,tessellation:12},scene);ring.parent=root;ring.rotation.x=Math.PI/2;ring.material=material("drone ring mat "+i,"#b7f34a",.4,"#273b0c");targets.push({root,alive:true,hp:2,phase:i*1.2,baseY:v[1]});});}
function showToast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),1300);}
function syncHUD(){$("health").textContent=health;$("hpbar").style.width=health+"%";$("ammo").textContent=ammo;$("objective").textContent="Eliminate training drones · "+kills+" / 5";}
function resetGame(){health=100;ammo=30;kills=0;reloading=false;reloadTimer=0;fireCooldown=0;camera.position.set(50,1.7,15);camera.rotation.set(0,0,0);jumpVelocity=0;onGround=true;targets.forEach((t,i)=>{t.alive=true;t.hp=2;t.root.setEnabled(true);});syncHUD();}
function startGame(){started=true;paused=false;$("intro").classList.add("hide");$("pausemenu").classList.add("hide");canvas.focus();if(canvas.requestPointerLock)canvas.requestPointerLock();}
function togglePause(){if(!started)return;paused=!paused;$("pausemenu").classList.toggle("hide",!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&canvas.requestPointerLock)canvas.requestPointerLock();}
function endGame(win){paused=true;$("endtitle").textContent=win?"TEST COMPLETE":"OPERATOR DOWN";$("endcopy").textContent=win?"All five training drones eliminated. Arena clear.":"You were tagged out during testing. Reset and try again.";$("endmenu").classList.remove("hide");if(document.pointerLockElement)document.exitPointerLock();}
function leave(){if(document.pointerLockElement)document.exitPointerLock();location.href="index.html";}
function shoot(){if(!started||paused||reloading||fireCooldown>0)return;if(ammo<=0){showToast("EMPTY MAGAZINE — PRESS R");return;}ammo--;fireCooldown=.12;syncHUD();const ray=new B.Ray(camera.position,camera.getForwardRay().direction,80);const pick=scene.pickWithRay(ray,m=>targets.some(t=>t.alive&&(m===t.root||m.parent===t.root)));if(pick&&pick.hit&&pick.pickedMesh){const target=targets.find(t=>t.alive&&(pick.pickedMesh===t.root||pick.pickedMesh.parent===t.root));if(target){target.hp--;if(target.hp<=0){target.alive=false;target.root.setEnabled(false);kills++;syncHUD();showToast("DRONE ELIMINATED");if(kills===5)endGame(true);}else showToast("TARGET HIT");}}}
function reload(){if(!started||paused||reloading||ammo===30)return;reloading=true;reloadTimer=1.15;showToast("RELOADING…");}
function update(dt){if(!started||paused)return;fireCooldown=Math.max(0,fireCooldown-dt);if(reloading){reloadTimer-=dt;if(reloadTimer<=0){ammo=30;reloading=false;syncHUD();showToast("MAGAZINE RELOADED");}}
let forward=0,right=0;if(keys.KeyW||keys.ArrowUp)forward++;if(keys.KeyS||keys.ArrowDown)forward--;if(keys.KeyD)right++;if(keys.KeyA)right--;const len=Math.hypot(forward,right)||1;forward/=len;right/=len;
const yaw=camera.rotation.y;const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*MOVE_SPEED*dt;const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*right)*MOVE_SPEED*dt;
const old=camera.position.clone();camera.position.x+=dx;camera.position.z+=dz;
if(camera.position.x<2||camera.position.x>98||camera.position.z<2||camera.position.z>98||scene.meshes.some(m=>m.checkCollisions&&m.isEnabled()&&m.getBoundingInfo&&m.name!=="player camera"&&m.intersectsPoint(new B.Vector3(camera.position.x,camera.position.y-.7,camera.position.z)))){camera.position.x=old.x;camera.position.z=old.z;}
if(keys.Space&&onGround){jumpVelocity=6.5;onGround=false;keys.Space=false;}if(!onGround||camera.position.y>1.7){jumpVelocity-=18*dt;camera.position.y+=jumpVelocity*dt;if(camera.position.y<=1.7){camera.position.y=1.7;jumpVelocity=0;onGround=true;}}
targets.forEach(t=>{if(t.alive){t.root.position.y=t.baseY+Math.sin(performance.now()*.002+t.phase)*.12;t.root.rotation.y+=dt*.5;if(Math.random()<dt*.012){health=Math.max(0,health-1);syncHUD();if(health===0)endGame(false);}}});
}
function loop(){const now=performance.now();const dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;if(scene){update(dt);scene.render();} }
try{createArena();resetGame();engine.runRenderLoop(loop);window.addEventListener("resize",()=>engine.resize());}catch(e){console.error(e);$("engine-error").classList.remove("hide");}
canvas.addEventListener("click",()=>{if(!started)startGame();else if(!paused){if(document.pointerLockElement===canvas)shoot();else canvas.requestPointerLock?.();}});
document.addEventListener("mousemove",e=>{if(document.pointerLockElement===canvas&&started&&!paused){camera.rotation.y+=e.movementX*.0023;camera.rotation.x+=e.movementY*.0023;camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x));}});
document.addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();if(e.code==="Escape"&&started)togglePause();if(e.code==="KeyR")reload();});
document.addEventListener("keyup",e=>{keys[e.code]=false;});
$("start").addEventListener("click",startGame);$("pause").addEventListener("click",togglePause);$("resume").addEventListener("click",togglePause);$("exit").addEventListener("click",leave);$("exit2").addEventListener("click",leave);$("exit3").addEventListener("click",leave);$("reload").addEventListener("click",reload);$("again").addEventListener("click",()=>{resetGame();$("endmenu").classList.add("hide");$("intro").classList.remove("hide");started=false;paused=false;});
})();
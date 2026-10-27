const views = {
  lobby: document.querySelector("#view-lobby"),
  loadout: document.querySelector("#view-loadout"),
  progression: document.querySelector("#view-progression"),
  settings: document.querySelector("#view-settings")
};

const tabButtons = [...document.querySelectorAll("[data-view]")];
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
  tabButtons.forEach(button => {
    button.setAttribute("aria-selected", String(button.dataset.view === name));
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

tabButtons.forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

function showToast(message) {
  toastRoot.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastRoot.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function openModal(title, content) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-backdrop>
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <h2 id="modal-title">${title}</h2>
          <button class="modal-close" type="button" aria-label="Close dialog" data-close>&times;</button>
        </div>
        <div class="modal-content">${content}</div>
      </section>
    </div>`;
  modalRoot.querySelector("[data-close]").addEventListener("click", closeModal);
  modalRoot.querySelector("[data-backdrop]").addEventListener("click", event => {
    if (event.target.matches("[data-backdrop]")) closeModal();
  });
  document.addEventListener("keydown", handleEscape);
  modalRoot.querySelector("input")?.focus();
}

function closeModal() {
  modalRoot.innerHTML = "";
  document.removeEventListener("keydown", handleEscape);
}

function handleEscape(event) {
  if (event.key === "Escape") closeModal();
}

document.querySelector("#host-button").addEventListener("click", () => {
  openModal("Host a LAN match", `
    <p>This will eventually start a match server on this computer so other players on the same network can join.</p>
    <p><strong>Not connected yet:</strong> this lobby is the first UI prototype. LAN hosting will be implemented after the menu and game flow are in place.</p>
    <label class="field-label" for="host-name">Player name</label>
    <input class="field" id="host-name" maxlength="20" placeholder="Enter a name" autocomplete="nickname">
    <div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="host-confirm">Got it</button></div>
  `);
  modalRoot.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
  modalRoot.querySelector("#host-confirm").addEventListener("click", () => {
    const name = modalRoot.querySelector("#host-name").value.trim();
    closeModal();
    showToast(name ? `Player name noted: ${name}. LAN hosting isn't wired up yet.` : "LAN hosting isn't wired up yet.");
  });
});

document.querySelector("#join-button").addEventListener("click", () => {
  openModal("Join a LAN match", `
    <p>Enter the host computer's local network address. Both computers will need to be on the same local network.</p>
    <p><strong>Not connected yet:</strong> this form is a visual prototype; it does not connect to another computer yet.</p>
    <label class="field-label" for="host-address">Host address</label>
    <input class="field" id="host-address" placeholder="Example: 192.168.1.20" inputmode="decimal" autocomplete="off">
    <div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="join-confirm">Continue</button></div>
  `);
  modalRoot.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
  modalRoot.querySelector("#join-confirm").addEventListener("click", () => {
    const address = modalRoot.querySelector("#host-address").value.trim();
    closeModal();
    showToast(address ? `Address noted: ${address}. LAN joining isn't wired up yet.` : "Enter a host address when LAN joining is implemented.");
  });
});

document.querySelector("#deploy-button").addEventListener("click", () => {
  openModal("No match connected", `
    <p>To deploy, you'll need to host a LAN match or join one hosted by another player.</p>
    <p>Multiplayer connection code hasn't been added yet, so this button won't launch a match at this stage.</p>
    <div class="modal-actions"><button class="btn btn-primary" type="button" data-close>Understood</button></div>
  `);
  modalRoot.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
});

document.querySelectorAll("[data-go-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.goView));
});

document.querySelectorAll("[data-coming-soon]").forEach(button => {
  button.addEventListener("click", () => showToast(button.dataset.comingSoon));
});

document.querySelector("#save-settings").addEventListener("click", () => {
  const scale = document.querySelector("#ui-scale").value;
  document.documentElement.style.fontSize = scale + "px";
  showToast("UI scale applied for this page session.");
});


const weaponCores = {
  vanguard: { name: "VANGUARD-01", className: "ASSAULT RIFLE", code: "PLATFORM // VG-01", silhouette: "ar-silhouette", description: "A balanced assault platform built for reliable performance across the middle of the arena.", stats: [["Damage","25"],["Fire rate","600 RPM"],["Recoil","1.0"],["Reload","2.0 sec"],["Range","60 units"]] },
  scope: { name: "SCOPE-01", className: "SNIPER RIFLE", code: "PLATFORM // SC-01", silhouette: "sniper-silhouette", description: "A precision rifle designed to control long sightlines. Powerful per shot, but slow to cycle and reload.", stats: [["Damage","100"],["Fire rate","40 RPM"],["Recoil","3.0"],["Reload","3.0 sec"],["Range","150 units"]] },
  viper: { name: "VIPER-01", className: "SUBMACHINE GUN", code: "PLATFORM // VP-01", silhouette: "smg-silhouette", description: "A compact, fast-firing platform built for aggressive movement and close-range engagements.", stats: [["Damage","15"],["Fire rate","900 RPM"],["Recoil","1.8"],["Reload","1.8 sec"],["Range","30 units"]] },
  bastion: { name: "BASTION-01", className: "LIGHT MACHINE GUN", code: "PLATFORM // BS-01", silhouette: "lmg-silhouette", description: "A heavy support platform built to maintain pressure with sustained fire, trading handling speed for endurance.", stats: [["Damage","20"],["Fire rate","650 RPM"],["Recoil","2.2"],["Reload","4.5 sec"],["Range","70 units"]] },
  breacher: { name: "BREACHER-01", className: "SHOTGUN", code: "PLATFORM // BR-01", silhouette: "shotgun-silhouette", description: "A close-quarters platform that delivers a wide pellet spread. Best used when the target is near.", stats: [["Damage","12 / pellet"],["Fire rate","70 RPM"],["Recoil","2.5"],["Reload","0.6 sec / shell"],["Range","15 units"]] }
};

function selectWeaponCore(coreId) {
  const core = weaponCores[coreId];
  if (!core) return;
  document.querySelectorAll("[data-core]").forEach(button => {
    const selected = button.dataset.core === coreId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.querySelector(".core-check").textContent = selected ? "SELECTED" : "SELECT";
  });
  document.querySelector("#selected-core-name").textContent = core.name;
  document.querySelector("#selected-core-description").textContent = core.description;
  document.querySelector("#selected-core-class").textContent = core.className;
  document.querySelector("#detail-core-code").textContent = core.code;
  const silhouette = document.querySelector("#detail-silhouette");
  silhouette.className = "detail-silhouette " + core.silhouette;
  document.querySelector("#core-stats").innerHTML = core.stats.map(([label,value]) =>
    '<div class="stat-cell"><span>' + label + '</span><strong>' + value + '</strong></div>'
  ).join("");
}

document.querySelectorAll("[data-core]").forEach(button => {
  button.addEventListener("click", () => selectWeaponCore(button.dataset.core));
});


/* Weapon builder: edits remain a draft until Save Loadout is pressed. */
const weaponCores = {
  vanguard: { name:"VANGUARD-01", className:"ASSAULT RIFLE", base:{damage:25,rate:600,recoil:1,reload:2,range:60}, magazine:30 },
  scope: { name:"SCOPE-01", className:"SNIPER RIFLE", base:{damage:100,rate:40,recoil:3,reload:3,range:150}, magazine:5 },
  viper: { name:"VIPER-01", className:"SUBMACHINE GUN", base:{damage:15,rate:900,recoil:1.8,reload:1.8,range:30}, magazine:30 },
  bastion: { name:"BASTION-01", className:"LIGHT MACHINE GUN", base:{damage:20,rate:650,recoil:2.2,reload:4.5,range:70}, magazine:50 },
  breacher: { name:"BREACHER-01", className:"SHOTGUN", base:{damage:12,rate:70,recoil:2.5,reload:0.6,range:15}, magazine:8 }
};
const partData = {
 barrel: {
  "ar-standard":{name:"AR Standard Barrel",damage:0,recoil:0,range:0},
  "ar-heavy":{name:"AR Heavy Barrel",damage:10,recoil:8,range:8},
  "ar-control":{name:"AR Control Barrel",damage:-5,recoil:-15,range:0},
  "sniper-long":{name:"Scope Long Barrel",damage:8,recoil:5,range:12},
  "smg-short":{name:"Viper Short Barrel",damage:-5,recoil:-10,range:-8}
 },
 stock: {
  "ar-standard":{name:"AR Standard Stock",recoil:0,reload:0},
  "ar-stable":{name:"AR Stability Stock",recoil:-15,reload:5},
  "ar-light":{name:"AR Lightweight Stock",recoil:8,reload:-10},
  "sniper-precision":{name:"Scope Precision Stock",recoil:-10,reload:10},
  "smg-compact":{name:"Viper Compact Stock",recoil:-5,reload:-8}
 },
 magazine: {
  "ar-standard":{name:"AR Standard Magazine",capacity:30,damage:0,reload:0},
  "ar-extended":{name:"AR Extended Magazine",capacity:45,damage:-5,reload:12},
  "ar-quick":{name:"AR Quick-Load Magazine",capacity:25,damage:0,reload:-15},
  "sniper-standard":{name:"Scope Standard Magazine",capacity:5,damage:0,reload:0},
  "smg-extended":{name:"Viper Extended Magazine",capacity:40,damage:-5,reload:10}
 },
 scope: {
  iron:{name:"Iron Sights",zoom:1},
  sniper:{name:"Sniper Scope",zoom:4}
 }
};
const defaultDraft = {core:"vanguard",barrel:"ar-standard",stock:"ar-standard",magazine:"ar-standard",scope:"iron"};
let draftLoadout = {...defaultDraft};
let savedLoadout = {...defaultDraft};
let savedStats = null;

function getDraftStats() {
 const core=weaponCores[draftLoadout.core];
 const base={...core.base};
 const barrel=partData.barrel[draftLoadout.barrel];
 const stock=partData.stock[draftLoadout.stock];
 const mag=partData.magazine[draftLoadout.magazine];
 const apply=(key,pct)=>{base[key]=Math.round(base[key]*(1+pct/100)*100)/100;};
 apply("damage",barrel.damage||0); apply("recoil",barrel.recoil||0);
 apply("range",barrel.range||0);
 apply("recoil",stock.recoil||0); apply("reload",stock.reload||0);
 apply("damage",mag.damage||0); apply("reload",mag.reload||0);
 return { ...base, capacity:mag.capacity, zoom:partData.scope[draftLoadout.scope].zoom };
}
function syncBuilderFromDraft() {
 document.querySelectorAll("[data-core]").forEach(button=>{
  const selected=button.dataset.core===draftLoadout.core;
  button.classList.toggle("is-selected",selected);
  button.setAttribute("aria-pressed",String(selected));
  button.querySelector(".core-check").textContent=selected?"SELECTED":"SELECT";
 });
 ["barrel","stock","magazine","scope"].forEach(slot=>{
  document.querySelector("#part-"+slot).value=draftLoadout[slot];
 });
 const core=weaponCores[draftLoadout.core];
 const stats=getDraftStats();
 document.querySelector("#preview-weapon-name").textContent=core.name;
 document.querySelector("#preview-weapon-class").textContent=core.className;
 document.querySelector("#preview-mag-capacity").textContent=stats.capacity+" ROUND MAG";
 const statItems=[
  ["DAMAGE",stats.damage,draftLoadout.core==="breacher"?"per pellet":"per shot"],
  ["FIRE RATE",stats.rate+" RPM","base rate"],
  ["RECOIL",stats.recoil,"lower is steadier"],
  ["RELOAD TIME",stats.reload+(draftDraftIsShotgun()?" sec / shell":" sec"),"lower is faster"],
  ["RANGE",stats.range+" units","effective range"]
 ];
 document.querySelector("#total-stat-grid").innerHTML=statItems.map(([label,value,note])=>
  '<div class="total-stat"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></div>'
 ).join("");
 const changed=JSON.stringify(draftLoadout)!==JSON.stringify(savedLoadout);
 document.querySelector("#saved-status").classList.toggle("has-unsaved",changed);
 document.querySelector("#saved-loadout-name").textContent=weaponCores[savedLoadout.core].name;
 document.querySelector("#save-help").textContent=changed?
  "Your saved gun is unchanged. Save to use this new configuration in your next match.":
  "Your current draft matches your saved loadout.";
 document.querySelector("#saved-confirmation").hidden=true;
}
function draftDraftIsShotgun(){return draftLoadout.core==="breacher";}
document.querySelectorAll("[data-core]").forEach(button=>button.addEventListener("click",()=>{
 draftLoadout.core=button.dataset.core; syncBuilderFromDraft();
}));
["barrel","stock","magazine","scope"].forEach(slot=>{
 document.querySelector("#part-"+slot).addEventListener("change",event=>{
  draftLoadout[slot]=event.target.value; syncBuilderFromDraft();
 });
});
document.querySelector("#save-loadout").addEventListener("click",()=>{
 savedLoadout={...draftLoadout};
 savedStats=getDraftStats();
 document.querySelector("#saved-loadout-name").textContent=weaponCores[savedLoadout.core].name;
 document.querySelector("#saved-status").classList.remove("has-unsaved");
 document.querySelector("#save-help").textContent="Saved configuration locked in for your next match.";
 document.querySelector("#saved-confirmation").hidden=false;
 document.querySelector("#saved-confirmation").innerHTML="<span>✓</span> LOADOUT SAVED — "+weaponCores[savedLoadout.core].name+" IS SET FOR YOUR NEXT MATCH.";
});
syncBuilderFromDraft();

showView("lobby");

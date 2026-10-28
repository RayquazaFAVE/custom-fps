(() => {
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const views = {
  lobby: $("#view-lobby"),
  loadout: $("#view-loadout"),
  progression: $("#view-progression"),
  settings: $("#view-settings")
};
const modalRoot = $("#modal-root");
const toastRoot = $("#toast-root");

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    if (element) element.hidden = key !== name;
  });
  $$("[data-view]").forEach(button => {
    button.setAttribute("aria-selected", String(button.dataset.view === name));
  });
  window.scrollTo({top: 0, behavior: "smooth"});
}
function showToast(message) {
  if (!toastRoot) return;
  toastRoot.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastRoot.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}
function closeModal() {
  if (modalRoot) modalRoot.innerHTML = "";
  document.removeEventListener("keydown", handleEscape);
}
function handleEscape(event) {
  if (event.key === "Escape") closeModal();
}
function openModal(title, content) {
  if (!modalRoot) return;
  modalRoot.innerHTML = '<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2></h2><button class="modal-close" type="button" aria-label="Close dialog" data-close>&times;</button></div><div class="modal-content"></div></section></div>';
  modalRoot.querySelector("h2").textContent = title;
  modalRoot.querySelector(".modal-content").innerHTML = content;
  modalRoot.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
  modalRoot.querySelector("[data-backdrop]").addEventListener("click", event => {
    if (event.target.matches("[data-backdrop]")) closeModal();
  });
  document.addEventListener("keydown", handleEscape);
  modalRoot.querySelector("input")?.focus();
}

$$("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$$("[data-go-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.goView)));
$$("[data-coming-soon]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.comingSoon)));

const hostButton = $("#host-button");
if (hostButton) hostButton.addEventListener("click", () => {
  openModal("Host a LAN match", '<p>This will eventually start a match server on this computer so other players on the same network can join.</p><p><strong>Not connected yet:</strong> LAN hosting is not implemented in this prototype.</p><label class="field-label" for="host-name">Player name</label><input class="field" id="host-name" maxlength="20" placeholder="Enter a name" autocomplete="nickname"><div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="host-confirm">Got it</button></div>');
  $("#host-confirm").addEventListener("click", () => {
    const name = $("#host-name").value.trim();
    closeModal();
    showToast(name ? "Player name noted: " + name + ". LAN hosting is not connected yet." : "LAN hosting is not connected yet.");
  });
});
const joinButton = $("#join-button");
if (joinButton) joinButton.addEventListener("click", () => {
  openModal("Join a LAN match", '<p>Enter the host computer\'s local network address. Both computers must be on the same local network.</p><p><strong>Not connected yet:</strong> LAN joining is not implemented in this prototype.</p><label class="field-label" for="host-address">Host address</label><input class="field" id="host-address" placeholder="Example: 192.168.1.20" inputmode="decimal" autocomplete="off"><div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="join-confirm">Continue</button></div>');
  $("#join-confirm").addEventListener("click", () => {
    const address = $("#host-address").value.trim();
    closeModal();
    showToast(address ? "Address noted: " + address + ". LAN joining is not connected yet." : "Enter a host address when LAN joining is implemented.");
  });
});
const deployButton = $("#deploy-button");
if (deployButton) deployButton.addEventListener("click", () => {
  window.location.href = "game.html?v=babylon-1";
});
const settingsButton = $("#save-settings");
if (settingsButton) settingsButton.addEventListener("click", () => {
  const input = $("#ui-scale");
  const scale = Math.max(14, Math.min(20, Number(input?.value) || 16));
  document.documentElement.style.fontSize = scale + "px";
  showToast("UI scale applied for this page session.");
});

const weaponCores = {
  vanguard: {name:"M4A1 CARBINE", className:"ASSAULT RIFLE", base:{damage:31,rate:750,recoil:1.15,reload:2.2,range:75}},
  viper: {name:"MP5", className:"SUBMACHINE GUN", base:{damage:20,rate:800,recoil:1.45,reload:2.0,range:38}},
  breacher: {name:"REMINGTON 870", className:"PUMP-ACTION SHOTGUN", base:{damage:12,rate:75,recoil:3.1,reload:0.55,range:20}},
  scope: {name:"ARCTIC WARFARE", className:"SNIPER RIFLE", base:{damage:100,rate:40,recoil:3.4,reload:2.8,range:150}},
  bastion: {name:"M249 SAW", className:"LIGHT MACHINE GUN", base:{damage:24,rate:750,recoil:2.35,reload:4.5,range:85}}
};
const parts = {
  barrel: {
    "m4a1-barrel":{damage:0,recoil:0,range:0},
    "mp5-barrel":{damage:-8,recoil:-8,range:-18},
    "870-barrel":{damage:5,recoil:10,range:-25},
    "aw-barrel":{damage:12,recoil:8,range:20},
    "m249-barrel":{damage:4,recoil:12,range:8}
  },
  stock: {
    "m4a1-stock":{recoil:-5,reload:0},
    "mp5-stock":{recoil:8,reload:-5},
    "870-stock":{recoil:-5,reload:0},
    "aw-stock":{recoil:-18,reload:8},
    "m249-stock":{recoil:-12,reload:12}
  },
  magazine: {
    "m4a1-mag":{capacity:30,damage:0,reload:0},
    "mp5-mag":{capacity:30,damage:0,reload:-5},
    "870-mag":{capacity:7,damage:0,reload:0},
    "aw-mag":{capacity:5,damage:0,reload:0},
    "m249-mag":{capacity:100,damage:-4,reload:18}
  },
  scope: {
    "iron-sights":{zoom:1.5},
    "aw-sight":{zoom:6}
  }
};
const defaults = {core:"vanguard",barrel:"m4a1-barrel",stock:"m4a1-stock",magazine:"m4a1-mag",scope:"iron-sights"};
let draft = {...defaults};
let saved = {...defaults};

function statsFor(loadout) {
  const result = {...weaponCores[loadout.core].base};
  const barrel = parts.barrel[loadout.barrel] || {};
  const stock = parts.stock[loadout.stock] || {};
  const mag = parts.magazine[loadout.magazine] || {};
  const apply = (key, percent) => { result[key] = Math.round(result[key] * (1 + percent / 100) * 100) / 100; };
  apply("damage", barrel.damage || 0); apply("recoil", barrel.recoil || 0); apply("range", barrel.range || 0);
  apply("recoil", stock.recoil || 0); apply("reload", stock.reload || 0);
  apply("damage", mag.damage || 0); apply("reload", mag.reload || 0);
  result.capacity = mag.capacity || 30;
  result.zoom = parts.scope[loadout.scope]?.zoom || 1;
  return result;
}
function syncBuilder() {
  $$("[data-core]").forEach(button => {
    const selected = button.dataset.core === draft.core;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    const check = button.querySelector(".core-check");
    if (check) check.textContent = selected ? "SELECTED" : "SELECT";
  });
  ["barrel","stock","magazine","scope"].forEach(slot => {
    const select = $("#part-" + slot);
    if (select) { if (!parts[slot][draft[slot]]) draft[slot] = defaults[slot]; select.value = draft[slot]; }
  });
  const core = weaponCores[draft.core];
  const stats = statsFor(draft);
  if ($("#preview-weapon-name")) $("#preview-weapon-name").textContent = core.name;
  if ($("#preview-weapon-class")) $("#preview-weapon-class").textContent = core.className;
  if ($("#preview-mag-capacity")) $("#preview-mag-capacity").textContent = stats.capacity + (draft.core === "breacher" ? " SHELL TUBE" : " ROUND MAG");
  if ($("#total-stat-grid")) {
    const items = [
      ["DAMAGE", stats.damage, draft.core === "breacher" ? "per pellet" : "per shot"],
      ["FIRE RATE", stats.rate + " RPM", "base rate"],
      ["RECOIL", stats.recoil, "lower is steadier"],
      ["RELOAD TIME", stats.reload + (draft.core === "breacher" ? " sec / shell" : " sec"), "lower is faster"],
      ["RANGE", stats.range + " units", "effective range"]
    ];
    $("#total-stat-grid").innerHTML = items.map(item => '<div class="total-stat"><span>'+item[0]+'</span><strong>'+item[1]+'</strong><small>'+item[2]+'</small></div>').join("");
  }
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  if ($("#saved-status")) $("#saved-status").classList.toggle("has-unsaved", changed);
  if ($("#saved-loadout-name")) $("#saved-loadout-name").textContent = weaponCores[saved.core].name;
  if ($("#save-help")) $("#save-help").textContent = changed ? "Your saved gun is unchanged. Save to use this new configuration in your next match." : "Your current draft matches your saved loadout.";
  if ($("#saved-confirmation")) $("#saved-confirmation").hidden = true;
}
$$("[data-core]").forEach(button => button.addEventListener("click", () => {
  if (!weaponCores[button.dataset.core]) return;
  draft.core = button.dataset.core;
  syncBuilder();
}));
["barrel","stock","magazine","scope"].forEach(slot => {
  const select = $("#part-" + slot);
  if (select) select.addEventListener("change", () => { draft[slot] = select.value; syncBuilder(); });
});
const saveButton = $("#save-loadout");
if (saveButton) saveButton.addEventListener("click", () => {
  saved = {...draft};
  try {
    localStorage.setItem("customfps-loadout", JSON.stringify({
      loadout: {...saved},
      stats: statsFor(saved),
      core: weaponCores[saved.core]
    }));
  } catch (error) {
    console.warn("Could not persist loadout in this browser.", error);
  }
  syncBuilder();
  if ($("#saved-confirmation")) {
    $("#saved-confirmation").hidden = false;
    $("#saved-confirmation").innerHTML = "<span>✓</span> LOADOUT SAVED — " + weaponCores[saved.core].name + " IS SET FOR YOUR NEXT MATCH.";
  }
  showView("lobby");
  showToast("LOADOUT SAVED SUCCESSFULLY — " + weaponCores[saved.core].name + " is ready for your next match.");
});

syncBuilder();
showView("lobby");
})();
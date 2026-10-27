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

showView("lobby");

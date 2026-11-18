(() => {
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const views = {
  lobby: $("#view-lobby"),
  loadout: $("#view-loadout"),
  shop: $("#view-shop"),
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
  openModal("Join a LAN match", "<p>Enter the host computer's local network address. Both computers must be on the same local network.</p><p><strong>Not connected yet:</strong> LAN joining is not implemented in this prototype.</p><label class=\"field-label\" for=\"host-address\">Host address</label><input class=\"field\" id=\"host-address\" placeholder=\"Example: 192.168.1.20\" inputmode=\"decimal\" autocomplete=\"off\"><div class=\"modal-actions\"><button class=\"btn btn-secondary\" type=\"button\" data-close>Cancel</button><button class=\"btn btn-primary\" type=\"button\" id=\"join-confirm\">Continue</button></div>");
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

// ---- Currency / Shop (session-only, no persistence) ----
const catalog = window.CustomFPSWeapons;
const { weapons: weaponCatalog, classes: weaponClasses, primaries, secondaries, getWeapon, defaultLoadout, normalizeLoadout } = catalog;
const weaponById = Object.fromEntries(weaponCatalog.map(w => [w.id, w]));

// ---------- Browser-Saved Account System ----------
const ACCOUNTS_KEY = "customfps_accounts_v1";
const SESSION_KEY = "customfps_session_v1";

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getCurrentAccount() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session || !session.username) return null;
    const accounts = loadAccounts();
    return accounts[session.username.toLowerCase()] || null;
  } catch {
    return null;
  }
}

async function hashPassword(password) {
  if (window.crypto && crypto.subtle && window.TextEncoder) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 2166136261;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function updateAccountUI() {
  const acc = getCurrentAccount();
  const badge = $("#header-account");
  const signInBtn = $("#sign-in-btn");
  const signOutBtn = $("#sign-out-btn");
  if (badge) {
    badge.innerHTML = acc
      ? 'OPERATOR <strong>' + acc.username.toUpperCase() + '</strong>'
      : 'NOT SIGNED IN';
  }
  if (signInBtn) {
    signInBtn.hidden = !!acc;
  }
  if (signOutBtn) {
    signOutBtn.hidden = !acc;
  }
}

function openAuthModal(defaultMode = "signin") {
  let mode = defaultMode;
  function render() {
    const isSignup = mode === "signup";
    $("#modal-root").innerHTML =
      '<div class="modal-backdrop" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">' +
      '<div class="eyebrow">Browser Account</div><h3 id="auth-modal-title">' + (isSignup ? "Create Account" : "Sign In") + '</h3>' +
      '<p>' + (isSignup ? "Create an account saved in your browser." : "Sign in with your saved browser account.") + '</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<button class="btn ' + (!isSignup ? "btn-primary" : "btn-secondary") + '" type="button" data-auth-mode="signin" style="flex:1;">Sign In</button>' +
      '<button class="btn ' + (isSignup ? "btn-primary" : "btn-secondary") + '" type="button" data-auth-mode="signup" style="flex:1;">Create Account</button>' +
      '</div>' +
      '<label class="field-label" for="auth-username">Username</label>' +
      '<input class="field" id="auth-username" type="text" maxlength="20" autocomplete="username" placeholder="Enter username">' +
      '<label class="field-label" for="auth-password" style="margin-top:10px;">Password</label>' +
      '<input class="field" id="auth-password" type="password" autocomplete="' + (isSignup ? "new-password" : "current-password") + '" placeholder="Enter password">' +
      (isSignup ? '<label class="field-label" for="auth-confirm" style="margin-top:10px;">Confirm Password</label><input class="field" id="auth-confirm" type="password" autocomplete="new-password" placeholder="Confirm password">' : '') +
      '<p id="auth-error" style="color:#ff6b6b;font-size:12px;min-height:18px;margin-top:8px;"></p>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-primary" type="button" id="auth-submit">' + (isSignup ? "Create Account" : "Sign In") + '</button>' +
      '</div></div></div>';

    $$("[data-auth-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.authMode;
        render();
      });
    });

    $("#auth-submit").addEventListener("click", async () => {
      const username = ($("#auth-username").value || "").trim();
      const password = $("#auth-password").value || "";
      const errEl = $("#auth-error");
      if (username.length < 2) { errEl.textContent = "Username must be at least 2 characters."; return; }
      if (password.length < 4) { errEl.textContent = "Password must be at least 4 characters."; return; }

      const accounts = loadAccounts();
      const key = username.toLowerCase();
      const passwordHash = await hashPassword(password);

      if (isSignup) {
        const confirm = $("#auth-confirm").value || "";
        if (password !== confirm) { errEl.textContent = "Passwords do not match."; return; }
        if (accounts[key]) { errEl.textContent = "An account with that username already exists."; return; }
        accounts[key] = { username, passwordHash, createdAt: Date.now() };
        saveAccounts(accounts);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
        closeModal();
        updateAccountUI();
        showToast("Account created & signed in as " + username + ".");
      } else {
        const existing = accounts[key];
        if (!existing || existing.passwordHash !== passwordHash) {
          errEl.textContent = "Invalid username or password.";
          return;
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: existing.username }));
        closeModal();
        updateAccountUI();
        showToast("Signed in as " + existing.username + ".");
      }
    });
  }
  render();
}

$("#sign-out-btn")?.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  updateAccountUI();
  showToast("Signed out.");
  openAuthModal("signin");
});

// ---- Loadout: Primary + Secondary (session-only, no persistence) ----
let loadout = defaultLoadout(); // Vandal primary + Classic secondary

function saveLoadout() {
  // Session-only: persists loadout within the current browser tab so it
  // carries from the lobby to the match. Clears when the tab is closed.
  try{sessionStorage.setItem("customfps-loadout",JSON.stringify({loadout}));}catch(e){}
}
function saveOwned() {
  // Session-only: nothing is persisted
}
function saveCredits() {
  // Session-only: nothing is persisted
}

function renderCoreCatalog() {
  const container = $("#weapon-cores");
  const filterEl = $("#weapon-class-filter");
  if (!container || !filterEl) return;
  let classFilter = "all";

  const weaponList = classFilter === "all" ? weaponCatalog : weaponCatalog.filter(w => w.classId === classFilter);

  filterEl.innerHTML = [{id: "all", shortName: "ALL", name: "All weapon classes"}, ...weaponClasses].map(group =>
    '<button type="button" class="class-filter' + (group.id === classFilter ? " is-active" : "") + '" data-class-filter="' + group.id + '" aria-pressed="' + (group.id === classFilter) + '" title="' + group.name + '">' + group.shortName + '</button>'
  ).join("");

  // In the loadout view, only show owned weapons. All primaries are free/owned;
  // sidearms must be purchased in the shop first.
  const ownedWeaponIds = new Set(weaponCatalog.filter(w => (w.classId !== "sidearm" && w.classId !== "melee") || ownedSecondaries.has(w.id)).map(w => w.id));

  container.innerHTML = weaponClasses.map(group => {
    const cores = catalog.coresInClass(group.id)
      .filter(w => (classFilter === "all" || w.classId === classFilter) && ownedWeaponIds.has(w.id));
    if (cores.length === 0) return "";
    const isSidearm = group.id === "sidearm";
    return '<section class="weapon-class-group" data-class-group="' + group.id + '"' + (classFilter !== "all" && classFilter !== group.id ? " hidden" : "") + ' aria-labelledby="class-title-' + group.id + '">' +
      '<div class="weapon-class-heading"><h4 id="class-title-' + group.id + '"><span>' + group.key + '</span>' + group.name + '</h4><small>' + cores.length + ' ' + (isSidearm ? "SIDEARMS" : "CORES") + '</small></div>' +
      '<div class="core-selection builder-core-selection" role="group" aria-label="Choose a ' + group.name.toLowerCase() + '">' + cores.map((core, index) => {
      const isEquipped = loadout.core === core.id || loadout.secondary === core.id;
      const slot = loadout.core === core.id ? "PRIMARY" : loadout.secondary === core.id ? "SECONDARY" : "";
      const priceText = core.cost === 0 ? "FREE" : "OWNED";
      return '<button class="core-card' + (isEquipped ? " is-equipped" : "") + '" type="button" data-core="' + core.id + '" aria-pressed="false">' +
        '<span class="core-card-top"><span class="core-index">' + group.shortName + ' 0' + (index + 1) + '</span><span class="core-badges"><span class="price-tag">' + priceText + '</span>' + (isEquipped ? '<span class="core-check">EQUIPPED ' + slot + '</span>' : '<span class="core-check">SELECT</span>') + '</span></span>' +
        '<span class="core-silhouette ' + group.silhouette + '" aria-hidden="true"></span>' +
        '<strong>' + core.name + '</strong><span class="core-role">' + core.role + '</span>' +
        '<span class="core-base-stats"><span><small>DMG</small><b>' + core.base.damage + '</b></span><span><small>RPM</small><b>' + core.base.rate + '</b></span><span><small>MAG</small><b>' + core.base.capacity + '</b></span></span>' +
        '</button>';
    }).join("") + '</div></section>';
  }).join("");

  filterEl.querySelectorAll("[data-class-filter]").forEach(button => {
    button.addEventListener("click", () => {
      classFilter = button.dataset.classFilter;
      renderCoreCatalog();
      filterEl.querySelector('[data-class-filter="' + classFilter + '"]')?.focus({preventScroll: true});
    });
  });

  container.querySelectorAll("[data-core]").forEach(button => {
    button.addEventListener("click", () => {
      const coreId = button.dataset.core;
      const core = getWeapon(coreId);
      if (!core) return;
      if (core.classId === "sidearm") {
        loadout.secondary = coreId;
      } else {
        loadout.core = coreId;
      }
      saveLoadout();
      renderCoreCatalog();
      renderLoadoutPanel();
      showToast(core.name + " " + (core.classId === "sidearm" ? "secondary" : "primary") + " equipped.");
    });
  });
}

function renderLoadoutPanel() {
  const primary = getWeapon(loadout.core);
  const secondary = getWeapon(loadout.secondary);
  const pEl = $("#equipped-primary");
  const sEl = $("#equipped-secondary");
  if (pEl) pEl.textContent = primary ? primary.name : "NONE";
  if (sEl) sEl.textContent = secondary ? secondary.name : "NONE";
  const primaryStats = $("#primary-stats");
  const secondaryStats = $("#secondary-stats");
  if (primary && primaryStats) {
    primaryStats.innerHTML = '<div class="stat-row"><span>DMG</span><strong>' + primary.base.damage + '</strong></div><div class="stat-row"><span>RPM</span><strong>' + primary.base.rate + '</strong></div><div class="stat-row"><span>MAG</span><strong>' + primary.base.capacity + '</strong></div><div class="stat-row"><span>RANGE</span><strong>' + primary.base.range + 'm</strong></div>';
  }
  if (secondary && secondaryStats) {
    secondaryStats.innerHTML = '<div class="stat-row"><span>DMG</span><strong>' + secondary.base.damage + '</strong></div><div class="stat-row"><span>RPM</span><strong>' + secondary.base.rate + '</strong></div><div class="stat-row"><span>MAG</span><strong>' + secondary.base.capacity + '</strong></div><div class="stat-row"><span>RANGE</span><strong>' + secondary.base.range + 'm</strong></div>';
  }
}

function renderShop() {
  const container = $("#shop-list");
  if (!container) return;
  const purchasable = secondaries().filter(w => !ownedSecondaries.has(w.id));
  container.innerHTML = purchasable.map(w => {
    const b = w.base;
    const canAfford = credits >= w.cost;
    const headshot = b.headshot || b.damage;
    const legs = b.legs || b.damage;
    return '<div class="shop-item' + (canAfford ? "" : " locked") + '">' +
      '<div class="shop-info">' +
      '<strong>' + w.name + '</strong>' +
      '<span class="shop-role">' + w.role + '</span>' +
      '<p class="shop-desc">' + w.description + '</p>' +
      '<div class="shop-stats">' +
      '<div class="stat-row"><span>DMG</span><strong>' + b.damage + '</strong></div>' +
      '<div class="stat-row"><span>HEAD</span><strong>' + headshot + '</strong></div>' +
      '<div class="stat-row"><span>LEGS</span><strong>' + legs + '</strong></div>' +
      '<div class="stat-row"><span>RPM</span><strong>' + b.rate + '</strong></div>' +
      '<div class="stat-row"><span>MAG</span><strong>' + b.capacity + '</strong></div>' +
      '<div class="stat-row"><span>RANGE</span><strong>' + b.range + 'm</strong></div>' +
      '</div>' +
      '<div class="shop-ability"><strong>Ability:</strong> ' + w.role + '</div>' +
      '</div>' +
      '<div class="shop-buy">' +
      '<span class="price">' + w.cost + ' CR</span>' +
      '<button class="btn' + (canAfford ? " btn-primary" : " btn-secondary disabled") + '" data-buy="' + w.id + '"' + (!canAfford ? " disabled" : "") + '>' + (canAfford ? "BUY" : "UNAFFORDABLE") + '</button>' +
      '</div></div>';
  }).join("");
  container.querySelectorAll("[data-buy]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.buy;
      const w = getWeapon(id);
      if (!w || ownedSecondaries.has(id)) return;
      if (credits < w.cost) { showToast("Not enough credits."); return; }
      credits -= w.cost;
      saveCredits();
      renderCredits();
      const creditsEl = $("#shop-credits");
      if (creditsEl) creditsEl.textContent = credits.toLocaleString();
      ownedSecondaries.add(id);
      saveOwned();
      renderShop();
      renderCoreCatalog();
      showToast("PURCHASED " + w.name + " — " + w.cost + " credits.");
    });
  });
}

renderCredits();
renderCoreCatalog();
renderLoadoutPanel();
renderShop();

const saveButton = $("#save-loadout");
if (saveButton) {
  saveButton.textContent = "SAVE LOADOUT";
  saveButton.addEventListener("click", () => {
    saveLoadout();
    showView("lobby");
    showToast("LOADOUT SAVED — PRIMARY: " + getWeapon(loadout.core).name + " · SECONDARY: " + getWeapon(loadout.secondary).name);
  });
}

})();
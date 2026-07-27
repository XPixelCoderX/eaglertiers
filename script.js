// ===== CONFIGURATION =====
const PROXY_URL = "https://proxy.corsfix.com/?";
const API_BASE = "https://eaglertiers.com/api";

function apiUrl(path) {
  const full = `${API_BASE}${path}`;
  return PROXY_URL ? `${PROXY_URL}${full}` : full;
}
// =========================

const GAMEMODES = [
  { id: "overall", label: "Overall", icon: "assets/gamemodes/overall.png" },
  { id: "vanilla", label: "Vanilla", icon: "assets/gamemodes/smaller-vanilla-pvp.png" },
  { id: "mace", label: "Mace", icon: "assets/gamemodes/mace-pvp.png" },
  { id: "axe", label: "Axe", icon: "assets/gamemodes/axe-pvp.png" },
  { id: "sword", label: "Sword", icon: "assets/gamemodes/sword-pvp.png" },
  { id: "smp", label: "SMP", icon: "assets/gamemodes/smp.png" },
  { id: "diamondsmp", label: "Diamond SMP", icon: "assets/gamemodes/diamond-smp.png" },
  { id: "uhc", label: "UHC", icon: "assets/gamemodes/uhc.png" },
  { id: "pot", label: "Pot", icon: "assets/gamemodes/pot-pvp.png" },
  { id: "nethop", label: "Neth OP", icon: "assets/gamemodes/neth-op.png" },
  { id: "cart", label: "Cart", icon: "assets/gamemodes/cart-pvp.png" },
];

const MODE_ICON_PATH = {
  vanilla: "assets/gamemodes/smaller-vanilla-pvp.png",
  mace: "assets/gamemodes/mace-pvp.png",
  axe: "assets/gamemodes/axe-pvp.png",
  sword: "assets/gamemodes/sword-pvp.png",
  smp: "assets/gamemodes/smp.png",
  diamondsmp: "assets/gamemodes/diamond-smp.png",
  uhc: "assets/gamemodes/uhc.png",
  pot: "assets/gamemodes/pot-pvp.png",
  nethop: "assets/gamemodes/neth-op.png",
  cart: "assets/gamemodes/cart-pvp.png",
};

const MODE_LABELS = {
  vanilla: "Vanilla",
  mace: "Mace",
  axe: "Axe",
  sword: "Sword",
  smp: "SMP",
  diamondsmp: "Diamond SMP",
  uhc: "UHC",
  pot: "Pot",
  nethop: "Neth OP",
  cart: "Cart",
};

const TIER_POINTS = {
  HT1: 60,
  LT1: 45,
  HT2: 30,
  LT2: 20,
  HT3: 10,
  LT3: 6,
  HT4: 4,
  LT4: 3,
  HT5: 2,
  LT5: 1,
};

function getAvatarUrl(username) {
  return `https://render.crafty.gg/3d/bust/${encodeURIComponent(username)}`;
}

const state = {
  gamemode: "overall",
  page: 1,
  totalPages: 1,
  totalItems: 0,
  players: [],
};
const profileCache = new Map();
const searchCache = new Map();
let activeSearchController = null;

const tabsEl = document.getElementById("tabs");
const rankingListEl = document.getElementById("rankingList");
const listHeadEl = document.querySelector(".list-head");
const viewTitleEl = document.getElementById("viewTitle");
const statusLabelEl = document.getElementById("statusLabel");
const loadingStateEl = document.getElementById("loadingState");
const errorStateEl = document.getElementById("errorState");
const paginationEl = document.getElementById("pagination");
const pageInfoEl = document.getElementById("pageInfo");
const prevPageEl = document.getElementById("prevPage");
const nextPageEl = document.getElementById("nextPage");
const searchInputEl = document.getElementById("searchInput");
const searchDropdownEl = document.getElementById("searchDropdown");
const profileOverlayEl = document.getElementById("profileOverlay");
const profileModalEl = document.getElementById("profileModal");
const profileCloseBtnEl = document.getElementById("profileCloseBtn");
const profileLoadingEl = document.getElementById("profileLoading");
const profileErrorEl = document.getElementById("profileError");
const profileContentEl = document.getElementById("profileContent");
const profileAvatarEl = document.getElementById("profileAvatar");
const profileUsernameEl = document.getElementById("profileUsername");
const profileRegionEl = document.getElementById("profileRegion");
const profileTopPointsEl = document.getElementById("profileTopPoints");
const profilePositionEl = document.getElementById("profilePosition");
const profileTiersEl = document.getElementById("profileTiers");

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function tierColorClass(tier) {
  if (!tier) {
    return "";
  }
  return tier.toLowerCase();
}

function buildTabs() {
  tabsEl.innerHTML = GAMEMODES.map(
    (mode) => `
      <button
        class="tab-btn ${mode.id === state.gamemode ? "active" : ""}"
        data-mode="${mode.id}"
        title="${mode.label}"
        aria-label="${mode.label}"
      >
        <img src="${mode.icon}" alt="${mode.label}" class="tab-icon" />
        <span class="sr-only">${mode.label}</span>
      </button>
    `
  ).join("");

  tabsEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === state.gamemode) {
        return;
      }
      state.gamemode = mode;
      state.page = 1;
      buildTabs();
      loadRankings();
    });
  });
}

function closeProfileModal() {
  profileOverlayEl.classList.add("hidden");
  profileOverlayEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderProfileModal(player) {
  profileAvatarEl.src = getAvatarUrl(player.username);
  profileAvatarEl.alt = `${player.username} avatar`;
  profileUsernameEl.textContent = player.username;
  profilePositionEl.textContent = `#${player.position}`;
  const profileTopClass =
    player.position === 1 ? "position-top-1" : player.position === 2 ? "position-top-2" : player.position === 3 ? "position-top-3" : "";
  profilePositionEl.className = `position-rank ${profileTopClass}`.trim();
  const region = String(player.region || "NA").toUpperCase();
  profileRegionEl.textContent = region;
  profileRegionEl.className = `profile-region region-${region.toLowerCase()}`;
  profileTopPointsEl.textContent = `${player.totalPoints} points`;

  const sortedProfileTiers = Object.entries(player.tiers || {})
    .filter(([, tier]) => tier)
    .map(([mode, tier]) => ({
      mode,
      tier,
      points: TIER_POINTS[tier] || 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return (MODE_LABELS[a.mode] || a.mode).localeCompare(MODE_LABELS[b.mode] || b.mode);
    });

  const maxTierSlots = 10;
  const filledSlots = sortedProfileTiers.slice(0, maxTierSlots);
  const emptySlots = Math.max(maxTierSlots - filledSlots.length, 0);

  profileTiersEl.innerHTML = [
    ...filledSlots.map(
      ({ mode, tier, points }) => `
        <div class="profile-tier-bubble filled">
          <span class="profile-tier-icon-wrap ${tierColorClass(tier)}" data-tier="${tier}" data-points="${points}">
            <img src="${MODE_ICON_PATH[mode]}" alt="${MODE_LABELS[mode] || mode}" />
            <span class="tier-hover-pop" role="tooltip">
              <strong>${tier}</strong>
              <span>${points} points</span>
            </span>
          </span>
          <span class="profile-tier-tag ${tierColorClass(tier)}">${tier}</span>
        </div>
      `
    ),
    ...Array.from({ length: emptySlots }).map(
      () => `
        <div class="profile-tier-bubble empty">
          <span class="profile-tier-icon-wrap"></span>
          <span class="profile-tier-tag muted">-</span>
        </div>
      `
    ),
  ].join("");

  if (!profileTiersEl.innerHTML) {
    profileTiersEl.innerHTML = `<p class="profile-tier-empty">No gamemode tiers assigned yet</p>`;
  }
}

async function openProfileModal(username) {
  profileOverlayEl.classList.remove("hidden");
  profileOverlayEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  profileLoadingEl.classList.remove("hidden");
  profileErrorEl.classList.add("hidden");
  profileErrorEl.textContent = "";
  profileContentEl.classList.add("hidden");

  try {
    if (profileCache.has(username)) {
      renderProfileModal(profileCache.get(username));
      profileContentEl.classList.remove("hidden");
      return;
    }

    const response = await fetch(apiUrl(`/players/${encodeURIComponent(username)}`), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const player = await response.json();
    profileCache.set(username, player);
    renderProfileModal(player);
    profileContentEl.classList.remove("hidden");
  } catch (_error) {
    profileErrorEl.classList.remove("hidden");
    profileErrorEl.textContent = "Failed to load player profile.";
  } finally {
    profileLoadingEl.classList.add("hidden");
  }
}

function setLoading(loading) {
  loadingStateEl.classList.toggle("hidden", !loading);
}

function setError(message = "") {
  errorStateEl.classList.toggle("hidden", !message);
  errorStateEl.textContent = message;
}

function renderPagination() {
  if (state.gamemode !== "overall" || state.totalItems === 0) {
    paginationEl.classList.add("hidden");
    return;
  }

  paginationEl.classList.remove("hidden");
  pageInfoEl.textContent = `Page ${state.page} / ${state.totalPages} | ${state.totalItems} players`;
  prevPageEl.disabled = state.page <= 1;
  nextPageEl.disabled = state.page >= state.totalPages;
}

function visibleTiers(player) {
  return Object.entries(player.tiers || {}).filter(([, tier]) => tier);
}

function getTierNumber(tierValue) {
  const value = String(tierValue || "");
  const maybeNumber = Number(value.slice(-1));
  return Number.isInteger(maybeNumber) ? maybeNumber : null;
}

function getTierBand(tierValue) {
  return String(tierValue || "").toUpperCase().startsWith("HT") ? "HT" : "LT";
}

function tierHeaderIconTemplate(tierNum) {
  if (tierNum > 3) {
    return "";
  }

  return `
    <span class="tier-head-icon trophy-${tierNum}" aria-hidden="true">
      <img src="assets/gamemodes/overall.png" alt="" />
    </span>
  `;
}

function playerCardTemplate(player, index) {
  const globalIndex = (state.page - 1) * 20 + index + 1;
  let topClass = "";

  if (globalIndex === 1) {
    topClass = "top-1";
  } else if (globalIndex === 2) {
    topClass = "top-2";
  } else if (globalIndex === 3) {
    topClass = "top-3";
  }

  const tierEntries = visibleTiers(player)
    .map(([mode, tier]) => ({
      mode,
      tier,
      points: TIER_POINTS[tier] || 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return (MODE_LABELS[a.mode] || a.mode).localeCompare(MODE_LABELS[b.mode] || b.mode);
    });

  const maxTierSlots = 10;
  const filledSlots = tierEntries.slice(0, maxTierSlots);
  const emptySlots = Math.max(maxTierSlots - filledSlots.length, 0);

  const tierSlotsHtml = [
    ...filledSlots.map(
      (entry) => `
        <div class="tier-slot filled">
          <span class="tier-bubble ${tierColorClass(entry.tier)}" data-tier="${entry.tier}" data-points="${entry.points}">
            <img src="${MODE_ICON_PATH[entry.mode]}" alt="${MODE_LABELS[entry.mode] || entry.mode}" />
            <span class="tier-hover-pop" role="tooltip">
              <strong>${entry.tier}</strong>
              <span>${entry.points} points</span>
            </span>
          </span>
          <span class="tier-label ${tierColorClass(entry.tier)}">${entry.tier}</span>
        </div>
      `
    ),
    ...Array.from({ length: emptySlots }).map(
      () => `
        <div class="tier-slot empty">
          <span class="tier-bubble"></span>
          <span class="tier-label muted">-</span>
        </div>
      `
    ),
  ].join("");

  const points = state.gamemode === "overall" ? player.totalPoints : player.gamemodePoints || 0;
  const region = String(player.region || "NA").toUpperCase();
  const regionClass = `region-${region.toLowerCase()}`;

  return `
    <article class="rank-card ${topClass}" data-username="${player.username}">
      <div class="rank-number">#${globalIndex}</div>
      <div class="rank-main">
        <div class="player-head">
          <img class="avatar" src="${getAvatarUrl(player.username)}" alt="${player.username}" loading="lazy" decoding="async" />
          <strong>${player.username}</strong>
        </div>
        <div class="rank-detail-band">
          <div class="region-spot ${regionClass}">
            <span>${region}</span>
          </div>
          <div class="tier-slot-list">${tierSlotsHtml}</div>
        </div>
      </div>
      <div class="points-col">
        <strong>${points}</strong>
        <span>POINTS</span>
      </div>
    </article>
  `;
}

function renderRankings() {
  viewTitleEl.textContent =
    state.gamemode === "overall"
      ? "Overall Rankings"
      : `${GAMEMODES.find((m) => m.id === state.gamemode)?.label || state.gamemode} Rankings`;

  statusLabelEl.textContent = `${state.totalItems} players ranked`;
  listHeadEl.classList.add("centered");

  if (state.gamemode !== "overall") {
    const grouped = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    for (const player of state.players) {
      const tierValue = player.tiers?.[state.gamemode];
      if (!tierValue) {
        continue;
      }

      const tierNumber = getTierNumber(tierValue);
      if (!tierNumber || !grouped[tierNumber]) {
        continue;
      }

      grouped[tierNumber].push({
        username: player.username,
        tierValue,
        band: getTierBand(tierValue),
      });
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        if (a.band !== b.band) {
          return a.band === "HT" ? -1 : 1;
        }
        return a.username.localeCompare(b.username);
      });
    }

    rankingListEl.innerHTML = `
      <section class="tier-columns">
        ${[1, 2, 3, 4, 5]
          .map((tierNum) => {
            const rows = grouped[tierNum];
            return `
              <article class="tier-column glass-panel tier-column-${tierNum}">
                <header class="tier-column-head">
                  <div class="tier-column-title-row">
                    ${tierHeaderIconTemplate(tierNum)}
                    <span class="tier-column-title">Tier ${tierNum}</span>
                  </div>
                </header>
                <div class="tier-column-body">
                  ${
                    rows.length === 0
                      ? `<p class="tier-empty">No players currently have this rank yet</p>`
                      : rows
                          .map(
                            (row) => `
                              <button class="tier-player-row" data-username="${row.username}">
                                <img class="tier-player-avatar" src="${getAvatarUrl(row.username)}" alt="${row.username}" loading="lazy" decoding="async" />
                                <span class="tier-player-name">${row.username}</span>
                                <span class="tier-player-arrow ${row.band === "HT" ? "up" : "down"}">${row.band === "HT" ? "↑" : "↓"}</span>
                              </button>
                            `
                          )
                          .join("")
                  }
                </div>
              </article>
            `;
          })
          .join("")}
      </section>
    `;

    rankingListEl.querySelectorAll(".tier-player-row").forEach((row) => {
      row.addEventListener("click", () => {
        openProfileModal(row.dataset.username);
      });
    });

    renderPagination();
    return;
  }

  if (state.players.length === 0) {
    rankingListEl.innerHTML = "";
    renderPagination();
    return;
  }

  rankingListEl.innerHTML = state.players.map(playerCardTemplate).join("");

  rankingListEl.querySelectorAll(".rank-card").forEach((card) => {
    card.addEventListener("click", () => {
      const username = card.dataset.username;
      openProfileModal(username);
    });
  });

  renderPagination();
}

async function loadRankings() {
  setError("");
  setLoading(true);
  rankingListEl.innerHTML = "";

  const endpoint =
    state.gamemode === "overall"
      ? apiUrl(`/players?page=${state.page}`)
      : apiUrl(`/rankings/${state.gamemode}?page=1&perPage=500`);

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const payload = await response.json();
    state.players = payload.data || [];
    state.totalPages = payload.pagination?.totalPages || 1;
    state.totalItems = payload.pagination?.total || state.players.length;

    renderRankings();
  } catch (_error) {
    setError("Failed to load rankings. Check API/database connection.");
  } finally {
    setLoading(false);
  }
}

async function runSearch(query) {
  if (!query) {
    searchDropdownEl.classList.add("hidden");
    searchDropdownEl.innerHTML = "";
    return;
  }

  if (searchCache.has(query)) {
    const cached = searchCache.get(query);
    renderSearchResults(cached);
    return;
  }

  if (activeSearchController) {
    activeSearchController.abort();
  }
  activeSearchController = new AbortController();

  try {
    const response = await fetch(apiUrl(`/search?q=${encodeURIComponent(query)}`), {
      headers: { Accept: "application/json" },
      signal: activeSearchController.signal,
    });

    if (!response.ok) {
      throw new Error("Search request failed");
    }

    const payload = await response.json();
    const results = payload.data || [];
    searchCache.set(query, results);
    renderSearchResults(results);
  } catch (_error) {
    if (_error && _error.name === "AbortError") {
      return;
    }
    searchDropdownEl.classList.remove("hidden");
    searchDropdownEl.innerHTML = `<div class="search-item"><div></div><div><strong>Search failed</strong></div></div>`;
  } finally {
    activeSearchController = null;
  }
}

function renderSearchResults(results) {
  if (results.length === 0) {
    searchDropdownEl.classList.remove("hidden");
    searchDropdownEl.innerHTML = `<div class="search-item"><div></div><div><strong>No players found</strong></div></div>`;
    return;
  }

  searchDropdownEl.classList.remove("hidden");
  searchDropdownEl.innerHTML = results
    .map(
      (player) => `
        <div class="search-item" data-user="${player.username}">
          <img src="${getAvatarUrl(player.username)}" alt="${player.username}" loading="lazy" decoding="async" />
          <div>
            <strong>${player.username}</strong>
          </div>
          <div class="search-points">
            <strong>${player.totalPoints || 0}</strong>
            <span>POINTS</span>
          </div>
        </div>
      `
    )
    .join("");

  searchDropdownEl.querySelectorAll(".search-item[data-user]").forEach((item) => {
    item.addEventListener("click", () => {
      const username = item.dataset.user;
      searchDropdownEl.classList.add("hidden");
      openProfileModal(username);
    });
  });
}

const debouncedSearch = debounce((value) => runSearch(value), 220);

searchInputEl.addEventListener("input", (event) => {
  debouncedSearch(event.target.value.trim());
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#searchShell")) {
    searchDropdownEl.classList.add("hidden");
  }
});

profileCloseBtnEl.addEventListener("click", closeProfileModal);

profileOverlayEl.addEventListener("click", (event) => {
  if (!event.target.closest("#profileModal")) {
    closeProfileModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !profileOverlayEl.classList.contains("hidden")) {
    closeProfileModal();
  }
});

prevPageEl.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    loadRankings();
  }
});

nextPageEl.addEventListener("click", () => {
  if (state.page < state.totalPages) {
    state.page += 1;
    loadRankings();
  }
});

buildTabs();
loadRankings();

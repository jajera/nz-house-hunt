import { loadLocations, searchListings } from "./api.js";
import { PRESETS, PROPERTY_TYPES, PRICING_METHODS, getPreset } from "./presets.js";
import { initTheme } from "./theme.js";

const PAGE_SIZE = 24;

const FLAG_KEYS = [
  ["nearby", "nearby"],
  ["openHome", "open"],
  ["newBuild", "new"],
  ["mortgagee", "mortgagee"],
  ["coastal", "coastal"],
  ["pool", "pool"],
  ["floorplan", "floorplan"],
  ["hasAddress", "address"],
];

const els = {
  themeToggle: document.getElementById("theme-toggle"),
  themeLabel: document.getElementById("theme-label"),
  preset: document.getElementById("preset"),
  region: document.getElementById("region"),
  district: document.getElementById("district"),
  suburb: document.getElementById("suburb"),
  propertyType: document.getElementById("propertyType"),
  priceMin: document.getElementById("priceMin"),
  priceMax: document.getElementById("priceMax"),
  bedsMin: document.getElementById("bedsMin"),
  bedsMax: document.getElementById("bedsMax"),
  bathsMin: document.getElementById("bathsMin"),
  carparks: document.getElementById("carparks"),
  floorMin: document.getElementById("floorMin"),
  landMin: document.getElementById("landMin"),
  pricingMethod: document.getElementById("pricingMethod"),
  keyword: document.getElementById("keyword"),
  nearby: document.getElementById("nearby"),
  openHome: document.getElementById("openHome"),
  newBuild: document.getElementById("newBuild"),
  mortgagee: document.getElementById("mortgagee"),
  coastal: document.getElementById("coastal"),
  pool: document.getElementById("pool"),
  floorplan: document.getElementById("floorplan"),
  hasAddress: document.getElementById("hasAddress"),
  moreToggle: document.getElementById("moreToggle"),
  moreFilters: document.getElementById("moreFilters"),
  searchBtn: document.getElementById("searchBtn"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  grid: document.getElementById("grid"),
  countChip: document.getElementById("countChip"),
  areaChip: document.getElementById("areaChip"),
  pager: document.getElementById("pager"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageLabel: document.getElementById("pageLabel"),
  presetHint: document.getElementById("presetHint"),
};

function moreFiltersActive() {
  return Boolean(
    els.bedsMax.value ||
      els.carparks.value ||
      els.floorMin.value ||
      els.landMin.value ||
      els.pricingMethod.value ||
      els.openHome.checked ||
      els.newBuild.checked ||
      els.mortgagee.checked ||
      els.coastal.checked ||
      els.pool.checked ||
      els.floorplan.checked ||
      els.hasAddress.checked,
  );
}

function setMoreFiltersOpen(open) {
  els.moreFilters.hidden = !open;
  els.moreToggle.setAttribute("aria-expanded", open ? "true" : "false");
  els.moreToggle.textContent = open ? "Fewer filters" : "More filters";
}

function syncMoreToggleLabel() {
  const open = els.moreToggle.getAttribute("aria-expanded") === "true";
  const count = [
    els.bedsMax.value,
    els.carparks.value,
    els.floorMin.value,
    els.landMin.value,
    els.pricingMethod.value,
    els.openHome.checked,
    els.newBuild.checked,
    els.mortgagee.checked,
    els.coastal.checked,
    els.pool.checked,
    els.floorplan.checked,
    els.hasAddress.checked,
  ].filter(Boolean).length;
  if (open) {
    els.moreToggle.textContent = "Fewer filters";
  } else if (count) {
    els.moreToggle.textContent = `More filters (${count})`;
  } else {
    els.moreToggle.textContent = "More filters";
  }
}

/** @type {Awaited<ReturnType<typeof loadLocations>> | null} */
let locations = null;
let offset = 0;
let lastTotal = 0;
let searching = false;

function money(n) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(n);
}

function updatedLabel(iso) {
  const when = Date.parse(iso);
  if (!Number.isFinite(when)) return "recently";
  const mins = Math.round((Date.now() - when) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(when).toLocaleDateString("en-NZ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fillSelect(select, items, { blankLabel, valueKey = "id", labelKey = "title" } = {}) {
  const current = select.value;
  select.innerHTML = "";
  if (blankLabel != null) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = blankLabel;
    select.appendChild(opt);
  }
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = String(item[valueKey]);
    opt.textContent = item[labelKey];
    select.appendChild(opt);
  }
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function fillPresetSelect(select) {
  const current = select.value;
  select.innerHTML = "";
  const custom = document.createElement("option");
  custom.value = "";
  custom.textContent = "Custom (use region / district / suburb)";
  select.appendChild(custom);

  const groups = new Map();
  for (const preset of PRESETS) {
    const name = preset.group || "Other";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(preset);
  }
  for (const [name, presets] of groups) {
    const og = document.createElement("optgroup");
    og.label = name;
    for (const preset of presets) {
      const opt = document.createElement("option");
      opt.value = preset.id;
      opt.textContent = preset.label;
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function bedOptions(suffix) {
  return [
    { id: "", label: "Any" },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({
      id: String(n),
      label: suffix ? `${n}${suffix}` : String(n),
    })),
  ];
}

function initStaticControls() {
  fillPresetSelect(els.preset);
  fillSelect(els.propertyType, PROPERTY_TYPES, {
    blankLabel: "Any type",
    valueKey: "id",
    labelKey: "label",
  });
  fillSelect(els.pricingMethod, PRICING_METHODS, {
    blankLabel: "Any method",
    valueKey: "id",
    labelKey: "label",
  });
  fillSelect(els.bedsMin, bedOptions("+"), {
    blankLabel: null,
    valueKey: "id",
    labelKey: "label",
  });
  fillSelect(els.bedsMax, bedOptions(""), {
    blankLabel: null,
    valueKey: "id",
    labelKey: "label",
  });
  fillSelect(
    els.bathsMin,
    [
      { id: "", label: "Any" },
      ...[1, 2, 3, 4].map((n) => ({ id: String(n), label: `${n}+` })),
    ],
    { blankLabel: null, valueKey: "id", labelKey: "label" },
  );
  fillSelect(
    els.carparks,
    [
      { id: "", label: "Any" },
      ...[1, 2, 3, 4].map((n) => ({ id: String(n), label: `${n}+` })),
    ],
    { blankLabel: null, valueKey: "id", labelKey: "label" },
  );
}

function refreshDistrictOptions() {
  const regionId = els.region.value;
  const districts = !regionId
    ? locations.districts
    : locations.districts.filter((d) => d.parentId === regionId);
  fillSelect(els.district, districts, { blankLabel: "All districts" });
  refreshSuburbOptions();
}

function refreshSuburbOptions() {
  const districtId = els.district.value;
  const regionId = els.region.value;
  let suburbs = locations.suburbs;
  if (districtId) {
    suburbs = suburbs.filter((s) => s.parentId === districtId);
  } else if (regionId) {
    const distIds = new Set(
      locations.districts.filter((d) => d.parentId === regionId).map((d) => d.id),
    );
    suburbs = suburbs.filter((s) => distIds.has(s.parentId));
  }
  fillSelect(els.suburb, suburbs, { blankLabel: "All suburbs" });
}

function applyPresetToUi(presetId) {
  const preset = getPreset(presetId);
  els.presetHint.textContent = preset?.description || "";
  if (!preset || presetId === "") {
    els.region.disabled = false;
    els.district.disabled = false;
    els.suburb.disabled = false;
    return;
  }
  // Preset drives location; clear cascading selects visually
  els.region.value = "";
  fillSelect(els.district, locations.districts, { blankLabel: "All districts" });
  fillSelect(els.suburb, locations.suburbs, { blankLabel: "All suburbs" });
  els.region.disabled = true;
  els.district.disabled = true;
  els.suburb.disabled = true;
}

function readQueryFromUi() {
  const preset = getPreset(els.preset.value);
  /** @type {Parameters<typeof searchListings>[0]} */
  const q = {
    offset,
    limit: PAGE_SIZE,
    propertyTypes: els.propertyType.value
      ? [Number(els.propertyType.value)]
      : undefined,
    pricingMethods: els.pricingMethod.value
      ? [Number(els.pricingMethod.value)]
      : undefined,
    saleMin: numOrNull(els.priceMin.value),
    saleMax: numOrNull(els.priceMax.value),
    bedroomsMin: numOrNull(els.bedsMin.value),
    bedroomsMax: numOrNull(els.bedsMax.value),
    bathroomsMin: numOrNull(els.bathsMin.value),
    carparks: numOrNull(els.carparks.value),
    floorAreaMin: numOrNull(els.floorMin.value),
    landAreaMin: numOrNull(els.landMin.value),
    keyword: els.keyword.value.trim() || undefined,
    includeNearby: els.nearby.checked,
    openHomeOnly: els.openHome.checked,
    mortgageeSale: els.mortgagee.checked,
    newConstruction: els.newBuild.checked,
    coastalWaterfront: els.coastal.checked,
    hasSwimmingPool: els.pool.checked,
    hasFloorPlans: els.floorplan.checked,
    hasAddress: els.hasAddress.checked,
  };

  if (preset?.nationwide) {
    // no location filters
  } else if (preset?.suburbIds?.length) {
    q.suburbIds = preset.suburbIds;
  } else if (preset?.districtIds?.length) {
    q.districtIds = preset.districtIds;
  } else if (preset?.regionIds?.length) {
    q.regionIds = preset.regionIds;
  } else {
    if (els.suburb.value) q.suburbIds = [Number(els.suburb.value)];
    else if (els.district.value) q.districtIds = [Number(els.district.value)];
    else if (els.region.value) q.regionIds = [Number(els.region.value)];
  }
  return q;
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function areaLabel() {
  const preset = getPreset(els.preset.value);
  if (preset) return preset.label;
  if (els.suburb.value) {
    return locations.suburbs.find((s) => s.id === els.suburb.value)?.title || "Suburb";
  }
  if (els.district.value) {
    return locations.districts.find((d) => d.id === els.district.value)?.title || "District";
  }
  if (els.region.value) {
    return locations.regions.find((r) => r.id === els.region.value)?.title || "Region";
  }
  return "All New Zealand";
}

function syncUrl() {
  const params = new URLSearchParams();
  if (els.preset.value) params.set("preset", els.preset.value);
  else {
    if (els.region.value) params.set("region", els.region.value);
    if (els.district.value) params.set("district", els.district.value);
    if (els.suburb.value) params.set("suburb", els.suburb.value);
  }
  if (els.propertyType.value) params.set("type", els.propertyType.value);
  if (els.priceMin.value) params.set("minp", els.priceMin.value);
  if (els.priceMax.value) params.set("maxp", els.priceMax.value);
  if (els.bedsMin.value) params.set("beds", els.bedsMin.value);
  if (els.bedsMax.value) params.set("bedsmax", els.bedsMax.value);
  if (els.bathsMin.value) params.set("baths", els.bathsMin.value);
  if (els.carparks.value) params.set("cars", els.carparks.value);
  if (els.floorMin.value) params.set("floor", els.floorMin.value);
  if (els.landMin.value) params.set("land", els.landMin.value);
  if (els.pricingMethod.value) params.set("pm", els.pricingMethod.value);
  if (els.keyword.value.trim()) params.set("q", els.keyword.value.trim());
  for (const [elKey, param] of FLAG_KEYS) {
    if (els[elKey].checked) params.set(param, "1");
  }
  if (offset) params.set("offset", String(offset));
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.get("preset")) els.preset.value = params.get("preset");
  if (params.get("region")) els.region.value = params.get("region");
  if (params.get("district")) {
    refreshDistrictOptions();
    els.district.value = params.get("district");
  }
  if (params.get("suburb")) {
    refreshSuburbOptions();
    els.suburb.value = params.get("suburb");
  }
  if (params.get("type")) els.propertyType.value = params.get("type");
  if (params.get("minp")) els.priceMin.value = params.get("minp");
  if (params.get("maxp")) els.priceMax.value = params.get("maxp");
  if (params.get("beds")) els.bedsMin.value = params.get("beds");
  if (params.get("bedsmax")) els.bedsMax.value = params.get("bedsmax");
  if (params.get("baths")) els.bathsMin.value = params.get("baths");
  if (params.get("cars")) els.carparks.value = params.get("cars");
  if (params.get("floor")) els.floorMin.value = params.get("floor");
  if (params.get("land")) els.landMin.value = params.get("land");
  if (params.get("pm")) els.pricingMethod.value = params.get("pm");
  if (params.get("q")) els.keyword.value = params.get("q");
  for (const [elKey, param] of FLAG_KEYS) {
    els[elKey].checked = params.get(param) === "1";
  }
  offset = Number(params.get("offset") || 0) || 0;
  applyPresetToUi(els.preset.value);
  if (moreFiltersActive()) setMoreFiltersOpen(true);
  else syncMoreToggleLabel();
}

function cardHtml(listing) {
  const href = escapeHtml(listing.url || "#");
  const img = listing.image
    ? `<img src="${escapeHtml(listing.image)}" alt="" loading="lazy" />`
    : "";
  const stats = [
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
    listing.parking != null && listing.parking > 0
      ? `${listing.parking} garage`
      : null,
    listing.floorArea != null ? `${listing.floorArea} m² floor` : null,
    listing.landArea != null
      ? `${listing.landArea} ${listing.landAreaUnit || "m²"} land`
      : null,
  ]
    .filter(Boolean)
    .map((s) => `<span class="stat">${escapeHtml(s)}</span>`)
    .join("");
  const place = [listing.suburb, listing.district].filter(Boolean).join(" · ");

  return `
    <a class="card" href="${href}" target="_blank" rel="noopener noreferrer">
      <div class="card-media">${img}<span class="badge">${escapeHtml(listing.propertyType || "Listing")}</span></div>
      <div class="card-body">
        <p class="price">${escapeHtml(listing.priceDisplay)}</p>
        <p class="address">${escapeHtml(listing.address || listing.title)}</p>
        <p class="suburb">${escapeHtml(place)}</p>
        <div class="stats">${stats}</div>
      </div>
    </a>
  `;
}

function renderPager() {
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(lastTotal / PAGE_SIZE));
  els.pageLabel.textContent = `Page ${page} of ${pages}`;
  els.pager.hidden = lastTotal <= PAGE_SIZE;
  els.prevPage.disabled = searching || offset <= 0;
  els.nextPage.disabled = searching || offset + PAGE_SIZE >= lastTotal;
}

async function runSearch({ resetOffset = false } = {}) {
  if (searching) return;
  if (resetOffset) offset = 0;
  searching = true;
  els.searchBtn.disabled = true;
  els.prevPage.disabled = true;
  els.nextPage.disabled = true;
  els.status.textContent = "Searching…";
  els.grid.setAttribute("aria-busy", "true");
  syncUrl();

  const requestOffset = offset;
  let succeeded = false;

  try {
    const result = await searchListings(readQueryFromUi());
    // Keep pager in sync with what the API actually returned (0 is valid).
    offset =
      result.offset == null || Number.isNaN(Number(result.offset))
        ? requestOffset
        : Number(result.offset);
    lastTotal = result.total;
    succeeded = true;
    els.countChip.innerHTML = `<strong>${result.total.toLocaleString("en-NZ")}</strong> matches`;
    els.areaChip.innerHTML = `Area <strong>${areaLabel()}</strong>`;
    const priceBits = [];
    if (els.priceMin.value) priceBits.push(`from ${money(Number(els.priceMin.value))}`);
    if (els.priceMax.value) priceBits.push(`up to ${money(Number(els.priceMax.value))}`);
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const pages = Math.max(1, Math.ceil(lastTotal / PAGE_SIZE));
    els.status.textContent = [
      `Showing ${result.listings.length} of ${result.total.toLocaleString("en-NZ")}`,
      pages > 1 ? `page ${page}/${pages}` : null,
      priceBits.length ? priceBits.join(" ") : null,
      `Updated ${updatedLabel(result.generatedAt)}`,
    ]
      .filter(Boolean)
      .join(" · ");

    if (!result.listings.length) {
      els.grid.innerHTML =
        '<div class="empty">No listings matched. Widen the area, raise the price cap, or drop bed filters.</div>';
    } else {
      els.grid.innerHTML = result.listings.map(cardHtml).join("");
    }
    syncUrl();
  } catch (err) {
    els.status.textContent = "Search failed.";
    els.grid.innerHTML = `<div class="empty">${String(err.message || err)}</div>`;
    els.pager.hidden = true;
  } finally {
    searching = false;
    els.searchBtn.disabled = false;
    els.grid.removeAttribute("aria-busy");
    if (succeeded) renderPager();
  }
}

function resetFilters() {
  els.preset.value = "south-wellington";
  applyPresetToUi(els.preset.value);
  els.propertyType.value = "1";
  els.priceMin.value = "";
  els.priceMax.value = "800000";
  els.bedsMin.value = "3";
  els.bedsMax.value = "";
  els.bathsMin.value = "";
  els.carparks.value = "";
  els.floorMin.value = "";
  els.landMin.value = "";
  els.pricingMethod.value = "";
  els.keyword.value = "";
  for (const [elKey] of FLAG_KEYS) els[elKey].checked = false;
  setMoreFiltersOpen(false);
  offset = 0;
  runSearch({ resetOffset: true });
}

async function boot() {
  initTheme(els.themeToggle, els.themeLabel);
  initStaticControls();
  els.status.textContent = "Loading NZ locations…";

  try {
    locations = await loadLocations();
  } catch (err) {
    els.status.textContent = "Could not load listing data.";
    els.grid.innerHTML = `<div class="empty">${String(err.message || err)}</div>`;
    return;
  }

  fillSelect(els.region, locations.regions, { blankLabel: "All regions" });
  fillSelect(els.district, locations.districts, { blankLabel: "All districts" });
  fillSelect(els.suburb, locations.suburbs, { blankLabel: "All suburbs" });

  // Defaults for useful first paint if URL empty
  if (!location.search) {
    els.preset.value = "south-wellington";
    els.propertyType.value = "1";
    els.priceMax.value = "800000";
    els.bedsMin.value = "3";
  } else {
    restoreFromUrl();
  }
  applyPresetToUi(els.preset.value);

  els.preset.addEventListener("change", () => {
    applyPresetToUi(els.preset.value);
  });
  els.region.addEventListener("change", () => {
    els.preset.value = "";
    applyPresetToUi("");
    refreshDistrictOptions();
  });
  els.district.addEventListener("change", () => {
    els.preset.value = "";
    applyPresetToUi("");
    refreshSuburbOptions();
  });
  els.suburb.addEventListener("change", () => {
    els.preset.value = "";
    applyPresetToUi("");
  });
  els.moreToggle.addEventListener("click", () => {
    const open = els.moreToggle.getAttribute("aria-expanded") !== "true";
    setMoreFiltersOpen(open);
    syncMoreToggleLabel();
  });
  els.searchBtn.addEventListener("click", () => runSearch({ resetOffset: true }));
  els.resetBtn.addEventListener("click", resetFilters);
  els.prevPage.addEventListener("click", () => {
    if (searching || offset <= 0) return;
    offset = Math.max(0, offset - PAGE_SIZE);
    runSearch();
  });
  els.nextPage.addEventListener("click", () => {
    if (searching || offset + PAGE_SIZE >= lastTotal) return;
    offset += PAGE_SIZE;
    runSearch();
  });
  for (const el of [els.keyword, els.priceMin, els.priceMax]) {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch({ resetOffset: true });
    });
  }

  await runSearch();
}

boot();

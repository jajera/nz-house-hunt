// Static snapshot published with the site by scripts/build_data.py.
const DATA_BASE = new URL("data/", window.location.href).href;
const SITE = "https://www.realestate.co.nz";
const MEDIA = "https://mediaserver.realestate.co.nz";

const FLAG_NEW = 1;
const FLAG_MORTGAGEE = 2;
const FLAG_COASTAL = 4;
const FLAG_POOL = 8;
const FLAG_FLOORPLAN = 16;
const FLAG_ADDRESS = 32;

/** @type {Map<string, Promise<any>>} */
const cache = new Map();
let metaPromise = null;
let locationsIndex = null;

async function getJson(path) {
  if (!cache.has(path)) {
    const promise = fetch(new URL(path, DATA_BASE)).then(async (res) => {
      if (!res.ok) throw new Error(`Data ${res.status}: ${path}`);
      return res.json();
    });
    promise.catch(() => cache.delete(path));
    cache.set(path, promise);
  }
  return cache.get(path);
}

export function loadMeta() {
  metaPromise ??= getJson("meta.json");
  return metaPromise;
}

/**
 * @returns {Promise<{
 *   regions: Array<{id:string,title:string,slug:string,districtIds:string[]}>,
 *   districts: Array<{id:string,title:string,slug:string,parentId:string}>,
 *   suburbs: Array<{id:string,title:string,slug:string,parentId:string,nearbyIds:string[]}>,
 * }>}
 */
export async function loadLocations() {
  const data = await getJson("locations.json");
  locationsIndex = {
    districtRegion: new Map(data.districts.map((d) => [d.id, d.parentId])),
    suburbDistrict: new Map(data.suburbs.map((s) => [s.id, s.parentId])),
    suburbNearby: new Map(data.suburbs.map((s) => [s.id, s.nearbyIds || []])),
  };
  return data;
}

function toSet(values) {
  return values?.length ? new Set(values.map(String)) : null;
}

async function regionsFor(query, suburbSet) {
  const meta = await loadMeta();
  const all = Object.keys(meta.counts).filter((id) => meta.counts[id] > 0);
  const regions = new Set();
  if (suburbSet) {
    for (const id of suburbSet) {
      const region = locationsIndex.districtRegion.get(locationsIndex.suburbDistrict.get(id));
      if (region) regions.add(region);
    }
  } else if (query.districtIds?.length) {
    for (const id of query.districtIds) {
      const region = locationsIndex.districtRegion.get(String(id));
      if (region) regions.add(region);
    }
  } else if (query.regionIds?.length) {
    for (const id of query.regionIds) regions.add(String(id));
  } else {
    return all;
  }
  return [...regions].filter((id) => all.includes(id));
}

/**
 * @param {object} query
 * @param {number} [query.offset]
 * @param {number} [query.limit]
 * @param {number[]} [query.regionIds]
 * @param {number[]} [query.districtIds]
 * @param {number[]} [query.suburbIds]
 * @param {number[]} [query.propertyTypes]
 * @param {number} [query.saleMin]
 * @param {number} [query.saleMax]
 * @param {number} [query.bedroomsMin]
 * @param {number} [query.bedroomsMax]
 * @param {number} [query.bathroomsMin]
 * @param {number} [query.carparks]
 * @param {number} [query.floorAreaMin]
 * @param {number} [query.landAreaMin]
 * @param {number[]} [query.pricingMethods]
 * @param {string} [query.keyword]
 * @param {boolean} [query.includeNearby]
 * @param {boolean} [query.openHomeOnly]
 * @param {boolean} [query.mortgageeSale]
 * @param {boolean} [query.newConstruction]
 * @param {boolean} [query.coastalWaterfront]
 * @param {boolean} [query.hasSwimmingPool]
 * @param {boolean} [query.hasFloorPlans]
 * @param {boolean} [query.hasAddress]
 */
export async function searchListings(query) {
  if (!locationsIndex) await loadLocations();
  const meta = await loadMeta();
  const limit = query.limit ?? 24;
  const offset = query.offset ?? 0;

  let suburbSet = toSet(query.suburbIds);
  if (suburbSet && query.includeNearby) {
    for (const id of [...suburbSet]) {
      for (const near of locationsIndex.suburbNearby.get(id) || []) suburbSet.add(near);
    }
  }
  const districtSet = suburbSet ? null : toSet(query.districtIds);
  const regionSet = suburbSet || districtSet ? null : toSet(query.regionIds);
  const typeSet = toSet(query.propertyTypes);
  const codeSet = query.pricingMethods?.length
    ? new Set(
        query.pricingMethods
          .map((id) => meta.pricingFilterToCode[String(id)])
          .filter((code) => code != null),
      )
    : null;
  const terms = (query.keyword || "").toLowerCase().split(/\s+/).filter(Boolean);
  const now = Date.now();

  let flags = 0;
  if (query.newConstruction) flags |= FLAG_NEW;
  if (query.mortgageeSale) flags |= FLAG_MORTGAGEE;
  if (query.coastalWaterfront) flags |= FLAG_COASTAL;
  if (query.hasSwimmingPool) flags |= FLAG_POOL;
  if (query.hasFloorPlans) flags |= FLAG_FLOORPLAN;
  if (query.hasAddress) flags |= FLAG_ADDRESS;

  const shards = await Promise.all(
    (await regionsFor(query, suburbSet)).map((id) => getJson(`listings/${id}.json`)),
  );

  const matches = [];
  for (const rows of shards) {
    for (const r of rows) {
      if (suburbSet && !suburbSet.has(r.s)) continue;
      if (districtSet && !districtSet.has(r.d)) continue;
      if (regionSet && !regionSet.has(r.r)) continue;
      if (typeSet && !typeSet.has(String(r.pt))) continue;
      if (codeSet && !codeSet.has(r.pc)) continue;
      if (query.saleMin && !(r.pv != null && r.pv >= query.saleMin)) continue;
      if (query.saleMax && !(r.pv != null && r.pv <= query.saleMax)) continue;
      if (query.bedroomsMin && !((r.b ?? 0) >= query.bedroomsMin)) continue;
      if (query.bedroomsMax && !(r.b != null && r.b <= query.bedroomsMax)) continue;
      if (query.bathroomsMin && !((r.ba ?? 0) >= query.bathroomsMin)) continue;
      if (query.carparks && !((r.g ?? 0) >= query.carparks)) continue;
      if (query.floorAreaMin && !((r.fa ?? 0) >= query.floorAreaMin)) continue;
      if (query.landAreaMin && !((r.lm ?? 0) >= query.landAreaMin)) continue;
      if ((r.f & flags) !== flags) continue;
      if (query.openHomeOnly && !(r.oh && Date.parse(r.oh) >= now)) continue;
      if (terms.length) {
        const text = `${r.t} ${r.a} ${r.sn} ${r.dn} ${r.ty}`.toLowerCase();
        if (!terms.every((term) => text.includes(term))) continue;
      }
      matches.push(r);
    }
  }
  if (shards.length > 1) matches.sort((a, b) => (b.pub || "").localeCompare(a.pub || ""));

  const start = Math.min(offset, Math.max(0, matches.length - 1));
  const pageOffset = matches.length ? Math.floor(start / limit) * limit : 0;
  return {
    listings: matches.slice(pageOffset, pageOffset + limit).map(normalizeListing),
    total: matches.length,
    limit,
    offset: pageOffset,
    generatedAt: meta.generatedAt,
  };
}

function normalizeListing(r) {
  return {
    id: r.id,
    title: r.t || r.a || "Listing",
    address: r.a,
    suburb: r.sn,
    district: r.dn,
    priceDisplay: r.p,
    bedrooms: r.b,
    bathrooms: r.ba,
    parking: r.g,
    floorArea: r.fa,
    landArea: r.la,
    landAreaUnit: r.lu,
    propertyType: r.ty,
    url: r.u ? `${SITE}${r.u}` : SITE,
    image: r.img ? `${MEDIA}${r.img}.crop.650x487.jpg?options=compress` : null,
    published: r.pub,
  };
}

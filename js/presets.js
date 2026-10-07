/** Named area presets that expand to suburb / district / region IDs. */

export const PROPERTY_TYPES = [
  { id: 1, label: "House" },
  { id: 2, label: "Apartment" },
  { id: 4, label: "Townhouse" },
  { id: 5, label: "Unit" },
  { id: 6, label: "Home & Income" },
  { id: 9, label: "Section" },
];

/** Sale pricing-method IDs from realestate.co.nz. */
export const PRICING_METHODS = [
  { id: 8, label: "Asking price" },
  { id: 3, label: "Auction" },
  { id: 4, label: "Tender" },
  { id: 7, label: "Deadline sale" },
  { id: 2, label: "Negotiation" },
  { id: 6, label: "Offers" },
  { id: 16, label: "Offers over" },
  { id: 11, label: "Buyer enquiry over" },
  { id: 13, label: "Enquiries over" },
  { id: 5, label: "POA" },
];

/**
 * Presets resolve as suburbIds, districtIds, regionIds, or nationwide.
 * `group` drives <optgroup> labels in the UI (Wellington-heavy first).
 */
export const PRESETS = [
  // —— Wellington suburb clusters ——
  {
    id: "south-wellington",
    group: "Wellington areas",
    label: "South Wellington",
    description:
      "Island Bay, Newtown, Brooklyn, Lyall Bay, Houghton Bay and nearby southern suburbs",
    suburbIds: [
      208, // Island Bay
      1430, // Berhampore
      2244, // Newtown
      603, // Melrose
      3087, // Mornington
      1738, // Kingston
      549, // Southgate
      2392, // Vogeltown
      2647, // Brooklyn
      3210, // Highbury
      3219, // Owhiro Bay
      1570, // Houghton Bay
      4105, // Lyall Bay
      91, // Kilbirnie
      3062, // Mount Cook
    ],
  },
  {
    id: "east-wellington",
    group: "Wellington areas",
    label: "East Wellington",
    description: "Miramar peninsula, Hataitai and eastern bays",
    suburbIds: [
      2577, // Miramar
      2757, // Maupuia
      2183, // Seatoun
      379, // Strathmore Park
      1702, // Rongotai
      173, // Breaker Bay
      2352, // Karaka Bays
      867, // Hataitai
      902, // Roseneath
      91, // Kilbirnie
      4105, // Lyall Bay
    ],
  },
  {
    id: "central-wellington",
    group: "Wellington areas",
    label: "Central Wellington",
    description: "CBD, Te Aro, Thorndon, Kelburn, Mt Victoria and inner-city fringe",
    suburbIds: [
      183, // Te Aro
      1164, // Wellington Central
      4107, // Thorndon
      1093, // Mount Victoria
      3062, // Mount Cook
      613, // Aro Valley
      1269, // Kelburn
      2491, // Oriental Bay
      902, // Roseneath
      82, // Kaiwharawhara
      2244, // Newtown
    ],
  },
  {
    id: "west-wellington",
    group: "Wellington areas",
    label: "West Wellington",
    description: "Karori, Northland, Wilton, Crofton Downs, Makara and Ohariu",
    suburbIds: [
      406, // Karori
      2782, // Northland
      413, // Wilton
      2977, // Crofton Downs
      3210, // Highbury
      4106, // Makara
      2652, // Ohariu
      1269, // Kelburn
    ],
  },
  {
    id: "north-wellington",
    group: "Wellington areas",
    label: "North Wellington",
    description:
      "Johnsonville, Newlands, Churton Park, Ngaio, Khandallah, Tawa and northern suburbs",
    suburbIds: [
      2170, // Johnsonville
      4109, // Newlands
      428, // Churton Park
      2948, // Grenada North
      2766, // Grenada Village
      879, // Broadmeadows
      45, // Paparangi
      4378, // Woodridge
      2071, // Ngaio
      1758, // Khandallah
      1125, // Wadestown
      1964, // Ngauranga
      4108, // Tawa
      461, // Glenside
      3048, // Horokiwi
      2977, // Crofton Downs
    ],
  },

  // —— Wellington territorial authorities ——
  {
    id: "wellington-city",
    group: "Wellington areas",
    label: "Wellington City",
    description: "All Wellington City suburbs",
    districtIds: [265],
  },
  {
    id: "lower-hutt",
    group: "Wellington areas",
    label: "Lower Hutt",
    description: "Lower Hutt City",
    districtIds: [263],
  },
  {
    id: "upper-hutt",
    group: "Wellington areas",
    label: "Upper Hutt",
    description: "Upper Hutt City",
    districtIds: [266],
  },
  {
    id: "hutt-valley",
    group: "Wellington areas",
    label: "Hutt Valley",
    description: "Lower Hutt and Upper Hutt cities",
    districtIds: [263, 266],
  },
  {
    id: "porirua",
    group: "Wellington areas",
    label: "Porirua",
    description: "Porirua City",
    districtIds: [268],
  },
  {
    id: "kapiti",
    group: "Wellington areas",
    label: "Kāpiti Coast",
    description: "Kāpiti Coast district",
    districtIds: [261],
  },
  {
    id: "wairarapa",
    group: "Wellington areas",
    label: "Wairarapa",
    description: "Masterton, Carterton, South Wairarapa",
    regionIds: [52],
  },
  {
    id: "wellington-region",
    group: "Wellington areas",
    label: "Wellington region",
    description: "City, Hutt, Porirua and Kāpiti",
    regionIds: [42],
  },

  // —— All other NZ regions ——
  {
    id: "northland",
    group: "Other regions",
    label: "Northland",
    description: "Northland region",
    regionIds: [34],
  },
  {
    id: "auckland",
    group: "Other regions",
    label: "Auckland",
    description: "Auckland region",
    regionIds: [35],
  },
  {
    id: "waikato",
    group: "Other regions",
    label: "Waikato",
    description: "Waikato region",
    regionIds: [36],
  },
  {
    id: "coromandel",
    group: "Other regions",
    label: "Coromandel",
    description: "Coromandel region",
    regionIds: [48],
  },
  {
    id: "bay-of-plenty",
    group: "Other regions",
    label: "Bay of Plenty",
    description: "Bay of Plenty region",
    regionIds: [37],
  },
  {
    id: "gisborne",
    group: "Other regions",
    label: "Gisborne",
    description: "Gisborne region",
    regionIds: [38],
  },
  {
    id: "hawkes-bay",
    group: "Other regions",
    label: "Hawke's Bay",
    description: "Hawke's Bay region",
    regionIds: [39],
  },
  {
    id: "taranaki",
    group: "Other regions",
    label: "Taranaki",
    description: "Taranaki region",
    regionIds: [40],
  },
  {
    id: "manawatu-whanganui",
    group: "Other regions",
    label: "Manawatū / Whanganui",
    description: "Manawatū / Whanganui region",
    regionIds: [56],
  },
  {
    id: "central-north-island",
    group: "Other regions",
    label: "Central North Island",
    description: "Central North Island region",
    regionIds: [55],
  },
  {
    id: "nelson-bays",
    group: "Other regions",
    label: "Nelson & Bays",
    description: "Nelson and Tasman bays",
    regionIds: [43],
  },
  {
    id: "marlborough",
    group: "Other regions",
    label: "Marlborough",
    description: "Marlborough region",
    regionIds: [51],
  },
  {
    id: "west-coast",
    group: "Other regions",
    label: "West Coast",
    description: "West Coast region",
    regionIds: [44],
  },
  {
    id: "canterbury",
    group: "Other regions",
    label: "Canterbury",
    description: "Canterbury region (incl. Christchurch)",
    regionIds: [45],
  },
  {
    id: "otago",
    group: "Other regions",
    label: "Otago",
    description: "Otago region",
    regionIds: [46],
  },
  {
    id: "central-otago-lakes",
    group: "Other regions",
    label: "Central Otago / Lakes",
    description: "Central Otago and Lakes District",
    regionIds: [50],
  },
  {
    id: "southland",
    group: "Other regions",
    label: "Southland",
    description: "Southland region",
    regionIds: [47],
  },
  {
    id: "all-nz",
    group: "Nationwide",
    label: "All New Zealand",
    description: "Nationwide residential sale search",
    regionIds: [],
    nationwide: true,
  },
];

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

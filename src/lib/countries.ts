/**
 * ISO 3166-1 alpha-3 → alpha-2 country-code mapping.
 *
 * iRacing exposes a driver's country as an alpha-3 "flair" code (e.g. "ESP");
 * the bundled flag sprites (flag-icons) are keyed by lowercase alpha-2. This
 * table bridges the two. Codes not present here (or empty) simply render no
 * flag — the UI falls back to the raw code text.
 */

const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG: "af", ALA: "ax", ALB: "al", DZA: "dz", ASM: "as", AND: "ad", AGO: "ao",
  AIA: "ai", ATA: "aq", ATG: "ag", ARG: "ar", ARM: "am", ABW: "aw", AUS: "au",
  AUT: "at", AZE: "az", BHS: "bs", BHR: "bh", BGD: "bd", BRB: "bb", BLR: "by",
  BEL: "be", BLZ: "bz", BEN: "bj", BMU: "bm", BTN: "bt", BOL: "bo", BES: "bq",
  BIH: "ba", BWA: "bw", BVT: "bv", BRA: "br", IOT: "io", BRN: "bn", BGR: "bg",
  BFA: "bf", BDI: "bi", CPV: "cv", KHM: "kh", CMR: "cm", CAN: "ca", CYM: "ky",
  CAF: "cf", TCD: "td", CHL: "cl", CHN: "cn", CXR: "cx", CCK: "cc", COL: "co",
  COM: "km", COG: "cg", COD: "cd", COK: "ck", CRI: "cr", CIV: "ci", HRV: "hr",
  CUB: "cu", CUW: "cw", CYP: "cy", CZE: "cz", DNK: "dk", DJI: "dj", DMA: "dm",
  DOM: "do", ECU: "ec", EGY: "eg", SLV: "sv", GNQ: "gq", ERI: "er", EST: "ee",
  SWZ: "sz", ETH: "et", FLK: "fk", FRO: "fo", FJI: "fj", FIN: "fi", FRA: "fr",
  GUF: "gf", PYF: "pf", ATF: "tf", GAB: "ga", GMB: "gm", GEO: "ge", DEU: "de",
  GHA: "gh", GIB: "gi", GRC: "gr", GRL: "gl", GRD: "gd", GLP: "gp", GUM: "gu",
  GTM: "gt", GGY: "gg", GIN: "gn", GNB: "gw", GUY: "gy", HTI: "ht", HMD: "hm",
  VAT: "va", HND: "hn", HKG: "hk", HUN: "hu", ISL: "is", IND: "in", IDN: "id",
  IRN: "ir", IRQ: "iq", IRL: "ie", IMN: "im", ISR: "il", ITA: "it", JAM: "jm",
  JPN: "jp", JEY: "je", JOR: "jo", KAZ: "kz", KEN: "ke", KIR: "ki", PRK: "kp",
  KOR: "kr", KWT: "kw", KGZ: "kg", LAO: "la", LVA: "lv", LBN: "lb", LSO: "ls",
  LBR: "lr", LBY: "ly", LIE: "li", LTU: "lt", LUX: "lu", MAC: "mo", MDG: "mg",
  MWI: "mw", MYS: "my", MDV: "mv", MLI: "ml", MLT: "mt", MHL: "mh", MTQ: "mq",
  MRT: "mr", MUS: "mu", MYT: "yt", MEX: "mx", FSM: "fm", MDA: "md", MCO: "mc",
  MNG: "mn", MNE: "me", MSR: "ms", MAR: "ma", MOZ: "mz", MMR: "mm", NAM: "na",
  NRU: "nr", NPL: "np", NLD: "nl", NCL: "nc", NZL: "nz", NIC: "ni", NER: "ne",
  NGA: "ng", NIU: "nu", NFK: "nf", MKD: "mk", MNP: "mp", NOR: "no", OMN: "om",
  PAK: "pk", PLW: "pw", PSE: "ps", PAN: "pa", PNG: "pg", PRY: "py", PER: "pe",
  PHL: "ph", PCN: "pn", POL: "pl", PRT: "pt", PRI: "pr", QAT: "qa", REU: "re",
  ROU: "ro", RUS: "ru", RWA: "rw", BLM: "bl", SHN: "sh", KNA: "kn", LCA: "lc",
  MAF: "mf", SPM: "pm", VCT: "vc", WSM: "ws", SMR: "sm", STP: "st", SAU: "sa",
  SEN: "sn", SRB: "rs", SYC: "sc", SLE: "sl", SGP: "sg", SXM: "sx", SVK: "sk",
  SVN: "si", SLB: "sb", SOM: "so", ZAF: "za", SGS: "gs", SSD: "ss", ESP: "es",
  LKA: "lk", SDN: "sd", SUR: "sr", SJM: "sj", SWE: "se", CHE: "ch", SYR: "sy",
  TWN: "tw", TJK: "tj", TZA: "tz", THA: "th", TLS: "tl", TGO: "tg", TKL: "tk",
  TON: "to", TTO: "tt", TUN: "tn", TUR: "tr", TKM: "tm", TCA: "tc", TUV: "tv",
  UGA: "ug", UKR: "ua", ARE: "ae", GBR: "gb", USA: "us", UMI: "um", URY: "uy",
  UZB: "uz", VUT: "vu", VEN: "ve", VNM: "vn", VGB: "vg", VIR: "vi", WLF: "wf",
  ESH: "eh", YEM: "ye", ZMB: "zm", ZWE: "zw",
};

/** Lowercase alpha-2 code for an iRacing alpha-3 flair code, or null. */
export function alpha2(alpha3: string): string | null {
  return ALPHA3_TO_ALPHA2[alpha3.toUpperCase()] ?? null;
}

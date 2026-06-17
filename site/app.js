// Replication Radar — live client-side engine over the OpenAIRE Graph API.
// Mirrors the Python package (replication_radar) so the web app and MCP agree.
// OpenAIRE allows CORS (*), so everything runs in the browser; no backend.

const API = "https://api.openaire.eu/graph/v1";
const CLASS_SCORE = { C1: 1, C2: 0.8, C3: 0.6, C4: 0.4, C5: 0.2 };
// Per-class tooltip text so EVERY class (not just C1/C5) explains itself on hover.
const CLS_PCT = { C1: "top 0.01%", C2: "top 0.1%", C3: "top 1%", C4: "top 10%", C5: "the rest (outside the top 10%)" };
const impactTip = (c) => `OpenAIRE BIP! citation-impact class — ${c} = ${CLS_PCT[c] || "—"} most-cited across all of science (C1 highest · C5 lowest)`;
const impulseTip = (c) => `OpenAIRE BIP! impulse class — ${c} = ${CLS_PCT[c] || "—"} by recent citation momentum (C1 highest · C5 lowest)`;
const EXAMPLES = ["species distribution", "marine heatwave", "bumble bee climate", "presence-only", "range maps scale"];

let VERDICTS = {};      // doi -> [verifications]
let CLAIMS = {};        // outcome-hash -> { label, aida, type } (what exactly was replicated)
let VERIFIED = [];      // enriched: {doi, title, citations, verifications}
let CURATED = {};       // doi -> paper-resolved materials (the links OpenAIRE lacks; from the paper)

// ---------- OpenAIRE helpers (same shape as openaire.py) ----------
const doiOf = (r) => {
  for (const p of r.pids || []) if ((p.scheme || "").toLowerCase() === "doi") return (p.value || "").toLowerCase();
  for (const i of r.instances || []) for (const p of i.pids || []) if ((p.scheme || "").toLowerCase() === "doi") return (p.value || "").toLowerCase();
  return null;
};
const surnames = (r) => (r.authors || []).map((a) => {
  let s = a.surname || "";
  if (!s && a.fullName) s = a.fullName.includes(",") ? a.fullName.split(",")[0] : a.fullName.split(" ").pop();
  return s.trim().toLowerCase();
}).filter(Boolean);
const impact = (r) => (r.indicators && r.indicators.citationImpact) || {};
const swh = (r) => (r.instances || []).some((i) => (i.urls || []).some((u) => (u || "").includes("softwareheritage.org")));
const swhUrlOf = (r) => (r.instances || []).flatMap((i) => i.urls || []).find((u) => (u || "").includes("softwareheritage.org")) || null;
const reuse = (r) => {
  let s = 0;
  if (r.codeRepositoryUrl) s += 2;
  if (swh(r)) s += 2;
  if ((r.indicators?.usageCounts?.downloads || 0) > 0) s += 1;
  if ((impact(r).citationCount || 0) > 0) s += 1;
  return s;
};
const classScore = (r) => Math.max(CLASS_SCORE[impact(r).influenceClass] || 0.2, CLASS_SCORE[impact(r).citationClass] || 0.2);
const independent = (target, cand) => cand.length === 0 || !cand.some((a) => target.includes(a));
const yearOf = (r) => { const m = /^(\d{4})/.exec(r.publicationDate || ""); return m ? +m[1] : null; };
const momentumScore = (r) => CLASS_SCORE[impact(r).impulseClass] || 0.2;   // BIP! impulse = early citation momentum
// Per-paper MATERIALS signal — grounded, with an explicit "unknown" (null) state.
// OpenAIRE's absence of a link is NOT real absence (the WiSDM rule): we only return
// present (a real repo / RO-Crate ON THIS record) or null (unknown — needs resolving).
const REPO_RE = /(github\.com|gitlab\.com|bitbucket\.org)/i;
const codeUrlOf = (r) => {
  if (r.codeRepositoryUrl && REPO_RE.test(r.codeRepositoryUrl)) return r.codeRepositoryUrl;
  for (const i of r.instances || []) for (const u of i.urls || []) if (REPO_RE.test(u || "")) return u;
  return null;
};
const isROCrate = (r) => /research object/i.test(r.type || "") || (r.instances || []).some((i) => /research object/i.test(i.type || ""));
// -> {score: 0..1 | null, state: 'rocrate' | 'code' | 'unknown', code}
const materialsOf = (r) => {
  if (isROCrate(r)) return { score: 1.0, state: "rocrate", code: codeUrlOf(r) };
  const code = codeUrlOf(r);
  if (code) return { score: 0.6, state: "code", code };
  return { score: null, state: "unknown", code: null };           // unknown != absent
};
// Transparent composite: materials is the largest term; when materials is UNKNOWN
// (null) we DROP that term and renormalise the rest — never score a missing link as 0.
const readinessFrom = (matScore, impactScore, momentum) => {
  // No renormalisation when materials are unknown: you can't even reproduce a paper whose
  // code/data aren't surfaced, so the materials term simply contributes 0 (worth caps at 0.55).
  // A paper WITH materials therefore always out-ranks an equally-cited one without.
  const r = 0.45 * (matScore || 0) + 0.35 * impactScore + 0.20 * momentum;
  return Math.round(r * 100) / 100;
};
// Inline Lucide icons (monochrome, inherit currentColor → the app's navy/pink/grey palette).
const svg = (p, s = 13) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  robust: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  validated: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  contested: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  refuted: svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
  reproducible: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  needs: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
  dormant: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 13),
  x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 13),
  star: svg('<path d="M11.5 2.3a.5.5 0 0 1 .9 0l2.3 4.7a2.1 2.1 0 0 0 1.6 1.1l5.2.8a.5.5 0 0 1 .3.9l-3.7 3.6a2.1 2.1 0 0 0-.6 1.9l.9 5.1a.5.5 0 0 1-.8.6l-4.6-2.4a2.1 2.1 0 0 0-2 0L6.7 21.3a.5.5 0 0 1-.8-.6l.9-5.1a2.1 2.1 0 0 0-.6-1.9l-3.7-3.6a.5.5 0 0 1 .3-.9l5.2-.8a2.1 2.1 0 0 0 1.6-1.1z"/>', 13),
  fork: svg('<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>', 13),
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 13),
};
// Status taxonomy — "not replicated" is DISAMBIGUATED, not penalised. (label = plain text; icon = SVG)
const STATUS = {
  robust:       { label: "Robustly validated", icon: ICON.robust,       cls: "st-val",   tip: "multiple independent replications, all confirmed — a settled, reliable result" },
  validated:    { label: "Validated",          icon: ICON.validated,    cls: "st-val",   tip: "independently replicated and it held up" },
  contested:    { label: "Contested",          icon: ICON.contested,    cls: "st-con",   tip: "independent replications DISAGREE (some confirm, some contradict/partial) — worth re-checking" },
  refuted:      { label: "Refuted",            icon: ICON.refuted,      cls: "st-ref",   tip: "independent replication(s) contradicted it, none confirmed" },
  reproducible: { label: "Reproducible",       icon: ICON.reproducible, cls: "st-ready", tip: "original code/data are available, so it can be RE-RUN (reproduced). Note: replication ≠ reproduction — replication tests the same claim with DIFFERENT data/methods (FORRT)." },
  needs:        { label: "Needs check",        icon: ICON.needs,        cls: "st-needs", tip: "not yet replicated and OpenAIRE links no materials — unknown (not absent); resolve from the paper" },
  dormant:      { label: "Dormant",            icon: ICON.dormant,      cls: "st-dorm",  tip: "no verdict, older, low momentum, no materials surfaced — likely dormant" },
};
// Distinct replication OUTCOMES for a paper — one SIGNED nanopub per independent replication
// (deduped by outcome URI). A record with no outcome nanopub isn't a replication (e.g. a stale
// non-verdict citation in the bundled fallback), so it's dropped — this keeps the count
// (agreementOf) and the rendered chips (outcomeLinks) in agreement.
const outcomesFor = (doi) => {
  const seen = new Set(), out = [];
  for (const v of VERDICTS[doi] || []) {
    if (!v.outcome_np || seen.has(v.outcome_np)) continue;
    seen.add(v.outcome_np);
    out.push({ np: v.outcome_np, verdict: v.verdict || "" });
  }
  return out;
};
// Colour an outcome chip by its verdict so the agreement pattern is legible at a glance.
const verdictClass = (v) => /contradict|notsupport|refut/i.test(v) ? "v-con"
  : /partial/i.test(v) ? "v-part"
  : /validat|confirm|support/i.test(v) ? "v-ok" : "v-other";
// Short, human verdict label for a chip (no arbitrary numbers — the verdict is the meaning).
const verdictLabel = (v) => /contradict/i.test(v) ? "Contradicted"
  : /notsupport/i.test(v) ? "Not supported"
  : /partial/i.test(v) ? "Partial"
  : /validat|confirm|support/i.test(v) ? "Validated" : (v || "outcome");
// Each replication outcome is a verdict-labelled, colour-coded chip linking to its signed nanopub
// — navy = confirmed, amber = partial, red = contradicted. No cryptic index numbers.
const outcomeLinks = (outs) => {
  if (!outs.length) return "";
  const lead = outs.length === 1 ? "replication outcome:" : `${outs.length} replication outcomes:`;
  return ` · ${lead} ` + outs.map((o) =>
    `<a class="onp ${verdictClass(o.verdict)}" href="${o.np}" target="_blank" rel="noopener" title="${esc(o.verdict)} — open the signed nanopub">${verdictLabel(o.verdict)}</a>`).join(" ");
};
// "See all replications" → the Science Live constellation page: every signed replication of this
// paper's claims, grouped by claim, with each verdict + the full chain. (Switch the host to
// platform.sciencelive4all.org once the page is deployed to prod.)
const CONSTELLATION = "https://platform-dev.sciencelive4all.org/np/replications?doi=";
const constellationLink = (doi, n) => !doi ? "" :
  ` · <a class="seeall" href="${CONSTELLATION}${encodeURIComponent(doi)}" target="_blank" rel="noopener">see ${n === 1 ? "the replication" : `all ${n} replications`} →</a>`;
// Agreement pattern across the independent replication verdicts — many-agree ≠ disagree.
const agreementOf = (doi) => {
  const vs = outcomesFor(doi).map((o) => o.verdict);
  const contra  = vs.filter((v) => /contradict|notsupport|refut/i.test(v)).length;
  const partial = vs.filter((v) => /partial/i.test(v)).length;
  const confirm = vs.filter((v) => /validat|confirm|support/i.test(v) && !/partial|contradict|notsupport|refut/i.test(v)).length;
  const n = vs.length;
  if (contra && (confirm || partial)) return { key: "contested", why: `${n} replications disagree — ${confirm} confirm · ${partial} partial · ${contra} contradict` };
  if (contra)                         return { key: "refuted",   why: `contradicted by ${contra} replication${contra > 1 ? "s" : ""}` };
  if (confirm >= 2 && !partial)       return { key: "robust",    why: `${confirm} independent replications, all confirmed` };
  if (confirm)                        return { key: "validated", why: partial ? `confirmed (${n} replications, ${partial} partial)` : (n > 1 ? `confirmed (${n} replications)` : "confirmed once") };
  if (partial)                        return { key: "validated", why: `partially supported (${partial} of ${n})` };
  return { key: "validated", why: "independently checked" };
};
const statusOf = (t) => {
  if (t.status === "VERIFIED") return agreementOf(t.doi).key;        // robust / validated / contested / refuted
  if (t.mat && t.mat.score != null) return "reproducible";          // original materials present → can re-run
  const old = t.year && (new Date().getFullYear() - t.year) >= 8;   // had time to be replicated
  const hot = t.impl === "C1" || t.impl === "C2";                   // still gaining momentum
  return (old && !hot) ? "dormant" : "needs";
};
// Replication PRIORITY (0..1) — how much this would benefit from (further) replication, so the
// number and the order agree. OPEN = worth × feasible (the readiness already computed). VERIFIED =
// impact modulated by the agreement: contested/unsettled rises, robustly-validated sinks (it's done).
const VERDICT_WEIGHT = { robust: 0.2, validated: 0.4, contested: 0.95, refuted: 0.55 };
const priorityOf = (t) => {
  if (t.status !== "VERIFIED") {
    // dormant = old, cold, no materials → low ACTIONABILITY, so it sinks below live targets
    // however high its historic citation count, matching what the "💤 Dormant" badge signals.
    return t.statusKey === "dormant" ? Math.round(t.readiness * 0.5 * 100) / 100 : t.readiness;
  }
  const imp = Math.max(CLASS_SCORE[t.infl] || 0.2, CLASS_SCORE[t.cls] || 0.2);
  return Math.round(imp * (VERDICT_WEIGHT[t.statusKey] ?? 0.4) * 100) / 100;
};

async function search(topic, type, size) {
  const u = `${API}/researchProducts?search=${encodeURIComponent(topic)}&type=${type}&pageSize=${size}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`OpenAIRE ${r.status}`);
  return (await r.json()).results || [];
}

// resolve a single record by DOI (any type) — used for the original paper AND the
// replication's own OpenAIRE node. OpenAIRE free-text matches the DOI string.
// Session caches — re-scanning reuses successful lookups instead of re-hitting the APIs.
// This is what makes repeated scans STABLE (and stops exhausting GitHub's 60/hour unauth
// limit, which used to make FAIR badges flicker). Only successes are cached, so a transient
// failure retries next time and the cache converges to complete.
const _DOI = new Map(), _FAIR = new Map();
async function fetchByDoi(doi) {
  if (!doi) return null;
  if (_DOI.has(doi)) return _DOI.get(doi);
  let res = null;
  try {
    const hits = (await (await fetch(`${API}/researchProducts?search=${encodeURIComponent(doi)}&pageSize=5`)).json()).results || [];
    res = hits.find((h) => doiOf(h) === doi.toLowerCase()) || hits[0] || null;
  } catch (e) { res = null; }
  if (res) _DOI.set(doi, res);
  return res;
}

// OpenAIRE richness we already receive but were hiding
const subjectsOf = (rec, scheme) => [...new Set((rec.subjects || []).filter((s) => s.subject && s.subject.scheme === scheme).map((s) => s.subject.value))];
const cleanFos = (arr) => [...new Set(arr.map((v) => v.replace(/^\d+\s+/, "")).filter((v) => v && !/^\d+$/.test(v)))];
const oaOf = (rec) => rec.openAccessColor || ((rec.bestAccessRight || {}).label || "").toLowerCase();
const urlOf = (rec) => (rec.instances && rec.instances[0] && rec.instances[0].urls && rec.instances[0].urls[0]) || null;
// Paper abstract from OpenAIRE `descriptions` — strip JATS/HTML tags, decode entities, collapse
// whitespace (mirrors the Python _abstract). Gives an OPEN target the context of what it claims.
const abstractOf = (rec) => {
  let t = (rec.descriptions || []).filter((d) => typeof d === "string").join(" ");
  if (!t) return "";
  t = t.replace(/<[^>]+>/g, " ");
  const d = document.createElement("textarea"); d.innerHTML = t; t = d.value;   // decode entities
  return t.replace(/\s+/g, " ").trim().replace(/^abstract[\s:.\-–—]*/i, "");    // drop redundant "Abstract" prefix
};

// ---------- software FAIR + usage assessment (grounded, live from GitHub + SWH) ----------
// Computes the fair-software.eu 5 recommendations + usage from authoritative sources
// (no third-party scorer needed — F-UJI/OSTrails have no usable API for this). Only
// ever run on a software record we ACTUALLY have a repo URL for — never guessed.
const parseGitHub = (url) => { const m = (url || "").match(/github\.com\/([^\/]+)\/([^\/#?]+)/i); return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null; };
// human labels for the fair-software.eu recommendations (shown on hover)
const RECLABEL = { repository: "public repository", license: "open license", registry: "in a registry", citation: "citable (CITATION.cff / DOI)", quality: "quality artefacts (env / Docker / CI)" };

// OpenAIRE often lacks the GitHub URL for a Zenodo deposit; Zenodo's own record
// always carries the source repo (related_identifiers) for GitHub-published software.
async function githubFromZenodo(doi) {
  const m = (doi || "").match(/zenodo\.(\d+)/i);
  if (!m) return null;
  try {
    const d = await (await fetch(`https://zenodo.org/api/records/${m[1]}`)).json();
    const rel = (d.metadata || {}).related_identifiers || [];
    return rel.map((r) => r.identifier).find((u) => (u || "").includes("github.com")) || null;
  } catch (e) { return null; }
}

async function assessSoftware(url) {
  if (_FAIR.has(url)) return _FAIR.get(url);   // cached success → stable across scans, saves rate limit
  const res = await _assessSoftware(url);
  if (res) _FAIR.set(url, res);
  return res;
}
async function _assessSoftware(url) {
  const g = parseGitHub(url);
  if (!g) return null;
  const base = `https://api.github.com/repos/${g.owner}/${g.repo}`;
  let repo;
  try { repo = await (await fetch(base)).json(); } catch (e) { return null; }
  if (!repo || repo.message) return null;                 // not found / GitHub rate-limited
  let files = [];
  try { const c = await (await fetch(`${base}/contents`)).json(); if (Array.isArray(c)) files = c.map((f) => (f.name || "").toLowerCase()); } catch (e) { /* ignore */ }
  const has = (n) => files.includes(n.toLowerCase());
  let swh = false;
  try { const s = await (await fetch(`https://archive.softwareheritage.org/api/1/origin/https://github.com/${g.owner}/${g.repo}/get/`)).json(); swh = !!s.origin_visits_url; } catch (e) { /* ignore */ }
  const recs = {
    repository: true,                                                       // public repo
    license: !!(repo.license && repo.license.spdx_id && repo.license.spdx_id !== "NOASSERTION"),
    registry: true,                                                         // it's in OpenAIRE/Zenodo (we reached it via the Graph)
    citation: has("citation.cff") || has("codemeta.json"),                  // citable
    quality: has("codemeta.json") || has("environment.yml") || has("dockerfile") || has("pixi.toml") || has(".github"), // reproducibility/quality artefacts
  };
  const score = Object.values(recs).filter(Boolean).length;
  return { stars: repo.stargazers_count || 0, forks: repo.forks_count || 0, license: (repo.license || {}).spdx_id, swh, recs, score, pct: Math.round((score / 5) * 100) };
}

// ---------- author-agnostic verdict index, live from the nanopub network ----------
// Every FORRT Replication Outcome + CiTO on the network (any signer), joined on the
// trusty hash. No person filter — verification is author-agnostic.
const NP_SPARQL = "https://query.knowledgepixels.com/repo/full";
const TPL_OUTCOME = "https://w3id.org/np/RA2zljn0Nw9SadppOyxZoh-_Rxosslrq-vYG-p9SttnJE";
const TPL_CITO = "https://w3id.org/np/RA43F9EoOuzF0xoNUnCMNyFsfIqlsuWDdPHCnN0wCdCAw";
const VERDICT_RELS = new Set(["confirms", "qualifies", "disputes", "critiques", "extends", "supports", "refutes"]);
// CiTO relations that are METHOD/DATA/CREDIT provenance — they point to a SOURCE paper, not a
// verdict on it. A verdict must never attach via these: a study that `usesMethodIn` Phillips 2009
// and was Contradicted does NOT contradict Phillips 2009 (it reused its method). (lowercased compare)
const NONVERDICT_RELS = new Set(["usesmethodin", "usesdatafrom", "citesasdatasource", "citesasevidence", "credits", "citesforinformation", "obtainsbackgroundfrom", "obtainssupportfrom", "citesasauthority", "citesasrelated", "citesassourcedocument", "includesquotationfrom", "sharesauthorinstitutionwith"]);
const npHash = (u) => (u || "").replace(/.*\/np\//, "");
const doiPart = (u) => (u || "").replace(/.*doi\.org\//, "").toLowerCase();
const cleanRepo = (r) => (!r ? null : r.includes("doi.org/") ? doiPart(r) : /^10\./.test(r) ? r.toLowerCase() : r);
// AIDA statement URI → the atomic claim sentence (mixed +/%20 encoding in the wild).
const aidaText = (u) => { if (!u) return ""; try { return decodeURIComponent(u.replace(/.*\/aida\//, "").replace(/\+/g, " ")); } catch (e) { return ""; } };
// e.g. ".../terms/model_performance-FORRT-Claim" → "model performance"
const claimType = (u) => (!u ? "" : u.replace(/.*\/terms\//, "").replace(/-FORRT-Claim$/, "").replace(/_/g, " "));
const claimFor = (outcome_np) => CLAIMS[npHash(outcome_np)] || null;

// The public nanopub-query endpoint 504s intermittently under load; one retry turns most of
// those transient failures into success, so the app stays on the LIVE index instead of dropping
// to the bundled snapshot (the source of the "random" differences).
async function sparqlCsv(query, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${NP_SPARQL}?query=${encodeURIComponent(query)}`, { headers: { Accept: "text/csv" } });
      if (!r.ok) throw new Error(`nanopub-query ${r.status}`);
      const lines = (await r.text()).trim().split(/\r?\n/);
      const head = lines.shift().split(",");
      return lines.map((line) => {
        const cells = (line.match(/("([^"]*)"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));
        const o = {}; head.forEach((h, i) => (o[h] = cells[i])); return o;
      });
    } catch (e) {
      lastErr = e;
      if (i + 1 < tries) await new Promise((res) => setTimeout(res, 700 * (i + 1)));
    }
  }
  throw lastErr;
}

async function buildIndexFromNetwork() {
  const QA = `PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX slt: <https://w3id.org/sciencelive/o/terms/>
SELECT DISTINCT ?outcome ?status ?repo WHERE { GRAPH ?g { ?outcome ntpl:wasCreatedFromTemplate <${TPL_OUTCOME}> . } ?outcome np:hasAssertion ?oa . GRAPH ?oa { ?oc slt:hasValidationStatus ?s . OPTIONAL { ?oc slt:hasOutcomeRepository ?repo . } } BIND(STRAFTER(STR(?s),"/terms/") AS ?status) }`;
  const QB = `PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX cito: <http://purl.org/spar/cito/>
SELECT DISTINCT ?cito ?subj ?rel ?orig WHERE { GRAPH ?g { ?cito ntpl:wasCreatedFromTemplate <${TPL_CITO}> . } ?cito np:hasAssertion ?ca . GRAPH ?ca { ?subj ?rel ?orig . } FILTER(STRSTARTS(STR(?rel),STR(cito:))) FILTER(CONTAINS(STR(?orig),"doi.org/10.")) } LIMIT 3000`;
  // QC: what exactly was replicated — traverse Outcome →isOutcomeOf→ Study →targetsClaim→ Claim,
  // pulling the claim label, its AIDA statement (the atomic claim sentence), and its FORRT type.
  const QC = `PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX slt: <https://w3id.org/sciencelive/o/terms/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?outcome ?claimLabel ?aida ?ctype WHERE { GRAPH ?og { ?outcome ntpl:wasCreatedFromTemplate <${TPL_OUTCOME}> . } ?outcome np:hasAssertion ?oa . GRAPH ?oa { ?oc slt:isOutcomeOf ?study . } GRAPH ?sg { ?study slt:targetsClaim ?claim . } GRAPH ?cg { ?claim rdfs:label ?claimLabel . } OPTIONAL { GRAPH ?cg { ?claim slt:asAidaStatement ?aida . } } OPTIONAL { GRAPH ?cg { ?claim a ?ctype . FILTER(CONTAINS(STR(?ctype),"-FORRT-Claim")) } } } LIMIT 500`;
  // QV: validity guard — OUR Outcomes retracted / invalidated / superseded by a nanopub from the
  // SAME creator (only the original author can retract their own work; a third-party `retracts`
  // must not suppress someone else's). Disapproval is deliberately excluded — that's disagreement,
  // not retraction. Anchored on the Outcome template alone to stay under the endpoint timeout.
  const QV = `PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX npx: <http://purl.org/nanopub/x/> PREFIX dct: <http://purl.org/dc/terms/>
SELECT DISTINCT ?np WHERE { GRAPH ?g { ?np ntpl:wasCreatedFromTemplate <${TPL_OUTCOME}> . } GRAPH ?supg { ?sup ?act ?np . } VALUES ?act { npx:retracts npx:invalidates npx:supersedes } GRAPH ?cg1 { ?sup dct:creator ?cc . } GRAPH ?cg2 { ?np dct:creator ?cc . } }`;
  const A = await sparqlCsv(QA);            // sequential: concurrent queries truncate the endpoint
  const B = await sparqlCsv(QB);
  let invalid = new Set();
  try { invalid = new Set((await sparqlCsv(QV)).map((r) => npHash(r.np))); }  // best-effort: never break verdicts
  catch (e) { /* no guard this load */ }
  CLAIMS = {};
  try {                                     // claim enrichment is best-effort — never break verdicts
    for (const r of await sparqlCsv(QC)) {
      const h = npHash(r.outcome);
      if (!CLAIMS[h]) CLAIMS[h] = { label: r.claimLabel || "", aida: aidaText(r.aida), type: claimType(r.ctype) };
    }
  } catch (e) { /* claims stay empty; cards still show verdict + why */ }
  const byHash = {};
  for (const r of B) {
    const h = npHash(r.subj);
    (byHash[h] = byHash[h] || []).push({ rel: (r.rel || "").replace(/.*cito\//, ""), orig: doiPart(r.orig), cito: r.cito });
  }
  const V = {};
  for (const o of A) {
    if (invalid.has(npHash(o.outcome))) continue;   // drop a superseded/retracted Outcome
    const cs = byHash[npHash(o.outcome)] || [];
    const verdictCitos = cs.filter((c) => VERDICT_RELS.has(c.rel) && !c.orig.startsWith("10.5281/"));
    const targets = verdictCitos.length ? verdictCitos
      : cs.filter((c) => !NONVERDICT_RELS.has((c.rel || "").toLowerCase()) && !c.orig.startsWith("10.5281/"));
    for (const c of targets) {
      (V[c.orig] = V[c.orig] || []).push({
        verdict: o.status || "Published", cito: [c.rel], repo_doi: cleanRepo(o.repo),
        outcome_np: o.outcome, cito_np: c.cito,
      });
    }
  }
  return V;
}

// ---------- load + enrich the verdict index ----------
async function loadVerdicts() {
  try {
    VERDICTS = await buildIndexFromNetwork();           // live, author-agnostic, network-wide
    if (!Object.keys(VERDICTS).length) throw new Error("empty");
  } catch (e) {
    VERDICTS = (await (await fetch("verdicts.json")).json()).verifications || {};  // bundled fallback
  }
  VERIFIED = await Promise.all(Object.entries(VERDICTS).map(async ([doi, vs]) => {
    const rec = await fetchByDoi(doi);   // the original paper, as an OpenAIRE node
    return {
      doi,
      verdicts: [...new Set(vs.map((v) => v.verdict))],
      title: rec ? (rec.mainTitle || doi) : doi,
      citations: rec ? (impact(rec).citationCount || 0) : 0,
      cls: rec ? impact(rec).citationClass : null,
      infl: rec ? impact(rec).influenceClass : null,
      impl: rec ? impact(rec).impulseClass : null,
      year: rec ? yearOf(rec) : null,
      oa: rec ? oaOf(rec) : "",
      fos: rec ? cleanFos(subjectsOf(rec, "FOS")).slice(0, 2) : [],
      sdg: rec ? subjectsOf(rec, "SDG").slice(0, 1) : [],
      repo: vs[0]?.repo, repo_doi: vs[0]?.repo_doi,
      cito_np: vs[0]?.cito_np, outcome_np: vs[0]?.outcome_np,
      repl: undefined,   // the replication's OpenAIRE node, resolved lazily for field matches
    };
  }));
}

// ---------- curated paper-resolved materials (the links OpenAIRE doesn't hold) ----------
// curated.json carries only the repo/RO-Crate link, taken from each paper's Data/Code
// statement (grounded). FAIR is still computed LIVE by assessSoftware() against the repo.
async function loadCurated() {
  try { CURATED = (await (await fetch("curated.json")).json()).resolved || {}; }
  catch (e) { CURATED = {}; return; }
  // enrich each with its OpenAIRE node (title / impact / year) so it can be injected + ranked
  await Promise.all(Object.entries(CURATED).map(async ([doi, c]) => {
    const rec = await fetchByDoi(doi);
    if (rec) {
      c.title = rec.mainTitle || doi; c.citations = impact(rec).citationCount || 0;
      c.cls = impact(rec).citationClass; c.infl = impact(rec).influenceClass;
      c.impl = impact(rec).impulseClass; c.year = yearOf(rec); c.abstract = abstractOf(rec);
    } else { c.title = c.title || doi; }
  }));
}

// ---------- the radar ----------
// OpenAIRE returns peer-review reports, comments, errata etc. as "publications" —
// not replication targets. Drop them, and collapse versions/duplicates by title.
const _normTitle = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isNotAPaper = (r) => /^\s*(review (for|of)\b|peer[- ]?review\b|comment (on|to)\b|repl(y|ies) to\b|response to\b|correction\b|corrigend|errat|editorial\b|withdrawn\b|retraction\b)/i.test(r.mainTitle || "");

function dedup(list) {
  const seen = new Set(), out = [];
  for (const r of list) {
    if (isNotAPaper(r)) continue;
    const k = _normTitle(r.mainTitle) || doiOf(r);
    if (k && !seen.has(k)) { seen.add(k); out.push(r); }
  }
  return out;
}

async function radar(topic) {
  let pubs = dedup(await search(topic, "publication", 80));
  const terms = topic.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  if (pubs.length < 5 && terms.length > 1) {
    const longest = terms.sort((a, b) => b.length - a.length)[0];
    pubs = dedup(pubs.concat(await search(longest, "publication", 80)));
  }
  const rank = (r) => [CLASS_SCORE[impact(r).influenceClass] || .2, CLASS_SCORE[impact(r).citationClass] || .2, (impact(r).citationCount || 0)];
  pubs.sort((a, b) => { const A = rank(a), B = rank(b); return (B[0] - A[0]) || (B[1] - A[1]) || (B[2] - A[2]); });

  const targets = pubs.slice(0, 50).map((p) => {
    const doi = doiOf(p);
    const verified = doi && VERDICTS[doi];
    let mat = materialsOf(p);                          // per-paper, grounded (unknown != absent)
    const cur = doi && CURATED[doi];                   // paper-resolved materials override (P2)
    if (cur) mat = { score: cur.state === "rocrate" ? 1.0 : 0.6, state: cur.state, code: cur.code || null, resolved: true, data: cur.data || [], source: cur.source || "the paper", lang: cur.lang };
    const impactScore = classScore(p), momentum = momentumScore(p);
    const readiness = readinessFrom(mat.score, impactScore, momentum);   // computed for ALL (incl. verified)
    return {
      title: p.mainTitle || "", doi, citations: impact(p).citationCount || 0,
      abstract: abstractOf(p),
      cls: impact(p).citationClass, infl: impact(p).influenceClass,
      year: yearOf(p), impl: impact(p).impulseClass || null,
      mat, parts: { mat: mat.score, impact: impactScore, momentum },
      status: verified ? "VERIFIED" : "OPEN", readiness,
      verification: verified ? [...new Set(VERDICTS[doi].map((v) => v.verdict))].join(", ") : null,
      outcome_np: verified ? ((VERDICTS[doi].find((v) => v.outcome_np) || {}).outcome_np || null) : null,
    };
  });
  targets.sort((a, b) => (b.readiness || 0) - (a.readiness || 0) || (b.citations || 0) - (a.citations || 0));  // by replicability, verified & open together

  // verified-in-field: keep only the BEST-matching tier, so a single generic word
  // (e.g. "climate") can't pull in unrelated papers. A paper is in-field only if it
  // matches as many query terms as the strongest match does.
  const scored = VERIFIED
    .map((v) => {
      const tw = new Set(v.title.toLowerCase().split(/\W+/));
      return { v, n: terms.filter((t) => tw.has(t)).length };
    })
    .filter((x) => x.n > 0);
  const maxN = scored.reduce((m, x) => Math.max(m, x.n), 0);
  const fieldVerified = scored.filter((x) => x.n === maxN).map((x) => x.v);
  const inField = new Set(fieldVerified.map((v) => v.doi));

  // resolve each field-matched replication as its OWN OpenAIRE node (Zenodo/RO)
  await Promise.all(fieldVerified.map(async (v) => {
    if (v.repo_doi && v.repl === undefined) {
      const rec = await fetchByDoi(v.repo_doi);
      if (rec) {
        let code = rec.codeRepositoryUrl || urlOf(rec) || "";
        if (!parseGitHub(code)) code = (await githubFromZenodo(v.repo_doi)) || code;  // Zenodo fallback for the repo URL
        v.repl = { title: rec.mainTitle || "", type: rec.type || "output", oa: oaOf(rec), url: urlOf(rec) || `https://doi.org/${v.repo_doi}`, doi: v.repo_doi, code };
        v.repl.fair = await assessSoftware(code);   // FAIR + usage, only if it resolves to a GitHub repo
      } else {
        v.repl = null;
      }
    }
  }));

  // chart = top targets + any field-relevant verified papers not already in the pool,
  // ranked by citation impact, coloured by status. Green appears iff the field has
  // checked work — so the chart and the sidebar can never contradict each other.
  const poolItems = targets.map((t) => ({ title: t.title, citations: t.citations, status: t.status }));
  const extra = fieldVerified
    .filter((v) => !targets.some((t) => t.doi === v.doi))
    .map((v) => ({ title: v.title, citations: v.citations, status: "VERIFIED" }));
  const chartItems = [...poolItems, ...extra].sort((a, b) => (b.citations || 0) - (a.citations || 0)).slice(0, 12);

  // Inject matched VERIFIED papers that OpenAIRE's keyword search didn't return, so
  // the paper you replicated always appears in the table (at its replicability rank).
  const have = new Set(targets.map((t) => t.doi));
  for (const v of fieldVerified) {
    if (!v.doi || have.has(v.doi)) continue;
    const cs = Math.max(CLASS_SCORE[v.infl] || 0.2, CLASS_SCORE[v.cls] || 0.2);
    const momentum = CLASS_SCORE[v.impl] || 0.2;
    // verified: the materials score is about reproducing the ORIGINAL (unknown here) — NOT the
    // replication's own repo. Keep that repo only so the FAIR badge can assess it.
    targets.push({
      title: v.title, doi: v.doi, citations: v.citations, cls: v.cls, infl: v.infl,
      year: v.year || null, impl: v.impl || null,
      mat: { score: null, state: "unknown", code: (v.repl && v.repl.code) || null },
      parts: { mat: null, impact: cs, momentum },
      status: "VERIFIED",
      readiness: readinessFrom(null, cs, momentum),
      verification: [...new Set(v.verdicts)].join(", "),
      outcome_np: v.outcome_np,
    });
  }
  // Inject curated, paper-resolved candidates that match the field but OpenAIRE search missed,
  // so the fully-resolved (materials-verified) papers always appear for their topic.
  for (const [doi, c] of Object.entries(CURATED)) {
    if (targets.some((t) => t.doi === doi)) continue;
    const tw = new Set((c.title || "").toLowerCase().split(/\W+/));
    if (!terms.some((t) => tw.has(t))) continue;       // only when it matches the search
    const impactScore = Math.max(CLASS_SCORE[c.infl] || 0.2, CLASS_SCORE[c.cls] || 0.2);
    const momentum = CLASS_SCORE[c.impl] || 0.2;
    const matScore = c.state === "rocrate" ? 1.0 : 0.6;
    targets.push({
      title: c.title, doi, citations: c.citations || 0, cls: c.cls, infl: c.infl,
      year: c.year || null, impl: c.impl || null, abstract: c.abstract || "",
      mat: { score: matScore, state: c.state, code: c.code || null, resolved: true, data: c.data || [], source: c.source || "the paper", lang: c.lang },
      parts: { mat: matScore, impact: impactScore, momentum },
      status: VERDICTS[doi] ? "VERIFIED" : "OPEN",
      readiness: readinessFrom(matScore, impactScore, momentum),
      verification: VERDICTS[doi] ? [...new Set(VERDICTS[doi].map((v) => v.verdict))].join(", ") : null,
      outcome_np: VERDICTS[doi] ? ((VERDICTS[doi].find((v) => v.outcome_np) || {}).outcome_np || null) : null,
    });
  }
  targets.forEach((t) => { t.statusKey = statusOf(t); t.priority = priorityOf(t); });
  // sort by replication PRIORITY — so the number and the order agree (contested/unchecked rise,
  // robustly-validated sinks). No status-rank override.
  targets.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.citations || 0) - (a.citations || 0));

  // FAIR computed LIVE (same assessSoftware the verified path uses) for paper-resolved repos
  await Promise.all(targets.map(async (t) => {
    if (t.mat && t.mat.resolved && t.mat.code && parseGitHub(t.mat.code)) t.fair = await assessSoftware(t.mat.code);
  }));

  return { topic, targets, inField, chartItems };
}

// ---------- rendering ----------
const el = (id) => document.getElementById(id);
const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const PER_PAGE = 10;
let _targets = [], _tpage = 0, _tfilter = new Set();

// FAIR-software block: a fold that expands to the 5 fair-software.eu recommendations (met/missing),
// with a live Software Heritage link (browse the archived snapshot, or Save Code Now if not yet).
const FAIR_REC = { repository: "public repository", license: "open licence", registry: "in a registry", citation: "citable (CITATION.cff / DOI)", quality: "quality artefacts" };
// Software Heritage status: archived → browse the snapshot; not yet → a one-click "archive it"
// button that POSTs to the SWH Save-Code-Now API (anonymous, CORS-open, no account needed).
const swhHtml = (repo, archived) => {
  if (archived) {
    const b = repo ? `https://archive.softwareheritage.org/browse/origin/directory/?origin_url=${encodeURIComponent(repo)}` : null;
    return b ? `<a class="swhok" href="${b}" target="_blank" rel="noopener" title="Browse the archived snapshot in Software Heritage">in Software Heritage</a>` : `<span class="swhok">in Software Heritage</span>`;
  }
  if (!repo) return `<a class="swhno" href="https://archive.softwareheritage.org/save/" target="_blank" rel="noopener">not yet archived</a>`;
  return `<button type="button" class="swhsave" data-repo="${esc(repo)}" onclick="swhSave(this)" title="Open Software Heritage Save Code Now and copy this repo's URL ready to paste">not yet archived — archive it →</button>`;
};
// SWH's save API can't be called cross-origin from a static page (the repo URL sits in the request
// path and the form can't be pre-filled), so do the reliable thing: copy the repo URL to the
// clipboard and open the Save Code Now form — one click, then paste (Cmd/Ctrl-V) and submit.
window.swhSave = async (btn) => {
  const repo = btn.dataset.repo || "";
  try { if (repo && navigator.clipboard) { await navigator.clipboard.writeText(repo); btn.classList.add("done"); btn.innerHTML = `${ICON.check}repo URL copied — paste it into the form`; } }
  catch (e) { /* clipboard blocked — the form still opens */ }
  window.open("https://archive.softwareheritage.org/save/", "_blank", "noopener");
};
function fairBlock(f, repo) {
  const recs = Object.entries(f.recs || {}).map(([k, ok]) =>
    `<span class="${ok ? "rok" : "rno"}">${ok ? ICON.check : ICON.x}${FAIR_REC[k] || k}</span>`).join("");
  // The pill is the expand control (the FAIR score). Stars + Software Heritage are
  // separate metadata — Software Heritage is about archival, not the FAIR breakdown —
  // and the SWH link stops its click from toggling the fold.
  const swh = `<span onclick="event.stopPropagation()">${swhHtml(repo, f.swh)}</span>`;
  return `<details class="tfair"><summary>` +
    `<span class="fairtoggle">FAIR software <b>${f.score}/5</b>${ICON.chevron}<span class="fairhint">see what's checked</span></span>` +
    `<span class="fairmeta">${ICON.star}${f.stars} · ${swh}</span>` +
    `</summary><div class="fairrecs">${recs}</div></details>`;
}

// Structured, readable breakdown of the priority score (replaces a run-on `title` tooltip).
function scoreBreakdown(t) {
  const p = t.parts || {};
  const num = (x) => (x == null ? 0 : x);
  const bar = (v) => `<span class="pbar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></span>`;
  const row = (k, v, contrib) =>
    `<div class="poprow"><span class="pk">${k}</span>${bar(v)}<span class="pv">${v.toFixed(2)}</span><span class="pc">→ ${contrib.toFixed(2)}</span></div>`;
  // weighted row: shows score × weight = contribution explicitly, so the formula's weights are traceable
  const wrow = (k, v, w, contrib) =>
    `<div class="poprow wt"><span class="pk">${k}</span>${bar(v)}<span class="pv">${v.toFixed(2)}</span><span class="pw">×${w.toFixed(2)}</span><span class="pc">= ${contrib.toFixed(2)}</span></div>`;
  if (t.status === "VERIFIED") {
    const imp = Math.max(CLASS_SCORE[t.infl] || 0.2, CLASS_SCORE[t.cls] || 0.2);
    const w = VERDICT_WEIGHT[t.statusKey] ?? 0.4;
    return `<div class="poptitle">Replication priority <b>${t.priority.toFixed(2)}</b></div>`
      + `<div class="popsub">already checked — ranked by whether it's worth re-checking</div>`
      + `<div class="popformula">impact × agreement</div>`
      + `<div class="poprows">${row("impact", imp, imp)}`
      + `<div class="poprow"><span class="pk">agreement</span>${bar(w)}<span class="pv">${w.toFixed(2)}</span><span class="pc">${esc(t.statusKey)}</span></div></div>`
      + `<div class="poptot">${imp.toFixed(2)} × ${w.toFixed(2)} = <b>${t.priority.toFixed(2)}</b></div>`
      + `<div class="popnote">A contested result rises (worth re-checking); a robustly-validated one sinks (it's settled).</div>`;
  }
  const mat = num(p.mat), impact = num(p.impact), mom = num(p.momentum);
  const cMat = 0.45 * mat, cImp = 0.35 * impact, cMom = 0.20 * mom, sub = cMat + cImp + cMom;
  const dormant = t.statusKey === "dormant";
  return `<div class="poptitle">Replication priority <b>${t.priority.toFixed(2)}</b></div>`
    + `<div class="popsub">how worth-replicating this is (0–1)</div>`
    + `<div class="popformula">0.45·materials + 0.35·impact + 0.20·momentum</div>`
    + `<div class="pophow">each score is 0–1; multiplied by its weight, the three parts add up to the priority</div>`
    + `<div class="poprows">${wrow("materials", mat, 0.45, cMat)}${wrow("impact", impact, 0.35, cImp)}${wrow("momentum", mom, 0.20, cMom)}</div>`
    + (dormant
        ? `<div class="poptot">${sub.toFixed(2)} × 0.5 <span class="pdormant">dormant</span> = <b>${t.priority.toFixed(2)}</b></div>`
        : `<div class="poptot">= <b>${t.priority.toFixed(2)}</b></div>`)
    + `<div class="popnote">materials = code &amp; data linked to the paper${p.mat == null ? " (unverified → counts as 0)" : ""} · impact = BIP! citation class · momentum = BIP! impulse class (recent citation rate) — both from OpenAIRE${dormant ? " · dormant (old, cold, no materials) → ×0.5" : ""}</div>`;
}

function targetRow(t) {
  const p = t.parts || {};
  const scoreAria = t.status === "VERIFIED"
    ? `Replication priority ${t.priority != null ? t.priority.toFixed(2) : "—"}. Already checked; ranked by whether it's worth re-checking (${t.statusKey}).`
    : `Replication priority ${t.priority != null ? t.priority.toFixed(2) : "—"} of 1. Materials ${p.mat == null ? "unverified" : p.mat.toFixed(2)}, impact ${(p.impact || 0).toFixed(2)}, momentum ${(p.momentum || 0).toFixed(2)}.`;
  const score = `<div class="score" tabindex="0" role="note" aria-label="${esc(scoreAria)}"><span>${t.priority != null ? t.priority.toFixed(2) : "—"}</span><small>PRIORITY</small><div class="scorepop" role="tooltip">${scoreBreakdown(t)}</div></div>`;
  const st = STATUS[t.statusKey] || STATUS.needs;
  const badge = `<span class="badge ${st.cls}" title="${esc(st.tip)}">${st.icon}${st.label}</span>`
    + (t.cls ? `<span class="badge cls" title="${esc(impactTip(t.cls))}">${t.cls}</span>` : "");
  // Materials badge ONLY when positively known. OpenAIRE rarely links code/data to a
  // paper, so 'unknown' is the norm in live search and would be noise on every row —
  // it's carried in the score breakdown tooltip, and resolved in the baked demo set.
  const matMeta = (t.mat && t.mat.state === "rocrate") ? `<span class="badge mok" title="RO-Crate research object — code + data + provenance bundled">${ICON.check}RO-Crate</span>`
    : (t.mat && t.mat.state === "code") ? `<span class="badge mok" title="code repository linked to this paper">${ICON.check}code</span>`
    : "";
  const meta = `<div class="t-meta">`
    + (t.year ? `<span class="badge yr">${t.year}</span>` : "")
    + (t.impl ? `<span class="badge imp" title="${esc(impulseTip(t.impl))}">impulse ${t.impl}</span>` : "")
    + matMeta + `</div>`;
  const link = t.doi ? `<a href="https://doi.org/${t.doi}" target="_blank" rel="noopener">${t.doi}</a>` : "";
  // what EXACTLY was replicated — the claim's AIDA statement (atomic sentence) + its FORRT type
  const cl = t.status === "VERIFIED" ? claimFor(t.outcome_np) : null;
  const claimLine = (cl && (cl.aida || cl.label))
    ? `<div class="tclaim"><span class="claimlbl">claim:</span> <span class="claimq">“${esc(cl.aida || cl.label)}”</span>${cl.type ? ` <span class="badge ctype" title="FORRT claim type">${esc(cl.type)}</span>` : ""}</div>` : "";
  // OPEN targets have no verdict-chain claim yet — show the abstract for context on what you'd
  // test. Long ones fold (click to expand the full text) so the card stays compact.
  const absLine = (t.status !== "VERIFIED" && t.abstract)
    ? (t.abstract.length <= 240
        ? `<div class="tabstract"><span class="claimlbl">abstract</span> ${esc(t.abstract)}</div>`
        : `<details class="tabstract"><summary><span class="claimlbl">abstract</span> <span class="absnip">${esc(t.abstract.slice(0, 200))}…</span></summary><div class="absfull">${esc(t.abstract)}</div></details>`)
    : "";
  const outs = t.status === "VERIFIED" ? outcomesFor(t.doi).filter((o) => o.np) : [];
  const verdictLink = (t.status === "VERIFIED")
    ? `<div class="tverdict">independently checked by <a href="https://sciencelive4all.org" target="_blank" rel="noopener">Science Live</a> — <b>${esc(agreementOf(t.doi).why)}</b>${constellationLink(t.doi, outs.length)}</div>` : "";
  const resolvedNote = (t.mat && t.mat.resolved)
    ? `<div class="tresolved">↳ materials resolved from ${esc(t.mat.source || "the paper")} (not in OpenAIRE): <a href="${esc(t.mat.code || "")}" target="_blank" rel="noopener">code repo</a>${(t.mat.data && t.mat.data.length) ? ` · data: ${t.mat.data.map(esc).join(", ")}` : ""}</div>`
    : "";
  const fairNote = t.fair ? fairBlock(t.fair, t.mat && t.mat.code) : "";
  // OPEN targets get a next step: discovery here → the FORRT template handles the nanopub chain.
  const replicateCTA = (t.status !== "VERIFIED")
    ? `<div class="treplicate"><a href="https://github.com/ScienceLiveHub/forrt-replication-template" target="_blank" rel="noopener" title="Start a replication from the FORRT template — it scaffolds the repo and the signed nanopub chain (Claim · Study · Outcome)">▷ Replicate this with the template →</a></div>`
    : "";
  return `<div class="target ${t.status === "VERIFIED" ? "verified" : ""}">
    ${score}
    <div class="t-main">${badge}<br><b>${esc(t.title)}</b>${meta}${claimLine}${absLine}${verdictLink}${resolvedNote}${fairNote}${replicateCTA}</div>
    <div class="t-right">${t.citations.toLocaleString()} cites<br>${link}</div>
  </div>`;
}

const FILTER_ORDER = ["reproducible", "robust", "validated", "contested", "refuted", "needs", "dormant"];
const visibleTargets = () => (_tfilter.size ? _targets.filter((t) => _tfilter.has(t.statusKey)) : _targets);

function paintFilters() {
  const counts = {};
  for (const t of _targets) counts[t.statusKey] = (counts[t.statusKey] || 0) + 1;
  const present = FILTER_ORDER.filter((k) => counts[k]);
  if (present.length < 2) { el("tfilters").innerHTML = ""; return; }   // nothing to filter
  const chip = (on, key, label, count) =>
    `<button class="tfilter${on ? " on" : ""}" onclick="filterTargets(${key ? `'${key}'` : "null"})"${key ? ` title="${esc(STATUS[key].tip)}"` : ""}>${label} <span>${count}</span></button>`;
  el("tfilters").innerHTML = chip(_tfilter.size === 0, null, "All", _targets.length)
    + present.map((k) => chip(_tfilter.has(k), k, STATUS[k].label, counts[k])).join("");
}

function paintTargets() {
  paintFilters();
  const list = visibleTargets();
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (_tpage >= pages) _tpage = pages - 1;
  if (_tpage < 0) _tpage = 0;
  el("tcount").textContent = `${_targets.length} candidate${_targets.length === 1 ? "" : "s"}`;
  el("targets").innerHTML = list.length
    ? list.slice(_tpage * PER_PAGE, _tpage * PER_PAGE + PER_PAGE).map(targetRow).join("")
    : `<p class="hint" style="padding:10px 2px">No candidates in this category — <a href="#" onclick="filterTargets(null);return false">show all</a>.</p>`;
  el("tpager").innerHTML = pages > 1
    ? `<button ${_tpage === 0 ? "disabled" : ""} onclick="pageTargets(-1)">← Prev</button><span>Page ${_tpage + 1} of ${pages}</span><button ${_tpage >= pages - 1 ? "disabled" : ""} onclick="pageTargets(1)">Next →</button>`
    : "";
}

function renderTargets(targets) { _targets = targets; _tpage = 0; _tfilter.clear(); paintTargets(); }
window.pageTargets = (d) => { _tpage += d; paintTargets(); el("targets").scrollIntoView({ behavior: "smooth", block: "start" }); };
window.filterTargets = (k) => {
  if (k === null) _tfilter.clear();
  else if (_tfilter.has(k)) _tfilter.delete(k);
  else _tfilter.add(k);
  _tpage = 0; paintTargets();
};


function renderVerified(inField) {
  const field = VERIFIED.filter((v) => inField.has(v.doi)).sort((a, b) => b.citations - a.citations);
  const others = VERIFIED.filter((v) => !inField.has(v.doi)).sort((a, b) => b.citations - a.citations);
  el("vcount").textContent = field.length;

  const partialOf = (v) => v.verdicts.some((x) => /partial/i.test(x));

  // rich card: the trust edge shown as TWO OpenAIRE nodes (original + replication)
  const matchCard = (v) => {
    const chips = [
      v.oa ? `<span class="ochip oa" title="Open-access route (OpenAIRE) — how the paper is free to read: gold/diamond = OA journal, hybrid = OA in a subscription journal, green = self-archived copy, bronze = free on the publisher site with no open licence">${esc(v.oa)} OA</span>` : "",
      ...(v.fos || []).map((f) => `<span class="ochip" title="Field of Science (OECD FOS scheme) — subject classification assigned by OpenAIRE">${esc(f).slice(0, 24)}</span>`),
      ...(v.sdg || []).map((s) => { const m = /^(\d+)\./.exec(s); return m
        ? `<a class="ochip sdg" href="https://sdgs.un.org/goals/goal${m[1]}" target="_blank" rel="noopener" title="UN Sustainable Development Goal ${m[1]} — assigned by OpenAIRE's SDG classifier (opens the UN definition)">${esc(s).slice(0, 22)}</a>`
        : `<span class="ochip sdg" title="UN Sustainable Development Goal — assigned by OpenAIRE's SDG classifier">${esc(s).slice(0, 22)}</span>`; }),
      `<span class="ochip cites" title="Citation count from the OpenAIRE Graph">${v.citations.toLocaleString()} cites</span>`,
    ].join("");
    let repl = "";
    if (v.repl) {
      const f = v.repl.fair;
      const fairBadge = f
        ? `<div class="fairrecs"><b>FAIR software (${f.score}/5):</b> ${Object.entries(f.recs).map(([k, ok]) => `<span class="${ok ? "rok" : "rno"}">${ok ? ICON.check : ICON.x}${FAIR_REC[k] || k}</span>`).join("")}</div>
        <div class="fairline">${ICON.star}${f.stars} stars · ${ICON.fork}${f.forks} forks · ${swhHtml(v.repl.code, f.swh)}</div>`
        : "";
      const nodeHref = v.repl.code && v.repl.code.includes("github") ? v.repl.code : v.repl.url;
      repl = `<div class="vrepl">↳ replication is an OpenAIRE node: <a href="${nodeHref}" target="_blank" rel="noopener">${esc(v.repl.title).slice(0, 44) || v.repl.doi}</a> <span class="ochip type">${esc(v.repl.type)}</span></div>${fairBadge}`;
    } else if (v.repo_doi) {
      repl = `<div class="vrepl muted">↳ replication deposit: <a href="${v.repo_doi.startsWith("http") ? esc(v.repo_doi) : "https://doi.org/" + esc(v.repo_doi)}" target="_blank" rel="noopener">${esc(v.repo_doi)}</a> <span class="ochip wait">awaiting OpenAIRE harvest</span></div>`;
    }
    const vouts = outcomesFor(v.doi).filter((o) => o.np);
    const vcl = claimFor(v.outcome_np);
    const vClaimLine = (vcl && (vcl.aida || vcl.label))
      ? `<div class="vclaim"><span class="claimlbl">claim replicated</span> <span class="claimq">“${esc(vcl.aida || vcl.label)}”</span>${vcl.type ? ` <span class="badge ctype" title="FORRT claim type">${esc(vcl.type)}</span>` : ""}</div>` : "";
    return `<li class="match">
      <span class="nodelabel">original paper · OpenAIRE</span>
      <span class="vt">${esc(v.title).slice(0, 82)}</span>
      <div class="ochips">${chips}</div>
      ${vClaimLine}
      <div class="vline"><span class="vv ${partialOf(v) ? "partial" : ""}">${v.verdicts.join(", ")}</span> — independently checked by <a href="https://sciencelive4all.org" target="_blank" rel="noopener">Science Live</a> ${vouts.length ? constellationLink(v.doi, vouts.length) : (v.cito_np ? `· <a href="${v.cito_np}" target="_blank" rel="noopener">verdict chain →</a>` : "")}</div>
      ${repl}
    </li>`;
  };
  const fieldHtml = field.length
    ? `<ul class="vlist">${field.map(matchCard).join("")}</ul>`
    : `<p class="vnone">No Science Live verdict matching your search yet — every paper on the left is an <b>open</b> replication opportunity.</p>`;
  const moreHtml = `<p class="vmore-stat">Verdicts are read <b>live</b> from the nanopub network — any signer, retraction- and supersession-filtered. <a href="methodology.html">How this works →</a></p>`;
  el("verified").innerHTML = fieldHtml + moreHtml;
}

// The replication-gap map: a status-composition bar over the ranked list (not a per-paper
// citation chart — the insight is how MUCH of the field has been checked, not who's most cited).
const GAP_ORDER = ["reproducible", "robust", "validated", "contested", "refuted", "needs", "dormant"];
// Distinguishable by hue AND lightness — the two "unchecked" states (needs/dormant) were
// previously near-identical light blue-greys; now a clear medium slate vs a light warm grey.
// Platform chart colormap: chart-1 pink, chart-3 green, chart-4 orange, destructive red,
// chart-5 slate + a light grey for the two "unchecked" states (which should recede).
// reproducible = brand pink · robust/validated (confirmed) = navy + brighter blue · contested =
// amber · refuted = red · the two unchecked states = DESATURATED neutral greys (no blue tint) so
// the navy/blue "checked" segments read clearly apart from them.
const GAP_COLOR = { reproducible: "#be2e78", robust: "#1f4d8f", validated: "#4a7bc0", contested: "#f59e09", refuted: "#ff6b6b", needs: "#9aa0a8", dormant: "#d7d9dc" };
const CHECKED = new Set(["robust", "validated", "contested", "refuted"]);
function renderChart() {
  const counts = {};
  for (const t of _targets) counts[t.statusKey] = (counts[t.statusKey] || 0) + 1;
  const total = _targets.length;
  if (!total) { el("gap").innerHTML = ""; return; }
  const present = GAP_ORDER.filter((k) => counts[k]);
  const checked = present.filter((k) => CHECKED.has(k)).reduce((s, k) => s + counts[k], 0);
  const seg = present.map((k) =>
    `<span class="gapseg" style="width:${(counts[k] / total * 100).toFixed(1)}%;background:${GAP_COLOR[k]}" title="${esc(STATUS[k].label)} — ${counts[k]}"></span>`).join("");
  const key = present.map((k) =>
    `<button class="gapkeyi" onclick="filterTargets('${k}')" title="filter the list to ${esc(STATUS[k].label)}"><i style="background:${GAP_COLOR[k]}"></i>${STATUS[k].label} <b>${counts[k]}</b></button>`).join("");
  const head = checked === 0
    ? `<b>0</b> of <b>${total}</b> independently checked — <span class="gapnone">the whole field is an open replication gap</span>`
    : `<b>${checked}</b> of <b>${total}</b> independently checked — <span class="gapsub">the other ${total - checked} are the replication gap</span>`;
  el("gap").innerHTML = `<div class="gaphead">${head}</div><div class="gapbar">${seg}</div><div class="gapkey">${key}</div>`;
}

async function run(topic, isExample) {
  topic = (topic || "").trim();
  if (!topic) return;
  el("go").disabled = true;
  el("status").textContent = `Scanning the OpenAIRE Graph for “${topic}” …`;
  try {
    const r = await radar(topic);
    el("results").hidden = false;
    renderTargets(r.targets);
    renderVerified(r.inField);
    renderChart();
    const note = isExample ? ` <i>— showing an example; search your own field above.</i>` : "";
    el("status").innerHTML = (r.inField.size
      ? `“${topic}”: ${r.targets.length} candidates · ${r.inField.size} already checked, matching your search (green) — the rest are open.`
      : `“${topic}”: ${r.targets.length} candidates · none matching your search have been checked yet — every one is an open replication opportunity.`) + note;
  } catch (e) {
    el("status").textContent = `Could not reach the OpenAIRE Graph (${e.message}). Try again or a shorter topic.`;
  } finally {
    el("go").disabled = false;
  }
}

// ---------- wire up ----------
el("chips").innerHTML = EXAMPLES.map((e) => `<button type="button" class="chip">${e}</button>`).join("");
el("chips").addEventListener("click", (e) => { if (e.target.classList.contains("chip")) { el("topic").value = e.target.textContent; run(e.target.textContent); } });
el("go").addEventListener("click", () => run(el("topic").value));
el("topic").addEventListener("keydown", (e) => { if (e.key === "Enter") run(el("topic").value); });

el("status").textContent = "Loading the Science Live verdict layer live from the nanopub network …";
Promise.all([loadVerdicts(), loadCurated()]).then(() => {
  // Default landing state: populate the radar with a sample field so first-time visitors see the
  // value immediately, not a blank page — but never clobber a user who has already started.
  if (!el("topic").value.trim() && el("results").hidden) {
    run("species distribution", true);
  } else {
    el("status").textContent = "Type a research field and hit Scan — or try an example above.";
  }
});

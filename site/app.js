// Replication Radar — live client-side engine over the OpenAIRE Graph API.
// Mirrors the Python package (replication_radar) so the web app and MCP agree.
// OpenAIRE allows CORS (*), so everything runs in the browser; no backend.

const API = "https://api.openaire.eu/graph/v1";
const CLASS_SCORE = { C1: 1, C2: 0.8, C3: 0.6, C4: 0.4, C5: 0.2 };
const EXAMPLES = ["species distribution", "marine heatwave", "bumble bee climate", "presence-only", "range maps scale"];

let VERDICTS = {};      // doi -> [verifications]
let VERIFIED = [];      // enriched: {doi, title, citations, verifications}
let CURATED = {};       // doi -> paper-resolved materials (the links OpenAIRE lacks; from the paper)
let chart = null;

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
  const r = matScore == null
    ? (0.35 * impactScore + 0.20 * momentum) / 0.55
    : (0.45 * matScore + 0.35 * impactScore + 0.20 * momentum);
  return Math.round(r * 100) / 100;
};
// Status taxonomy — "not replicated" is DISAMBIGUATED, not penalised.
const STATUS = {
  robust:       { label: "✅ Robustly validated", cls: "st-val",   tip: "multiple independent replications, all confirmed — a settled, reliable result" },
  validated:    { label: "✅ Validated",          cls: "st-val",   tip: "independently replicated and it held up" },
  contested:    { label: "⚠️ Contested",          cls: "st-con",   tip: "independent replications DISAGREE (some confirm, some contradict/partial) — worth re-checking" },
  refuted:      { label: "❌ Refuted",            cls: "st-con",   tip: "independent replication(s) contradicted it, none confirmed" },
  reproducible: { label: "🔁 Reproducible",       cls: "st-ready", tip: "original code/data are available, so it can be RE-RUN (reproduced). Note: replication ≠ reproduction — replication tests the same claim with DIFFERENT data/methods (FORRT)." },
  needs:        { label: "❔ Needs check",         cls: "st-needs", tip: "not yet replicated and OpenAIRE links no materials — unknown (not absent); resolve from the paper" },
  dormant:      { label: "💤 Dormant",            cls: "st-dorm",  tip: "no verdict, older, low momentum, no materials surfaced — likely dormant" },
};
// Agreement pattern across the independent replication verdicts — many-agree ≠ disagree.
const agreementOf = (doi) => {
  const vs = (VERDICTS[doi] || []).map((v) => v.verdict || "");
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
  if (t.status !== "VERIFIED") return t.readiness;
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
async function fetchByDoi(doi) {
  if (!doi) return null;
  try {
    const hits = (await (await fetch(`${API}/researchProducts?search=${encodeURIComponent(doi)}&pageSize=5`)).json()).results || [];
    return hits.find((h) => doiOf(h) === doi.toLowerCase()) || hits[0] || null;
  } catch (e) { return null; }
}

// OpenAIRE richness we already receive but were hiding
const subjectsOf = (rec, scheme) => [...new Set((rec.subjects || []).filter((s) => s.subject && s.subject.scheme === scheme).map((s) => s.subject.value))];
const cleanFos = (arr) => [...new Set(arr.map((v) => v.replace(/^\d+\s+/, "")).filter((v) => v && !/^\d+$/.test(v)))];
const oaOf = (rec) => rec.openAccessColor || ((rec.bestAccessRight || {}).label || "").toLowerCase();
const urlOf = (rec) => (rec.instances && rec.instances[0] && rec.instances[0].urls && rec.instances[0].urls[0]) || null;

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

async function sparqlCsv(query) {
  const r = await fetch(`${NP_SPARQL}?query=${encodeURIComponent(query)}`, { headers: { Accept: "text/csv" } });
  if (!r.ok) throw new Error(`nanopub-query ${r.status}`);
  const lines = (await r.text()).trim().split(/\r?\n/);
  const head = lines.shift().split(",");
  return lines.map((line) => {
    const cells = (line.match(/("([^"]*)"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));
    const o = {}; head.forEach((h, i) => (o[h] = cells[i])); return o;
  });
}

async function buildIndexFromNetwork() {
  const QA = `PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX slt: <https://w3id.org/sciencelive/o/terms/>
SELECT DISTINCT ?outcome ?status ?repo WHERE { GRAPH ?g { ?outcome ntpl:wasCreatedFromTemplate <${TPL_OUTCOME}> . } ?outcome np:hasAssertion ?oa . GRAPH ?oa { ?oc slt:hasValidationStatus ?s . OPTIONAL { ?oc slt:hasOutcomeRepository ?repo . } } BIND(STRAFTER(STR(?s),"/terms/") AS ?status) }`;
  const QB = `PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX cito: <http://purl.org/spar/cito/>
SELECT DISTINCT ?cito ?subj ?rel ?orig WHERE { GRAPH ?g { ?cito ntpl:wasCreatedFromTemplate <${TPL_CITO}> . } ?cito np:hasAssertion ?ca . GRAPH ?ca { ?subj ?rel ?orig . } FILTER(STRSTARTS(STR(?rel),STR(cito:))) FILTER(CONTAINS(STR(?orig),"doi.org/10.")) } LIMIT 3000`;
  const A = await sparqlCsv(QA);            // sequential: concurrent queries truncate the endpoint
  const B = await sparqlCsv(QB);
  const byHash = {};
  for (const r of B) {
    const h = npHash(r.subj);
    (byHash[h] = byHash[h] || []).push({ rel: (r.rel || "").replace(/.*cito\//, ""), orig: doiPart(r.orig), cito: r.cito });
  }
  const V = {};
  for (const o of A) {
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
      c.impl = impact(rec).impulseClass; c.year = yearOf(rec);
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

  const sw = await search(topic, "software", 25);   // field-level reusable tooling (shown once, below)

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

  // FIELD-LEVEL independent tooling — shown ONCE, not per paper (it isn't paper-specific).
  // Reuse-ranked, de-duplicated, and we drop repos merely named after the query.
  const slug = topic.toLowerCase().replace(/\s+/g, "-");
  const seenT = new Set();
  const tooling = sw
    .filter((s) => reuse(s) >= 2 && !(s.mainTitle || "").toLowerCase().includes(slug))
    .sort((a, b) => reuse(b) - reuse(a))
    .map((s) => ({ title: s.mainTitle || "", link: s.codeRepositoryUrl || urlOf(s), swh: swh(s), swhUrl: swhUrlOf(s) }))
    .filter((t) => { const k = t.link || t.title; if (!t.title || seenT.has(k)) return false; seenT.add(k); return true; })
    .slice(0, 5);

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
      year: c.year || null, impl: c.impl || null,
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

  return { topic, targets, inField, chartItems, tooling };
}

// ---------- rendering ----------
const el = (id) => document.getElementById(id);
const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const PER_PAGE = 10;
let _targets = [], _tpage = 0;

function targetRow(t) {
  const p = t.parts || {};
  const scoreTitle = t.status === "VERIFIED"
    ? `replication priority — already checked: impact modulated by agreement (${t.statusKey}). A robustly-validated result sinks (it's settled); a contested one rises (worth re-checking).`
    : `replication priority = 0.45·materials + 0.35·impact + 0.20·momentum  —  materials ${p.mat == null ? "unverified" : p.mat.toFixed(2)} · impact ${(p.impact || 0).toFixed(2)} · momentum ${(p.momentum || 0).toFixed(2)}`;
  const score = `<div class="score" title="${esc(scoreTitle)}"><span>${t.priority != null ? t.priority.toFixed(2) : "—"}</span><small>PRIORITY</small></div>`;
  const st = STATUS[t.statusKey] || STATUS.needs;
  const badge = `<span class="badge ${st.cls}" title="${esc(st.tip)}">${st.label}</span>`
    + (t.status === "VERIFIED" && t.verification ? `<span class="badge cls">${esc(t.verification)}</span>` : "")
    + (t.cls ? `<span class="badge cls" title="OpenAIRE BIP! impact class — C1 = top 0.01% most-cited globally, C5 = the rest">${t.cls}</span>` : "");
  // Materials badge ONLY when positively known. OpenAIRE rarely links code/data to a
  // paper, so 'unknown' is the norm in live search and would be noise on every row —
  // it's carried in the score breakdown tooltip, and resolved in the baked demo set.
  const matMeta = (t.mat && t.mat.state === "rocrate") ? `<span class="badge mok" title="RO-Crate research object — code + data + provenance bundled">RO-Crate ✓</span>`
    : (t.mat && t.mat.state === "code") ? `<span class="badge mok" title="code repository linked to this paper">code ✓</span>`
    : "";
  const meta = `<div class="t-meta">`
    + (t.year ? `<span class="badge yr">${t.year}</span>` : "")
    + (t.impl ? `<span class="badge imp" title="OpenAIRE BIP! impulse class — early citation momentum (C1 highest)">impulse ${t.impl}</span>` : "")
    + matMeta + `</div>`;
  const link = t.doi ? `<a href="https://doi.org/${t.doi}" target="_blank" rel="noopener">${t.doi}</a>` : "";
  const verdictLink = (t.status === "VERIFIED")
    ? `<div class="tverdict">independently checked by Science Live — <b>${esc(agreementOf(t.doi).why)}</b>${t.outcome_np ? ` · <a href="${t.outcome_np}" target="_blank" rel="noopener">replication outcome →</a>` : ""}</div>` : "";
  const resolvedNote = (t.mat && t.mat.resolved)
    ? `<div class="tresolved">↳ materials resolved from ${esc(t.mat.source || "the paper")} (not in OpenAIRE): <a href="${esc(t.mat.code || "")}" target="_blank" rel="noopener">code repo</a>${(t.mat.data && t.mat.data.length) ? ` · data: ${t.mat.data.map(esc).join(", ")}` : ""}</div>`
    : "";
  const fairNote = t.fair
    ? `<div class="tfair">FAIR software <b>${t.fair.score}/5</b> · ⭐ ${t.fair.stars}${t.fair.swh ? " · in Software Heritage" : ""}</div>`
    : "";
  return `<div class="target ${t.status === "VERIFIED" ? "verified" : ""}">
    ${score}
    <div class="t-main">${badge}<br><b>${esc(t.title)}</b>${meta}${verdictLink}${resolvedNote}${fairNote}</div>
    <div class="t-right">${t.citations.toLocaleString()} cites<br>${link}</div>
  </div>`;
}

function paintTargets() {
  const pages = Math.max(1, Math.ceil(_targets.length / PER_PAGE));
  if (_tpage >= pages) _tpage = pages - 1;
  const n = (k) => _targets.filter((t) => t.statusKey === k).length;
  el("tcount").textContent = `${n("reproducible")} reproducible · ${n("robust") + n("validated")} validated · ${n("contested") + n("refuted")} contested · ${_targets.length} candidates`;
  el("targets").innerHTML = _targets.slice(_tpage * PER_PAGE, _tpage * PER_PAGE + PER_PAGE).map(targetRow).join("");
  el("tpager").innerHTML = pages > 1
    ? `<button ${_tpage === 0 ? "disabled" : ""} onclick="pageTargets(-1)">← Prev</button><span>Page ${_tpage + 1} of ${pages}</span><button ${_tpage >= pages - 1 ? "disabled" : ""} onclick="pageTargets(1)">Next →</button>`
    : "";
}

function renderTargets(targets) { _targets = targets; _tpage = 0; paintTargets(); }
window.pageTargets = (d) => { _tpage += d; paintTargets(); el("targets").scrollIntoView({ behavior: "smooth", block: "start" }); };

function renderTooling(tooling) {
  if (!tooling || !tooling.length) { el("fieldtools").innerHTML = ""; return; }
  const items = tooling.map((t) =>
    `${t.link ? `<a href="${t.link}" target="_blank" rel="noopener">${esc(t.title).slice(0, 40)}</a>` : esc(t.title).slice(0, 40)}${t.swh ? ` <a href="${t.swhUrl || t.link}" target="_blank" rel="noopener" class="swh" title="archived in Software Heritage">⬡</a>` : ""}`
  ).join(" &nbsp;·&nbsp; ");
  el("fieldtools").innerHTML = `<b>Independent reusable tooling in this area</b> — engines for replicating by a different route, not tied to any one paper below: ${items}`;
}

function renderVerified(inField) {
  const field = VERIFIED.filter((v) => inField.has(v.doi)).sort((a, b) => b.citations - a.citations);
  const others = VERIFIED.filter((v) => !inField.has(v.doi)).sort((a, b) => b.citations - a.citations);
  el("vcount").textContent = field.length;

  const partialOf = (v) => v.verdicts.some((x) => /partial/i.test(x));

  // rich card: the trust edge shown as TWO OpenAIRE nodes (original + replication)
  const matchCard = (v) => {
    const chips = [
      v.oa ? `<span class="ochip oa">${esc(v.oa)} OA</span>` : "",
      ...(v.fos || []).map((f) => `<span class="ochip">${esc(f).slice(0, 24)}</span>`),
      ...(v.sdg || []).map((s) => `<span class="ochip sdg">${esc(s).slice(0, 22)}</span>`),
      `<span class="ochip cites">${v.citations.toLocaleString()} cites</span>`,
    ].join("");
    let repl = "";
    if (v.repl) {
      const f = v.repl.fair;
      const fairBadge = f
        ? `<div class="fairrecs"><b>FAIR software (${f.score}/5):</b> ${Object.entries(f.recs).map(([k, ok]) => `<span class="${ok ? "rok" : "rno"}">${ok ? "✓" : "✗"} ${k}</span>`).join("")}</div>
        <div class="fairline">⭐ ${f.stars} stars · ${f.forks} forks · ${f.swh ? `<span class="swhok">in Software Heritage</span>` : `<span class="swhno">not yet in Software Heritage</span>`}</div>`
        : "";
      const nodeHref = v.repl.code && v.repl.code.includes("github") ? v.repl.code : v.repl.url;
      repl = `<div class="vrepl">↳ replication is an OpenAIRE node: <a href="${nodeHref}" target="_blank" rel="noopener">${esc(v.repl.title).slice(0, 44) || v.repl.doi}</a> <span class="ochip type">${esc(v.repl.type)}</span></div>${fairBadge}`;
    } else if (v.repo_doi) {
      repl = `<div class="vrepl muted">↳ replication deposit: <a href="${v.repo_doi.startsWith("http") ? esc(v.repo_doi) : "https://doi.org/" + esc(v.repo_doi)}" target="_blank" rel="noopener">${esc(v.repo_doi)}</a> <span class="ochip wait">awaiting OpenAIRE harvest</span></div>`;
    }
    return `<li class="match">
      <span class="nodelabel">original paper · OpenAIRE</span>
      <span class="vt">${esc(v.title).slice(0, 82)}</span>
      <div class="ochips">${chips}</div>
      <div class="vline"><span class="vv ${partialOf(v) ? "partial" : ""}">${v.verdicts.join(", ")}</span> — independently checked by Science Live ${v.outcome_np ? `· <a href="${v.outcome_np}" target="_blank" rel="noopener">replication outcome →</a>` : (v.cito_np ? `· <a href="${v.cito_np}" target="_blank" rel="noopener">verdict chain →</a>` : "")}</div>
      ${repl}
    </li>`;
  };
  const fieldHtml = field.length
    ? `<ul class="vlist">${field.map(matchCard).join("")}</ul>`
    : `<p class="vnone">No Science Live verdict matching your search yet — every paper on the left is an <b>open</b> replication opportunity.</p>`;
  const moreHtml = `<p class="vmore-stat">Verdicts are drawn from the Science Live verification index bundled with this Radar. <a href="https://github.com/ScienceLiveHub/replication-radar/blob/main/src/replication_radar/data/verdicts.json" target="_blank" rel="noopener">browse the index →</a></p>`;
  el("verified").innerHTML = fieldHtml + moreHtml;
}

function renderChart(items) {
  const short = (s) => { s = s || ""; return s.length > 46 ? s.slice(0, 44) + "…" : s; };
  if (chart) chart.destroy();
  if (!items.length) { el("gap").parentElement.querySelector(".empty")?.remove(); return; }
  chart = new Chart(el("gap"), {
    type: "bar",
    data: {
      labels: items.map((i) => short(i.title)),
      datasets: [{
        data: items.map((i) => Math.max(1, i.citations || 0)),
        backgroundColor: items.map((i) => (i.status === "VERIFIED" ? "#11875a" : "#e6007e")),
        borderRadius: 5, barThickness: 16,
      }],
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      scales: {
        x: { type: "logarithmic", title: { display: true, text: "citation impact (count, log)" }, grid: { color: "#eef2f9" } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: (ti) => items[ti[0].dataIndex].title,   // full (untruncated) paper title on hover
          label: (c) => `${items[c.dataIndex].status === "VERIFIED" ? "✓ already checked" : "open — worth replicating"} · ${items[c.dataIndex].citations.toLocaleString()} cites`,
        } },
      },
    },
  });
}

async function run(topic) {
  topic = (topic || "").trim();
  if (!topic) return;
  el("go").disabled = true;
  el("status").textContent = `Scanning the OpenAIRE Graph for “${topic}” …`;
  try {
    const r = await radar(topic);
    el("results").hidden = false;
    renderTargets(r.targets);
    renderTooling(r.tooling);
    renderVerified(r.inField);
    renderChart(r.chartItems);
    el("status").textContent = r.inField.size
      ? `“${topic}”: ${r.targets.length} candidates · ${r.inField.size} already checked, matching your search (green) — the rest are open.`
      : `“${topic}”: ${r.targets.length} candidates · none matching your search have been checked yet — every one is an open replication opportunity.`;
  } catch (e) {
    el("status").textContent = `Could not reach the OpenAIRE Graph (${e.message}). Try again or a shorter topic.`;
  } finally {
    el("go").disabled = false;
  }
}

// ---------- wire up ----------
el("chips").innerHTML = EXAMPLES.map((e) => `<span class="chip">${e}</span>`).join("");
el("chips").addEventListener("click", (e) => { if (e.target.classList.contains("chip")) { el("topic").value = e.target.textContent; run(e.target.textContent); } });
el("go").addEventListener("click", () => run(el("topic").value));
el("topic").addEventListener("keydown", (e) => { if (e.key === "Enter") run(el("topic").value); });

el("status").textContent = "Loading the Science Live verdict layer live from the nanopub network …";
Promise.all([loadVerdicts(), loadCurated()]).then(() => { el("status").textContent = "Type a research field and hit Scan — or try an example above."; });

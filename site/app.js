// Replication Radar — live client-side engine over the OpenAIRE Graph API.
// Mirrors the Python package (replication_radar) so the web app and MCP agree.
// OpenAIRE allows CORS (*), so everything runs in the browser; no backend.

const API = "https://api.openaire.eu/graph/v1";
const CLASS_SCORE = { C1: 1, C2: 0.8, C3: 0.6, C4: 0.4, C5: 0.2 };
const EXAMPLES = ["species distribution", "marine heatwave", "bumble bee climate", "presence-only", "range maps scale"];

let VERDICTS = {};      // doi -> [verifications]
let VERIFIED = [];      // enriched: {doi, title, citations, verifications}
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

// ---------- author-agnostic verdict index, live from the nanopub network ----------
// Every FORRT Replication Outcome + CiTO on the network (any signer), joined on the
// trusty hash. No person filter — verification is author-agnostic.
const NP_SPARQL = "https://query.knowledgepixels.com/repo/full";
const TPL_OUTCOME = "https://w3id.org/np/RA2zljn0Nw9SadppOyxZoh-_Rxosslrq-vYG-p9SttnJE";
const TPL_CITO = "https://w3id.org/np/RA43F9EoOuzF0xoNUnCMNyFsfIqlsuWDdPHCnN0wCdCAw";
const VERDICT_RELS = new Set(["confirms", "qualifies", "disputes", "critiques", "extends", "supports", "refutes"]);
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
    const targets = verdictCitos.length ? verdictCitos : cs.filter((c) => !c.orig.startsWith("10.5281/"));
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
      oa: rec ? oaOf(rec) : "",
      fos: rec ? cleanFos(subjectsOf(rec, "FOS")).slice(0, 2) : [],
      sdg: rec ? subjectsOf(rec, "SDG").slice(0, 1) : [],
      repo: vs[0]?.repo, repo_doi: vs[0]?.repo_doi,
      cito_np: vs[0]?.cito_np, outcome_np: vs[0]?.outcome_np,
      repl: undefined,   // the replication's OpenAIRE node, resolved lazily for field matches
    };
  }));
}

// ---------- the radar ----------
function dedup(list) {
  const seen = new Set(), out = [];
  for (const r of list) { const k = doiOf(r) || r.mainTitle; if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

async function radar(topic) {
  let pubs = dedup(await search(topic, "publication", 30));
  const terms = topic.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  if (pubs.length < 5 && terms.length > 1) {
    const longest = terms.sort((a, b) => b.length - a.length)[0];
    pubs = dedup(pubs.concat(await search(longest, "publication", 30)));
  }
  const rank = (r) => [CLASS_SCORE[impact(r).influenceClass] || .2, CLASS_SCORE[impact(r).citationClass] || .2, (impact(r).citationCount || 0)];
  pubs.sort((a, b) => { const A = rank(a), B = rank(b); return (B[0] - A[0]) || (B[1] - A[1]) || (B[2] - A[2]); });

  const sw = await search(topic, "software", 25);
  const hasData = (await search(topic, "dataset", 5)).length > 0;

  const targets = pubs.slice(0, 10).map((p) => {
    const doi = doiOf(p), auth = surnames(p);
    const verified = doi && VERDICTS[doi];
    const tools = sw.filter((s) => independent(auth, surnames(s)) && reuse(s) >= 2).sort((a, b) => reuse(b) - reuse(a));
    const readiness = verified ? null : Math.round((0.5 * classScore(p) + 0.3 * (tools.length > 0) + 0.2 * hasData) * 100) / 100;
    return {
      title: p.mainTitle || "", doi, citations: impact(p).citationCount || 0,
      cls: impact(p).citationClass, infl: impact(p).influenceClass,
      status: verified ? "VERIFIED" : "OPEN", readiness,
      verification: verified ? [...new Set(VERDICTS[doi].map((v) => v.verdict))].join(", ") : null,
    };
  });
  targets.sort((a, b) => (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1) || (b.readiness || 0) - (a.readiness || 0));

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
      v.repl = rec ? { title: rec.mainTitle || "", type: rec.type || "output", oa: oaOf(rec), url: urlOf(rec) || `https://doi.org/${v.repo_doi}`, doi: v.repo_doi } : null;
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

  return { topic, targets, inField, chartItems, tooling };
}

// ---------- rendering ----------
const el = (id) => document.getElementById(id);
const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function renderTargets(targets) {
  el("tcount").textContent = `${targets.filter((t) => t.status === "OPEN").length} open · ${targets.filter((t) => t.status === "VERIFIED").length} verified`;
  el("targets").innerHTML = targets.map((t) => {
    const score = t.readiness != null ? `<div class="score"><span>${t.readiness.toFixed(2)}</span><small>READY</small></div>`
      : `<div class="score"><span>✓</span><small>DONE</small></div>`;
    const badge = t.status === "VERIFIED"
      ? `<span class="badge verified">VERIFIED</span><span class="badge cls">${t.verification}</span>`
      : `<span class="badge open">OPEN</span>${t.cls ? `<span class="badge cls" title="OpenAIRE BIP! impact class — C1 = top 0.01% most-cited globally, C5 = the rest">${t.cls}</span>` : ""}`;
    const link = t.doi ? `<a href="https://doi.org/${t.doi}" target="_blank" rel="noopener">${t.doi}</a>` : "";
    return `<div class="target ${t.status === "VERIFIED" ? "verified" : ""}">
      ${score}
      <div class="t-main">${badge}<br><b>${esc(t.title)}</b></div>
      <div class="t-right">${t.citations.toLocaleString()} cites<br>${link}</div>
    </div>`;
  }).join("");
}

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
    const repl = v.repl
      ? `<div class="vrepl">↳ replication is an OpenAIRE node: <a href="${v.repl.url}" target="_blank" rel="noopener">${esc(v.repl.title).slice(0, 44) || v.repl.doi}</a> <span class="ochip type">${esc(v.repl.type)}</span></div>`
      : (v.repo_doi
        ? `<div class="vrepl muted">↳ replication deposit: <a href="${v.repo_doi.startsWith("http") ? esc(v.repo_doi) : "https://doi.org/" + esc(v.repo_doi)}" target="_blank" rel="noopener">${esc(v.repo_doi)}</a> <span class="ochip wait">awaiting OpenAIRE harvest</span></div>`
        : "");
    return `<li class="match">
      <span class="nodelabel">original paper · OpenAIRE</span>
      <span class="vt">${esc(v.title).slice(0, 82)}</span>
      <div class="ochips">${chips}</div>
      <div class="vline"><span class="vv ${partialOf(v) ? "partial" : ""}">${v.verdicts.join(", ")}</span> — independently checked by Science Live ${v.cito_np ? `· <a href="${v.cito_np}" target="_blank" rel="noopener">verdict chain →</a>` : ""}</div>
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
loadVerdicts().then(() => { el("status").textContent = "Type a research field and hit Scan — or try an example above."; });

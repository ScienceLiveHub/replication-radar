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

// ---------- load + enrich the verdict index ----------
async function loadVerdicts() {
  VERDICTS = (await (await fetch("verdicts.json")).json()).verifications || {};
  VERIFIED = await Promise.all(Object.entries(VERDICTS).map(async ([doi, vs]) => {
    let title = doi, citations = 0;
    try {
      const hits = await search(doi, "publication", 1);
      const rec = (hits || []).find((h) => doiOf(h) === doi) || hits[0];
      if (rec) { title = rec.mainTitle || doi; citations = impact(rec).citationCount || 0; }
    } catch (e) { /* keep doi as title */ }
    const verdicts = [...new Set(vs.map((v) => v.verdict))];
    return { doi, title, citations, verdicts, cito_np: vs[0]?.cito_np };
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
  const terms = topic.split(/\s+/).filter((t) => t.length > 3);
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
      tool: tools[0] ? { title: tools[0].mainTitle, swh: swh(tools[0]) } : null,
    };
  });
  targets.sort((a, b) => (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1) || (b.readiness || 0) - (a.readiness || 0));

  // verified-in-field: token overlap with the topic (mirrors the Python guarantee)
  const tset = new Set(terms.map((t) => t.toLowerCase()));
  const inField = new Set(VERIFIED.filter((v) => v.title.toLowerCase().split(/\W+/).some((w) => tset.has(w))).map((v) => v.doi));
  return { topic, targets, inField };
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
      : `<span class="badge open">OPEN</span>${t.cls ? `<span class="badge cls">${t.cls}</span>` : ""}`;
    const tool = t.tool ? `<div class="tool">independent tooling: ${esc(t.tool.title).slice(0, 54)}${t.tool.swh ? ' <span class="swh">· SWH-archived</span>' : ""}</div>` : "";
    const link = t.doi ? `<a href="https://doi.org/${t.doi}" target="_blank" rel="noopener">${t.doi}</a>` : "";
    return `<div class="target ${t.status === "VERIFIED" ? "verified" : ""}">
      ${score}
      <div class="t-main">${badge}<br><b>${esc(t.title).slice(0, 96)}</b>${tool}</div>
      <div class="t-right">${t.citations.toLocaleString()} cites<br>${link}</div>
    </div>`;
  }).join("");
}

function renderVerified(inField) {
  el("vcount").textContent = VERIFIED.length;
  const sorted = [...VERIFIED].sort((a, b) => (inField.has(b.doi) - inField.has(a.doi)) || (b.citations - a.citations));
  el("verified").innerHTML = sorted.map((v) => {
    const partial = v.verdicts.some((x) => /partial/i.test(x));
    return `<li class="${inField.has(v.doi) ? "match" : ""}">
      <span class="vt">${esc(v.title).slice(0, 70)}</span>
      <span class="vv ${partial ? "partial" : ""}">${v.verdicts.join(", ")}</span>
      · ${v.citations.toLocaleString()} cites
      ${v.cito_np ? `· <a href="${v.cito_np}" target="_blank" rel="noopener">verdict nanopub →</a>` : ""}
    </li>`;
  }).join("");
}

function renderChart(targets) {
  const pts = (st, color) => ({
    label: st === "OPEN" ? "Open — worth replicating" : "Already checked",
    data: targets.filter((t) => t.status === st).map((t) => ({
      x: Math.max(1, t.citations), y: t.readiness != null ? t.readiness : 1, title: t.title,
    })),
    backgroundColor: color, pointRadius: 7, pointHoverRadius: 9,
  });
  if (chart) chart.destroy();
  chart = new Chart(el("gap"), {
    type: "scatter",
    data: { datasets: [pts("OPEN", "#e6007e"), pts("VERIFIED", "#11875a")] },
    options: {
      scales: {
        x: { type: "logarithmic", title: { display: true, text: "citation impact (count, log)" } },
        y: { title: { display: true, text: "replication-readiness" }, min: 0, max: 1.05 },
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (c) => (c.raw.title || "").slice(0, 60) } },
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
    renderVerified(r.inField);
    renderChart(r.targets);
    const v = r.targets.filter((t) => t.status === "VERIFIED").length;
    el("status").textContent = `“${topic}”: ${r.targets.length} candidates · ${v} already checked · ${r.inField.size} verified replication(s) in this field.`;
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

el("status").textContent = "Loading the Science Live verdict overlay …";
loadVerdicts().then(() => { el("status").textContent = "Type a research field and hit Scan — or try an example above."; });

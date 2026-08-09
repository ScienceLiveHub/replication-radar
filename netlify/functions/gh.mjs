// Token-backed GitHub API proxy (Netlify Function).
//
// The browser calls  /.netlify/functions/gh?path=<github-api-path>  and we forward it to
// api.github.com with a token read from the GITHUB_TOKEN environment variable. This lifts the
// keyless 60 req/hr limit to 5000/hr for the FAIR-software + RSE-practices assessment, while the
// token stays server-side — it never reaches the static site or the browser.
//
// Set GITHUB_TOKEN in Netlify → Site configuration → Environment variables (a read-only,
// public-repos token is enough). Without it, the proxy still works but at the keyless limit.

const ALLOWED = /^(repos|search|rate_limit)(\/|$|\?)/;   // read-only GitHub API paths we actually use

export default async (req) => {
  const path = new URL(req.url).searchParams.get("path") || "";
  if (!ALLOWED.test(path)) {
    return json({ message: "path not allowed" }, 400);
  }
  const headers = {
    "User-Agent": "replication-radar",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const gh = await fetch(`https://api.github.com/${path}`, { headers });
    const body = await gh.text();
    return new Response(body, {
      status: gh.status,
      headers: {
        "content-type": gh.headers.get("content-type") || "application/json",
        // Cache repo metadata at the edge for a few minutes — repeat assessments become free.
        "cache-control": "public, max-age=600",
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    return json({ message: `proxy error: ${e.message}` }, 502);
  }
};

const json = (obj, status) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

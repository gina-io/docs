// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashIp(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Vote API ──────────────────────────────────────────────────────────────────

async function getCounts(db, page) {
  const row = await db.prepare(
    `SELECT
       SUM(CASE WHEN direction = 'up'   THEN 1 ELSE 0 END) AS up,
       SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) AS down
     FROM votes WHERE page = ?`,
  ).bind(page).first();
  return { up: row?.up ?? 0, down: row?.down ?? 0 };
}

async function handleVote(request, env) {
  const url    = new URL(request.url);
  const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIp(ip);

  // ── GET /api/vote?page=<slug> ─────────────────────────────────────────────
  if (request.method === 'GET') {
    const page = url.searchParams.get('page');
    if (!page) return jsonResponse({ error: 'missing page' }, 400);

    const [counts, userRow] = await Promise.all([
      getCounts(env.DB, page),
      env.DB.prepare(
        'SELECT direction FROM votes WHERE page = ? AND ip_hash = ?',
      ).bind(page, ipHash).first(),
    ]);

    return jsonResponse({ ...counts, userVote: userRow?.direction ?? null });
  }

  // ── POST /api/vote ────────────────────────────────────────────────────────
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid json' }, 400); }

    const { page, dir } = body ?? {};
    if (!page || !['up', 'down'].includes(dir)) {
      return jsonResponse({ error: 'invalid input' }, 400);
    }

    // One vote per IP per page — return existing vote silently if already cast
    const existing = await env.DB.prepare(
      'SELECT direction FROM votes WHERE page = ? AND ip_hash = ?',
    ).bind(page, ipHash).first();

    if (existing) {
      const counts = await getCounts(env.DB, page);
      return jsonResponse({ ...counts, userVote: existing.direction });
    }

    await env.DB.prepare(
      'INSERT INTO votes (page, direction, ip_hash, voted_at) VALUES (?, ?, ?, ?)',
    ).bind(page, dir, ipHash, Date.now()).run();

    const counts = await getCounts(env.DB, page);
    return jsonResponse({ ...counts, userVote: dir });
  }

  return jsonResponse({ error: 'method not allowed' }, 405);
}

// ── Clean URL proxy ──────────────────────────────────────────────────────────
// Proxy a clean URL (e.g. /roadmap, /tutorials) to Vercel, rewrite the
// canonical to the clean path, and inject a pre-hydration script that
// temporarily sets the URL to /docs/<slug> so Docusaurus's client-side
// router recognises the route, then restores the clean URL after hydration.

async function proxyCleanUrl(request, cleanPath, docsPath) {
  const url  = new URL(request.url);
  const response = await fetch(
    'https://gina-io-docs.vercel.app' + docsPath + url.search,
    { method: request.method, headers: request.headers, body: request.body },
  );
  return new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', 'https://gina.io' + cleanPath);
      },
    })
    .on('head', {
      element(el) {
        el.prepend(
          '<script>' +
          'var __rS=history.replaceState.bind(history);' +
          '__rS(null,"","/docs' + docsPath + '"+location.search+location.hash);' +
          'window.addEventListener("load",function(){' +
          '(function p(n){' +
          'if(document.querySelector("main article"))' +
          '__rS(null,"","' + cleanPath + '"+location.search+location.hash);' +
          'else if(n<50)setTimeout(p,100,n+1)' +
          '})(0)' +
          '})' +
          '</script>',
          { html: true },
        );
      },
    })
    .transform(response);
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Vote API — handled directly, never proxied to Vercel
    if (url.pathname === '/api/vote') {
      return handleVote(request, env);
    }

    // Clean URL proxies — served from Vercel with Docusaurus hydration bridge.
    // /roadmap   → Vercel /roadmap   (Docusaurus route: /docs/roadmap)
    // /tutorials → Vercel /tutorials (Docusaurus route: /docs/tutorials)
    // /swig/*    → Vercel /swig/*    (Docusaurus route: /docs/swig/*)
    if (url.pathname === '/roadmap') {
      return proxyCleanUrl(request, '/roadmap', '/roadmap');
    }
    if (url.pathname === '/tutorials') {
      return proxyCleanUrl(request, '/tutorials', '/tutorials');
    }
    if (url.pathname === '/swig' || url.pathname.startsWith('/swig/')) {
      return proxyCleanUrl(request, url.pathname, url.pathname);
    }

    // JSON Schema files — served from docs site static/schema/
    if (url.pathname.startsWith('/schema/')) {
      return fetch('https://gina-io-docs.vercel.app' + url.pathname + url.search, {
        method:  request.method,
        headers: request.headers,
        body:    request.body,
      });
    }

    // 301 redirects for category index pages whose URL was slugged to drop the
    // /category/ prefix. Preserves SEO equity for any indexed backlinks.
    const CATEGORY_REDIRECTS = {
      '/docs/category/getting-started': '/docs/getting-started',
      '/docs/category/concepts':        '/docs/concepts',
      '/docs/category/guides':          '/docs/guides',
      '/docs/category/cli':             '/docs/cli',
    };
    const trimmed = url.pathname.replace(/\/$/, '');
    if (CATEGORY_REDIRECTS[trimmed]) {
      return Response.redirect('https://gina.io' + CATEGORY_REDIRECTS[trimmed] + url.search, 301);
    }

    // Strip /docs prefix and proxy to Vercel.
    // Docusaurus baseUrl '/docs/' embeds '/docs/' into all asset/page paths, so
    // the browser always requests gina.io/docs/*, Worker strips to /*, Vercel
    // serves from build/ root where the actual files live.
    if (url.pathname === '/docs' || url.pathname.startsWith('/docs/')) {
      const stripped  = url.pathname === '/docs' ? '/' : url.pathname.slice('/docs'.length);
      const targetUrl = 'https://gina-io-docs.vercel.app' + stripped + url.search;
      return fetch(targetUrl, {
        method:  request.method,
        headers: request.headers,
        body:    request.body,
      });
    }

    // Pass everything else through to the origin
    return fetch(request);
  },
};

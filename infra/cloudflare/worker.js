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
          'var __done=false;' +
          'function __restore(){__done=true;__rS(null,"","' + cleanPath + '"+location.search+location.hash)}' +
          'function __try(n){' +
          'if(__done)return;' +
          'if(document.querySelector("main article"))__restore();' +
          'else if(n<50)setTimeout(__try,100,n+1);' +
          'else __restore()' +
          '}' +
          'window.addEventListener("DOMContentLoaded",function(){__try(0)});' +
          'window.addEventListener("load",function(){__try(0)});' +
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

    // 301 redirects for the /swig/*, /nunjucks, and short-lived /views/*
    // URLs that were re-homed under /templating/* (2026-04-23 Templating
    // umbrella, with Twig promoted to peer level under Swig/Nunjucks).
    // Edge 301s preserve SEO equity before any Vercel request happens.
    // Paired with meta-refresh redirects in docusaurus.config.js as a
    // fallback for direct-to-Vercel access that skips this Worker.
    const TEMPLATING_REDIRECTS = {
      // Original /swig/* URLs.
      '/docs/swig':                      '/docs/templating/swig',
      '/docs/swig/getting-started':      '/docs/templating/swig/getting-started',
      '/docs/swig/syntax':               '/docs/templating/swig/syntax',
      '/docs/swig/tags':                 '/docs/templating/swig/tags',
      '/docs/swig/filters':              '/docs/templating/swig/filters',
      '/docs/swig/loaders':              '/docs/templating/swig/loaders',
      '/docs/swig/extending':            '/docs/templating/swig/extending',
      '/docs/swig/api':                  '/docs/templating/swig/api',
      '/docs/swig/cli':                  '/docs/templating/swig/cli',
      '/docs/swig/browser':              '/docs/templating/swig/browser',
      '/docs/swig/migration':            '/docs/templating/swig/migration',
      '/docs/swig/security':             '/docs/templating/swig/security',
      // Twig promoted out of /swig/twig/ to peer level under /templating/twig/.
      '/docs/swig/twig':                 '/docs/templating/twig',
      '/docs/swig/twig/migration':       '/docs/templating/twig/migration',
      '/docs/swig/twig/parity':          '/docs/templating/twig/parity',
      '/docs/swig/twig/non-goals':       '/docs/templating/twig/non-goals',
      // Original /nunjucks URL.
      '/docs/nunjucks':                  '/docs/templating/nunjucks',
      // Short-lived /views/* URLs (interim Views umbrella, ~1h live).
      '/docs/views':                     '/docs/templating',
      '/docs/views/swig':                '/docs/templating/swig',
      '/docs/views/swig/getting-started':'/docs/templating/swig/getting-started',
      '/docs/views/swig/syntax':         '/docs/templating/swig/syntax',
      '/docs/views/swig/tags':           '/docs/templating/swig/tags',
      '/docs/views/swig/filters':        '/docs/templating/swig/filters',
      '/docs/views/swig/loaders':        '/docs/templating/swig/loaders',
      '/docs/views/swig/extending':      '/docs/templating/swig/extending',
      '/docs/views/swig/api':            '/docs/templating/swig/api',
      '/docs/views/swig/cli':            '/docs/templating/swig/cli',
      '/docs/views/swig/browser':        '/docs/templating/swig/browser',
      '/docs/views/swig/migration':      '/docs/templating/swig/migration',
      '/docs/views/swig/security':       '/docs/templating/swig/security',
      '/docs/views/swig/twig':           '/docs/templating/twig',
      '/docs/views/swig/twig/migration': '/docs/templating/twig/migration',
      '/docs/views/swig/twig/parity':    '/docs/templating/twig/parity',
      '/docs/views/swig/twig/non-goals': '/docs/templating/twig/non-goals',
      '/docs/views/nunjucks':            '/docs/templating/nunjucks',
    };
    if (TEMPLATING_REDIRECTS[trimmed]) {
      return Response.redirect('https://gina.io' + TEMPLATING_REDIRECTS[trimmed] + url.search, 301);
    }

    // 301 redirects for CLI reference pages served under id-form URLs. Each
    // `docs/cli/<file>.md` has `id: cli-<file>` frontmatter which Docusaurus
    // uses as the URL slug, so the canonical URL is `/docs/cli/cli-<file>`.
    // External references that assume the filename-form (`/docs/cli/<file>`)
    // would otherwise 404. Paired with meta-refresh redirects in
    // docusaurus.config.js as a fallback for direct-to-Vercel access.
    // Tracked at https://github.com/gina-io/docs/issues/11.
    const CLI_REDIRECTS = {
      '/docs/cli/bundle':    '/docs/cli/cli-bundle',
      '/docs/cli/cache':     '/docs/cli/cli-cache',
      '/docs/cli/connector': '/docs/cli/cli-connector',
      '/docs/cli/env':       '/docs/cli/cli-env',
      '/docs/cli/framework': '/docs/cli/cli-framework',
      '/docs/cli/port':      '/docs/cli/cli-port',
      '/docs/cli/project':   '/docs/cli/cli-project',
      '/docs/cli/protocol':  '/docs/cli/cli-protocol',
      '/docs/cli/scope':     '/docs/cli/cli-scope',
      '/docs/cli/service':   '/docs/cli/cli-service',
      '/docs/cli/view':      '/docs/cli/cli-view',
    };
    if (CLI_REDIRECTS[trimmed]) {
      return Response.redirect('https://gina.io' + CLI_REDIRECTS[trimmed] + url.search, 301);
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

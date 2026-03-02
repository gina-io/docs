export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = 'https://gina-io-docs.vercel.app';

    // Strip /docs prefix and proxy to Vercel.
    // Docusaurus baseUrl '/docs/' embeds '/docs/' into all asset/page paths, so
    // the browser always requests gina.io/docs/*, Worker strips to /*, Vercel
    // serves from build/ root where the actual files live.
    if (url.pathname === '/docs' || url.pathname.startsWith('/docs/')) {
      const stripped = url.pathname === '/docs' ? '/' : url.pathname.slice('/docs'.length);
      const targetUrl = target + stripped + url.search;
      return fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }

    // Pass everything else through to the origin
    return fetch(request);
  },
};

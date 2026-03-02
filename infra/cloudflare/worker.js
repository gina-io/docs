export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = 'https://gina-io-docs.vercel.app';

    // Strip /docs prefix and proxy to Vercel deployment
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

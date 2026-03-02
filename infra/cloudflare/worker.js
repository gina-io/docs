export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = 'https://gina-io-docs.vercel.app';

    // Proxy /docs* to Vercel deployment (no stripping — baseUrl: '/docs/' in Docusaurus)
    if (url.pathname === '/docs' || url.pathname.startsWith('/docs/')) {
      const targetUrl = target + url.pathname + url.search;
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

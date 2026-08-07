import React, { useEffect, useState, useRef, useCallback } from 'react';

// ── Inline SVG assets (Lucide icons, 24×24 viewBox, stroke="currentColor") ──

const SVG_PANEL_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M16 15l-3-3 3-3"/></svg>`;
const SVG_PANEL_OPEN  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M13 9l3 3-3 3"/></svg>`;

// Section icons matched against the lowercase label text of top-level nav items
const NAV_ICONS = {
  // intro page — Docusaurus uses the first h1 as sidebar label when no sidebar_label is set
  'what is gina?': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  'intro': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  'getting started': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  'concepts': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.1.7 3 .5.9 1.1 1.6 1.3 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  'guides': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  // cli _category_.json label is "CLI Reference"
  'cli reference': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  // reference _category_.json label is "Configuration Reference"
  'configuration reference': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg>`,
  // api _category_.json label is "API Reference"
  'api reference': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  'api': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  'globals': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>`,
  'roadmap': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
  'migration guide': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>`,
  'security': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  // tutorials sidebar — landing page + individual pages
  'tutorials': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c6 3 10 0 12-2v-3"/></svg>`,
  'notes api': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/><path d="M16 13h-2"/></svg>`,
  'link shortener': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  // swig sidebar — top-level page labels
  'overview': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  'template syntax': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-4a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>`,
  'tags': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  'filters': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  'loaders': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  // templating section — "Async Loaders" page (cloud-download: templates fetched from a remote/async backend)
  'async loaders': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 17l4 4 4-4"/><path d="M12 12v9"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>`,
  'extending swig': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>`,
  'cli': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  'browser usage': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  // twig top-level category — Lucide "sprout" (literal twig / young branch)
  'twig': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>`,
  // swig top-level category — Lucide "feather"
  'swig': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`,
  // nunjucks top-level category — Lucide "leaf" (distinct from swig feather)
  'nunjucks': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.3c1.7 6.1.4 11.7-2.5 14.4-2.5 2.3-6 3.3-9 2.3"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  // jinja2 top-level category — Lucide "clover" (distinct from twig sprout / nunjucks leaf / swig feather)
  'jinja2': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.17 7.83 2 22"/><path d="M4.02 12a2.827 2.827 0 1 1 3.81-4.17A2.827 2.827 0 1 1 12 4.02a2.827 2.827 0 1 1 4.17 3.81A2.827 2.827 0 1 1 19.98 12a2.827 2.827 0 1 1-3.81 4.17A2.827 2.827 0 1 1 12 19.98a2.827 2.827 0 1 1-4.17-3.81A1 1 0 1 1 4 12"/><path d="m7.83 7.83 8.34 8.34"/></svg>`,
  // django top-level category — Lucide "flower-2" (distinct from twig sprout / nunjucks leaf / swig feather / jinja2 clover)
  'django': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/></svg>`,
  // data section — store pages carry their vendor marks (Simple Icons, CC0-licensed icon data; trademarks belong to their owners), solid fill on currentColor so theme/hover/active styling applies like every other entry
  'couchbase orm': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.111 14.104a1.467 1.458 0 0 1-1.235 1.503c-1.422.244-4.385.398-6.875.398s-5.454-.15-6.877-.398c-.814-.14-1.235-.787-1.235-1.503V9.417a1.57 1.56 0 0 1 1.235-1.505 15.72 15.619 0 0 1 2.156-.14.537.533 0 0 1 .523.543v3.303c1.463 0 2.727-.086 4.201-.086 1.474 0 2.727.086 4.196.086V8.342a.535.532 0 0 1 .494-.569h.027a15.995 15.891 0 0 1 2.156.14 1.57 1.56 0 0 1 1.234 1.504zM12.001 0C5.373 0 0 5.374 0 12c0 6.628 5.373 12 12 12 6.628 0 12-5.372 12-12 0-6.626-5.373-12-12-12z"/></svg>`,
  'scylladb orm': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.992 2.435C17.229.868 14.75 0 12.004 0 9.259 0 6.779.868 5.017 2.435 3.246 4.012 2.272 6.244 2.272 8.706c0 2.373 2.382 13.567 2.479 14.045.169.735.815 1.24 1.541 1.24.089 0 .168-.009.257-.018.151-.026.292-.07.434-.141.301.133.638.186.965.124.248-.045.479-.151.673-.31a1.579 1.579 0 0 0 1.63.203c.23-.106.425-.265.576-.451a1.596 1.596 0 0 0 1.231.602 1.596 1.596 0 0 0 .823-.239 1.695 1.695 0 0 0 .408-.354c.248.301.611.513 1 .566.39.062.797-.035 1.116-.256.036-.018.062-.045.089-.071.186.15.407.257.637.301.169.035.337.044.505.026.151-.017.292-.053.434-.115.124.053.248.089.381.115a1.58 1.58 0 0 0 1.798-1.222c.097-.478 2.479-11.663 2.479-14.045.009-2.462-.965-4.685-2.736-6.271Zm-.186 20.219c-.124.558-.655.93-1.222.868a1.59 1.59 0 0 0 .443-.833l.07-.425.275-1.691c.088-.567.177-1.134.248-1.701a.156.156 0 0 0-.115-.168.16.16 0 0 0-.186.115c-.124.558-.239 1.125-.354 1.683l-.328 1.683-.08.416c-.026.115-.071.23-.124.327a.947.947 0 0 1-.221.275 1.05 1.05 0 0 1-.292.195 1.512 1.512 0 0 1-.337.097 1.142 1.142 0 0 1-.77-.195c.106-.159.194-.336.239-.531.017-.044.017-.097.026-.142 0-.026.009-.053.009-.071l.009-.062.08-.743.097-.992c.062-.665.124-1.329.168-1.993a.147.147 0 0 0-.133-.159.164.164 0 0 0-.177.132c-.097.656-.186 1.32-.274 1.975l-.186 1.488c-.018.16-.036.346-.071.461a1.101 1.101 0 0 1-.469.655 1.104 1.104 0 0 1-.78.168 1.107 1.107 0 0 1-.814-.566c.026-.071.044-.142.061-.204.036-.142.036-.292.036-.408l.009-.735c.009-.487.017-.983.017-1.47a40.02 40.02 0 0 0 0-1.47c0-.079-.062-.15-.141-.15a.145.145 0 0 0-.16.141c-.026.487-.062.983-.079 1.47-.027.488-.045.983-.071 1.471l-.036.735c0 .062 0 .124-.008.177 0 .053-.009.097-.018.15-.027.098-.053.195-.106.284a1.11 1.11 0 0 1-.992.593.893.893 0 0 1-.301-.044c-.098-.027-.186-.071-.275-.115a1.154 1.154 0 0 1-.416-.434 1.082 1.082 0 0 1-.106-.284c-.027-.097-.027-.195-.036-.327l-.035-.735c-.018-.488-.045-.983-.071-1.471l-.08-1.47a.154.154 0 0 0-.15-.141.15.15 0 0 0-.151.15v1.47c0 .487.009.983.018 1.47l.009.735c0 .116.008.266.035.408.018.071.035.142.062.212a1.169 1.169 0 0 1-.523.47 1.109 1.109 0 0 1-1.337-.346 1.002 1.002 0 0 1-.177-.327 1.392 1.392 0 0 1-.044-.186c-.009-.027-.009-.071-.018-.107l-.018-.115-.23-1.797c-.08-.603-.159-1.205-.257-1.798-.009-.08-.079-.133-.159-.133-.089.009-.151.08-.142.168.044.602.098 1.205.151 1.807l.177 1.806.009.116c0 .035.009.07.017.124.009.088.036.177.062.256.045.151.124.293.213.426a1.129 1.129 0 0 1-1.125.097 1.154 1.154 0 0 1-.629-.806l-.079-.416-.328-1.674c-.115-.558-.23-1.116-.354-1.674-.018-.08-.089-.133-.168-.115-.08.009-.142.089-.133.177.079.567.159 1.125.248 1.692l.274 1.682.071.425c.027.169.089.328.16.47.07.133.159.257.274.363-.018 0-.027.009-.044.009a1.126 1.126 0 0 1-1.276-.859c-.026-.115-2.47-11.619-2.47-13.949 0-2.338.921-4.437 2.586-5.933C6.956 1.284 9.33.461 11.96.461s5.004.823 6.678 2.32c1.673 1.488 2.586 3.595 2.586 5.933.053 2.33-2.392 13.834-2.418 13.94Zm-4.517-11.451a1.322 1.322 0 0 0-.726-.407h-.035a.235.235 0 0 0-.248.212.235.235 0 0 0 .212.248.824.824 0 0 1 .354.106 11.147 11.147 0 0 1-3.701 1.621 11.15 11.15 0 0 1-4.198.186.193.193 0 1 0-.062.381c.212.035.434.062.646.08 0 .008 0 .017.009.026.186.558.664 1.302 1.284 1.302a.78.78 0 0 0 .195-.027c.23-.053.611-.292.611-1.248 0-.018-.009-.027-.009-.045a12.213 12.213 0 0 0 1.612-.248c.053-.008.106-.026.151-.035.124.496.31 1.116.93 1.116.256 0 .531-.142.744-.381.177-.204.46-.664.371-1.435a11.47 11.47 0 0 0 1.745-.974.834.834 0 0 1 .115.292c.018.08.089.133.169.124a.15.15 0 0 0 .141-.168 1.184 1.184 0 0 0-.31-.726Zm-6.11 2.489c0 .442-.107.761-.266.797-.346.088-.7-.426-.868-.815.381.018.753.018 1.134 0 .008.009 0 .018 0 .018Zm3.551.106c-.115.133-.266.221-.39.221-.212 0-.336-.186-.487-.77.39-.115.779-.248 1.151-.399.018.381-.079.718-.274.948Zm-2.878-1.515a4.471 4.471 0 1 1 4.472-4.472 4.476 4.476 0 0 1-4.472 4.472Zm0-8.475A4.014 4.014 0 0 0 4.84 7.82a4.014 4.014 0 0 0 4.012 4.012 4.013 4.013 0 0 0 4.011-4.012 4.02 4.02 0 0 0-4.011-4.012Zm.876 1.231c-.735.151-.876 1.754-.442 2.196.292.293.876.381.876.585 0 .204-.584.292-.876.584-.443.443-.293 2.046.442 2.197.868.177 2.197-.877 2.197-2.781 0-1.904-1.329-2.958-2.197-2.781Z"/></svg>`,
  'mongodb orm': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z"/></svg>`,
  'duckdb analytics': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.363 0 0 5.363 0 12s5.363 12 12 12 12-5.363 12-12S18.637 0 12 0zM9.502 7.03a4.974 4.974 0 0 1 4.97 4.97 4.974 4.974 0 0 1-4.97 4.97A4.974 4.974 0 0 1 4.532 12a4.974 4.974 0 0 1 4.97-4.97zm6.563 3.183h2.351c.98 0 1.787.782 1.787 1.762s-.807 1.789-1.787 1.789h-2.351v-3.551z"/></svg>`,
  'mysql orm': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.405 5.501c-.115 0-.193.014-.274.033v.013h.014c.054.104.146.18.214.273.054.107.1.214.154.32l.014-.015c.094-.066.14-.172.14-.333-.04-.047-.046-.094-.08-.14-.04-.067-.126-.1-.18-.153zM5.77 18.695h-.927a50.854 50.854 0 00-.27-4.41h-.008l-1.41 4.41H2.45l-1.4-4.41h-.01a72.892 72.892 0 00-.195 4.41H0c.055-1.966.192-3.81.41-5.53h1.15l1.335 4.064h.008l1.347-4.064h1.095c.242 2.015.384 3.86.428 5.53zm4.017-4.08c-.378 2.045-.876 3.533-1.492 4.46-.482.716-1.01 1.073-1.583 1.073-.153 0-.34-.046-.566-.138v-.494c.11.017.24.026.386.026.268 0 .483-.075.647-.222.197-.18.295-.382.295-.605 0-.155-.077-.47-.23-.944L6.23 14.615h.91l.727 2.36c.164.536.233.91.205 1.123.4-1.064.678-2.227.835-3.483zm12.325 4.08h-2.63v-5.53h.885v4.85h1.745zm-3.32.135l-1.016-.5c.09-.076.177-.158.255-.25.433-.506.648-1.258.648-2.253 0-1.83-.718-2.746-2.155-2.746-.704 0-1.254.232-1.65.697-.43.508-.646 1.256-.646 2.245 0 .972.19 1.686.574 2.14.35.41.877.615 1.583.615.264 0 .506-.033.725-.098l1.325.772.36-.622zM15.5 17.588c-.225-.36-.337-.94-.337-1.736 0-1.393.424-2.09 1.27-2.09.443 0 .77.167.977.5.224.362.336.936.336 1.723 0 1.404-.424 2.108-1.27 2.108-.445 0-.77-.167-.978-.5zm-1.658-.425c0 .47-.172.856-.516 1.156-.344.3-.803.45-1.384.45-.543 0-1.064-.172-1.573-.515l.237-.476c.438.22.833.328 1.19.328.332 0 .593-.073.783-.22a.754.754 0 00.3-.615c0-.33-.23-.61-.648-.845-.388-.213-1.163-.657-1.163-.657-.422-.307-.632-.636-.632-1.177 0-.45.157-.81.47-1.085.315-.278.72-.415 1.22-.415.512 0 .98.136 1.4.41l-.213.476a2.726 2.726 0 00-1.064-.23c-.283 0-.502.068-.654.206a.685.685 0 00-.248.524c0 .328.234.61.666.85.393.215 1.187.67 1.187.67.433.305.648.63.648 1.168zm9.382-5.852c-.535-.014-.95.04-1.297.188-.1.04-.26.04-.274.167.055.053.063.14.11.214.08.134.218.313.346.407.14.11.28.216.427.31.26.16.555.255.81.416.145.094.293.213.44.313.073.05.12.14.214.172v-.02c-.046-.06-.06-.147-.105-.214-.067-.067-.134-.127-.2-.193a3.223 3.223 0 00-.695-.675c-.214-.146-.682-.35-.77-.595l-.013-.014c.146-.013.32-.066.46-.106.227-.06.435-.047.67-.106.106-.027.213-.06.32-.094v-.06c-.12-.12-.21-.283-.334-.395a8.867 8.867 0 00-1.104-.823c-.21-.134-.476-.22-.697-.334-.08-.04-.214-.06-.26-.127-.12-.146-.19-.34-.275-.514a17.69 17.69 0 01-.547-1.163c-.12-.262-.193-.523-.34-.763-.69-1.137-1.437-1.826-2.586-2.5-.247-.14-.543-.2-.856-.274-.167-.008-.334-.02-.5-.027-.11-.047-.216-.174-.31-.235-.38-.24-1.364-.76-1.644-.072-.18.434.267.862.422 1.082.115.153.26.328.34.5.047.116.06.235.107.356.106.294.207.622.347.897.073.14.153.287.247.413.054.073.146.107.167.227-.094.136-.1.334-.154.5-.24.757-.146 1.693.194 2.25.107.166.362.534.703.393.3-.12.234-.5.32-.835.02-.08.007-.133.048-.187v.015c.094.188.188.367.274.555.206.328.566.668.867.895.16.12.287.328.487.402v-.02h-.015c-.043-.058-.1-.086-.154-.133a3.445 3.445 0 01-.35-.4 8.76 8.76 0 01-.747-1.218c-.11-.21-.202-.436-.29-.643-.04-.08-.04-.2-.107-.24-.1.146-.247.273-.32.453-.127.288-.14.642-.188 1.01-.027.007-.014 0-.027.014-.214-.052-.287-.274-.367-.46-.2-.475-.233-1.238-.06-1.785.047-.14.247-.582.167-.716-.042-.127-.174-.2-.247-.303a2.478 2.478 0 01-.24-.427c-.16-.374-.24-.788-.414-1.162-.08-.173-.22-.354-.334-.513-.127-.18-.267-.307-.368-.52-.033-.073-.08-.194-.027-.274.014-.054.042-.075.094-.09.088-.072.335.022.422.062.247.1.455.194.662.334.094.066.195.193.315.226h.14c.214.047.455.014.655.073.355.114.675.28.962.46a5.953 5.953 0 012.085 2.286c.08.154.115.295.188.455.14.33.313.663.455.982.14.315.275.636.476.897.1.14.502.213.682.286.133.06.34.115.46.188.23.14.454.3.67.454.11.076.443.243.463.378z"/></svg>`,
  'postgresql orm': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z"/></svg>`,
  'sqlite orm': `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.678.521c-1.032-.92-2.28-.55-3.513.544a8.71 8.71 0 0 0-.547.535c-2.109 2.237-4.066 6.38-4.674 9.544.237.48.422 1.093.544 1.561a13.044 13.044 0 0 1 .164.703s-.019-.071-.096-.296l-.05-.146a1.689 1.689 0 0 0-.033-.08c-.138-.32-.518-.995-.686-1.289-.143.423-.27.818-.376 1.176.484.884.778 2.4.778 2.4s-.025-.099-.147-.442c-.107-.303-.644-1.244-.772-1.464-.217.804-.304 1.346-.226 1.478.152.256.296.698.422 1.186.286 1.1.485 2.44.485 2.44l.017.224a22.41 22.41 0 0 0 .056 2.748c.095 1.146.273 2.13.5 2.657l.155-.084c-.334-1.038-.47-2.399-.41-3.967.09-2.398.642-5.29 1.661-8.304 1.723-4.55 4.113-8.201 6.3-9.945-1.993 1.8-4.692 7.63-5.5 9.788-.904 2.416-1.545 4.684-1.931 6.857.666-2.037 2.821-2.912 2.821-2.912s1.057-1.304 2.292-3.166c-.74.169-1.955.458-2.362.629-.6.251-.762.337-.762.337s1.945-1.184 3.613-1.72C21.695 7.9 24.195 2.767 21.678.521m-18.573.543A1.842 1.842 0 0 0 1.27 2.9v16.608a1.84 1.84 0 0 0 1.835 1.834h9.418a22.953 22.953 0 0 1-.052-2.707c-.006-.062-.011-.141-.016-.2a27.01 27.01 0 0 0-.473-2.378c-.121-.47-.275-.898-.369-1.057-.116-.197-.098-.31-.097-.432 0-.12.015-.245.037-.386a9.98 9.98 0 0 1 .234-1.045l.217-.028c-.017-.035-.014-.065-.031-.097l-.041-.381a32.8 32.8 0 0 1 .382-1.194l.2-.019c-.008-.016-.01-.038-.018-.053l-.043-.316c.63-3.28 2.587-7.443 4.8-9.791.066-.069.133-.128.198-.194Z"/></svg>`,
};

const COLLAPSED_WIDTH = 52;

// ── SidebarManager ────────────────────────────────────────────────────────────
//
// Responsibilities:
//   1. Inject the panel-toggle button at the top of the sidebar
//   2. Inject section icons + wrap label text (so CSS can hide text when collapsed)
//   3. Collapse / expand via data-sidebar-collapsed on <html> + CSS variable
//   4. Render the drag-to-resize handle
//
function SidebarManager() {
  const [handleLeft, setHandleLeft]  = useState(-999);
  const [collapsed, setCollapsed]    = useState(false);
  const dragging      = useRef(false);
  const savedWidth    = useRef(300);
  const isCollapsed   = useRef(false);  // never stale — read inside event handlers
  const asideRef      = useRef(null);
  const collapseItRef = useRef(null);
  const expandItRef   = useRef(null);

  useEffect(() => {
    // ── Restore persisted state ──────────────────────────────────────────────
    // Suppress the sidebar width transition during restoration so the collapsed
    // state is applied instantly with no animation flash.
    document.documentElement.classList.add('sidebar-restoring');

    const storedWidth = parseInt(localStorage.getItem('sidebarWidth'), 10);
    if (storedWidth >= 150 && storedWidth <= 800) savedWidth.current = storedWidth;
    isCollapsed.current = localStorage.getItem('sidebarCollapsed') === '1';

    if (isCollapsed.current) {
      document.documentElement.dataset.sidebarCollapsed = '1';
      document.documentElement.style.setProperty('--doc-sidebar-width', COLLAPSED_WIDTH + 'px');
      setCollapsed(true);
      setHandleLeft(COLLAPSED_WIDTH - 3);
    } else {
      document.documentElement.style.setProperty('--doc-sidebar-width', savedWidth.current + 'px');
    }

    // Re-enable transitions after two paint frames (state is already applied by now)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('sidebar-restoring');
    }));

    // ── collapse / expand ────────────────────────────────────────────────────
    const collapseIt = () => {
      const aside = asideRef.current;
      if (!aside) return;
      const w = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--doc-sidebar-width').trim(),
        10,
      );
      if (w > COLLAPSED_WIDTH) savedWidth.current = w;
      isCollapsed.current = true;
      document.documentElement.dataset.sidebarCollapsed = '1';
      document.documentElement.style.setProperty('--doc-sidebar-width', COLLAPSED_WIDTH + 'px');
      localStorage.setItem('sidebarCollapsed', '1');
      localStorage.setItem('sidebarWidth', savedWidth.current);
      setCollapsed(true);
      setHandleLeft(COLLAPSED_WIDTH - 3);
    };

    const expandIt = () => {
      const aside = asideRef.current;
      if (!aside) return;
      isCollapsed.current = false;
      delete document.documentElement.dataset.sidebarCollapsed;
      document.documentElement.style.setProperty('--doc-sidebar-width', savedWidth.current + 'px');
      localStorage.removeItem('sidebarCollapsed');
      setCollapsed(false);
      hideFlyout();
      // handleLeft updated by ResizeObserver after width transition
    };

    // ── inject section icons & wrap label text ───────────────────────────────
    const injectNavIcons = (aside) => {
      if (!aside) return;
      // Restrict icon injection to the root menu only — nested sub-menus
      // (e.g. items under an expanded category like "Swig") should not
      // get icons. The sidebar's root ul.menu__list is the first one
      // found inside the aside; iterate only its direct li children.
      const rootList = aside.querySelector('ul.menu__list');
      if (!rootList) return;
      const topLinks = rootList.querySelectorAll(
        ':scope > li.menu__list-item > a.menu__link, ' +
        ':scope > li.menu__list-item > div.menu__list-item-collapsible > a.menu__link',
      );
      topLinks.forEach((link) => {
        if (link.dataset.iconInjected) return;
        link.dataset.iconInjected = '1';

        const labelText = link.textContent.trim();

        // Wrap bare text nodes so CSS can hide them independently in collapsed mode
        Array.from(link.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
          .forEach((textNode) => {
            const span = document.createElement('span');
            span.className = 'sidebar-nav-label';
            textNode.replaceWith(span);
            span.appendChild(textNode);
          });

        const iconSvg = NAV_ICONS[labelText.toLowerCase()];
        if (iconSvg) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'sidebar-nav-icon';
          iconSpan.innerHTML = iconSvg;
          link.prepend(iconSpan);
          link.title = labelText; // native browser tooltip shown in collapsed mode
        }
      });
    };

    collapseItRef.current = collapseIt;
    expandItRef.current   = expandIt;

    // ── inject reading progress bar into right TOC sidebar ───────────────────
    const injectTocProgress = (tocEl) => {
      if (!tocEl || tocEl.querySelector('.toc-reading-progress')) return;
      const bar = document.createElement('div');
      bar.className = 'toc-reading-progress';
      const fill = document.createElement('div');
      fill.className = 'toc-reading-progress-fill';
      bar.appendChild(fill);
      tocEl.prepend(bar);
    };

    // ── hover flyout for categories in collapsed mode ────────────────────────
    const flyout = document.createElement('div');
    flyout.className = 'sidebar-flyout';
    flyout.style.display = 'none';
    document.body.appendChild(flyout);

    let hideTimer = null;
    let activeCatItem = null;

    const hideFlyout = () => {
      flyout.style.display = 'none';
      activeCatItem = null;
    };

    const scheduleHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideFlyout, 280);
    };

    // Build (or rebuild) the flyout's inner content for a given category list item.
    // Separated from showFlyoutFor so it can be called recursively after lazy-load.
    const buildFlyoutContent = (listItem) => {
      const catLink  = listItem.querySelector('div.menu__list-item-collapsible > a.menu__link');
      const catLabel = catLink?.title || catLink?.textContent?.trim() || '';

      flyout.innerHTML = '';

      if (catLabel) {
        const header = document.createElement('div');
        header.className = 'sidebar-flyout-header';
        header.textContent = catLabel;
        flyout.appendChild(header);
      }

      const subItems = listItem.querySelectorAll(':scope > ul.menu__list > li.menu__list-item > a.menu__link');

      if (subItems.length === 0) {
        // Docusaurus lazy={true} — category sub-items not yet in DOM.
        // Programmatically expand then immediately re-collapse the category so React renders
        // the children once. After collapse the items stay in DOM (Collapsible keeps
        // rendered=true once it has been set), so future hovers show the full list.
        const caretBtn = listItem.querySelector(':scope > div.menu__list-item-collapsible > button.menu__caret');
        if (caretBtn) {
          caretBtn.click(); // expand → React renders sub-items
          setTimeout(() => {
            caretBtn.click(); // collapse → rendered=true stays, items remain in DOM
            if (activeCatItem === listItem) buildFlyoutContent(listItem); // rebuild with real items
          }, 80);
        }
        // Show category link as a temporary placeholder while React re-renders
        if (catLink && catLink.href) {
          const a = document.createElement('a');
          a.className = 'sidebar-flyout-item';
          a.href = catLink.href;
          const labelEl = catLink.querySelector('.sidebar-nav-label');
          a.textContent = labelEl ? labelEl.textContent.trim() : (catLabel || catLink.textContent.trim());
          flyout.appendChild(a);
        } else {
          flyout.style.display = 'none';
          return;
        }
      } else {
        subItems.forEach((subLink) => {
          const a = document.createElement('a');
          a.className = 'sidebar-flyout-item' +
            (subLink.classList.contains('menu__link--active') ? ' sidebar-flyout-item--active' : '');
          a.href = subLink.href;
          const labelEl = subLink.querySelector('.sidebar-nav-label');
          a.textContent = labelEl ? labelEl.textContent.trim() : subLink.textContent.trim();
          flyout.appendChild(a);
        });
      }

      flyout.style.display = 'block';
    };

    const showFlyoutFor = (listItem) => {
      if (listItem === activeCatItem) { clearTimeout(hideTimer); return; }
      clearTimeout(hideTimer);
      activeCatItem = listItem;

      const rect = listItem.getBoundingClientRect();
      flyout.style.top  = rect.top + 'px';
      flyout.style.left = COLLAPSED_WIDTH + 'px';

      buildFlyoutContent(listItem);
    };

    // Per-item mouseenter/mouseleave — non-bubbling, so child-to-child movement
    // within the same list item never triggers a spurious hide.
    const attachFlyoutListeners = (aside) => {
      aside.querySelectorAll('ul.menu__list > li.menu__list-item:not([data-flyout-attached])').forEach((item) => {
        if (!item.querySelector(':scope > div.menu__list-item-collapsible')) return;
        item.dataset.flyoutAttached = '1';
        item.addEventListener('mouseenter', () => {
          if (!isCollapsed.current) return;
          clearTimeout(hideTimer);
          showFlyoutFor(item);
        });
        item.addEventListener('mouseleave', () => {
          if (!isCollapsed.current) return;
          scheduleHide(); // flyout mouseenter will cancel if mouse goes there
        });
      });
    };

    flyout.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    flyout.addEventListener('mouseleave', () => scheduleHide());

    // ── resize handle position ───────────────────────────────────────────────
    let ro = null;
    const updateHandle = () => {
      if (!asideRef.current) return;
      if (isCollapsed.current) { setHandleLeft(COLLAPSED_WIDTH - 3); return; }
      const w = asideRef.current.getBoundingClientRect().width;
      setHandleLeft(w > 50 ? w - 3 : -999);
    };

    // ── attach to aside ──────────────────────────────────────────────────────
    const attach = () => {
      const el = document.querySelector('.theme-doc-sidebar-container');
      if (!el) return;
      const isNew = el !== asideRef.current;
      asideRef.current = el;
      if (isNew) {
        hideFlyout(); // dismiss stale flyout on real SPA navigation (new aside element)
        if (ro) ro.disconnect();
        ro = new ResizeObserver(updateHandle);
        ro.observe(el);
      }
      injectNavIcons(el);
      attachFlyoutListeners(el); // safe to call repeatedly (data-flyout-attached guard)
      updateHandle();
      const tocEl = document.querySelector('.theme-doc-toc-desktop');
      if (tocEl) injectTocProgress(tocEl);
    };

    attach();

    // ── Reading progress bar ─────────────────────────────────────────────────
    const updateProgress = () => {
      const fill = document.querySelector('.toc-reading-progress-fill');
      if (!fill) return;
      const scrollH = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = scrollH > 0 ? (window.scrollY / scrollH) * 100 : 0;
      fill.style.width = Math.min(100, pct) + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    // Re-attach / re-inject after SPA navigation or React re-renders
    let debounceTimer = null;
    const mo = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const aside = asideRef.current;
        if (aside) injectNavIcons(aside);
        if (aside) attachFlyoutListeners(aside); // pick up newly rendered lazy-loaded items
        attach(); // finds new aside on doc page navigation (hideFlyout called inside if new aside)
        const tocEl = document.querySelector('.theme-doc-toc-desktop');
        if (tocEl && !tocEl.querySelector('.toc-reading-progress')) injectTocProgress(tocEl);
        updateProgress(); // sync progress bar after navigation
      }, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (ro) ro.disconnect();
      mo.disconnect();
      clearTimeout(debounceTimer);
      clearTimeout(hideTimer);
      flyout.remove();
      window.removeEventListener('scroll', updateProgress);
    };
  }, []);

  // Drag-to-resize handler (noop when collapsed)
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0 || isCollapsed.current) return;
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('sidebar-resizing');

    const onMove = (ev) => {
      const w = Math.max(150, Math.min(800, ev.clientX));
      savedWidth.current = w;
      document.documentElement.style.setProperty('--doc-sidebar-width', w + 'px');
      setHandleLeft(w - 3);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('sidebar-resizing');
      localStorage.setItem('sidebarWidth', savedWidth.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  return (
    <div style={{ '--sidebar-handle-left': handleLeft + 'px' }}>
      <div
        className="sidebar-resize-handle"
        onMouseDown={onMouseDown}
      />
      <button
        className="sidebar-edge-toggle"
        type="button"
        onClick={() => {
          if (isCollapsed.current) expandItRef.current?.();
          else collapseItRef.current?.();
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        dangerouslySetInnerHTML={{ __html: collapsed ? SVG_PANEL_OPEN : SVG_PANEL_CLOSE }}
      />
    </div>
  );
}

// ── Diagram zoom modal ────────────────────────────────────────────────────────

function DiagramModal({ svgContent: { html, dark }, onClose }) {
  const contentRef = useRef(null);
  const dragRef    = useRef({ active: false, x: 0, y: 0 });
  const scaleRef   = useRef(1);
  const offsetRef  = useRef({ x: 0, y: 0 });

  const PAN_STEP = 40;

  const applyTransform = () => {
    if (!contentRef.current) return;
    const { x, y } = offsetRef.current;
    contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`;
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === '=' || e.key === '+') { scaleRef.current = Math.min(6, +(scaleRef.current + 0.2).toFixed(2)); applyTransform(); return; }
      if (e.key === '-')                  { scaleRef.current = Math.max(0.2, +(scaleRef.current - 0.2).toFixed(2)); applyTransform(); return; }
      if (e.key === '0')                  { scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }; applyTransform(); return; }
      if (e.key === 'ArrowLeft')          { offsetRef.current.x += PAN_STEP; applyTransform(); return; }
      if (e.key === 'ArrowRight')         { offsetRef.current.x -= PAN_STEP; applyTransform(); return; }
      if (e.key === 'ArrowUp')            { offsetRef.current.y += PAN_STEP; applyTransform(); return; }
      if (e.key === 'ArrowDown')          { offsetRef.current.y -= PAN_STEP; applyTransform(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const onWheel = (e) => {
      e.preventDefault();
      const s = scaleRef.current;
      const o = offsetRef.current;
      // Normalize across deltaMode (pixels / lines / pages) then scale
      // exponentially so slow trackpad gestures stay gentle and fast ones
      // stay responsive, without the fixed-step violence of additive zoom.
      const raw      = e.deltaMode === 1 ? e.deltaY * 15 :
                       e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY;
      const factor   = Math.exp(-raw * 0.003);
      const newScale = Math.min(6, Math.max(0.2, s * factor));
      const ratio    = newScale / s;
      const cx       = window.innerWidth  / 2;
      const cy       = window.innerHeight / 2;
      scaleRef.current  = newScale;
      offsetRef.current = {
        x: (e.clientX - cx) * (1 - ratio) + o.x * ratio,
        y: (e.clientY - cy) * (1 - ratio) + o.y * ratio,
      };
      applyTransform();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    offsetRef.current = {
      x: offsetRef.current.x + (e.clientX - dragRef.current.x),
      y: offsetRef.current.y + (e.clientY - dragRef.current.y),
    };
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    applyTransform();
  };

  const onPointerUp = (e) => {
    dragRef.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grab';
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'fixed', top: 14, right: 18,
          background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%', width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)', transition: 'background 0.15s',
          zIndex: 10001,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="11" y2="11" />
          <line x1="11" y1="1" x2="1" y2="11" />
        </svg>
      </button>
      <div
        style={{
          position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '5px 14px', borderRadius: 20, fontSize: 12,
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          zIndex: 10001,
        }}
      >
        Scroll/+− to zoom · Drag/arrows to pan · 0 to reset · Esc to close
      </div>
      <div
        ref={contentRef}
        onClick={e => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: 'translate(0px, 0px) scale(1)',
          transformOrigin: 'center center',
          willChange: 'transform',
          background: dark ? '#1e1e1e' : '#fff',
          borderRadius: 8, padding: 24,
          cursor: 'grab', userSelect: 'none',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          lineHeight: 0,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Root({ children }) {
  const [svgContent, setSvgContent] = useState(null);

  useEffect(() => {
    const onClick = (e) => {
      const container = e.target.closest('.docusaurus-mermaid-container');
      if (!container) return;
      const svg = container.querySelector('svg');
      if (!svg) return;
      const { width, height } = svg.getBoundingClientRect();
      const maxW  = window.innerWidth  * 0.82;
      const maxH  = window.innerHeight * 0.78;
      const scale = Math.min(maxW / width, maxH / height);
      const clone = svg.cloneNode(true);
      clone.setAttribute('width',  Math.round(width  * scale) + 'px');
      clone.setAttribute('height', Math.round(height * scale) + 'px');
      clone.style.display = 'block';
      const isDark = document.documentElement.dataset.theme === 'dark';
      setSvgContent({ html: clone.outerHTML, dark: isDark });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const close = useCallback(() => setSvgContent(null), []);

  return (
    <>
      {children}
      <SidebarManager />
      {svgContent && <DiagramModal svgContent={svgContent} onClose={close} />}
    </>
  );
}

// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';
import readingTimePlugin from './src/remark/reading-time.js';

// Auto-patched on `npm start` / `npm run build` by scripts/sync-versions.js.
// Resolution order: <PKG>_PATH env → npm-global → ~/Sites/gina/<name> → node_modules.
const ginaVersion = '0.3.7';
const swigVersion = '1.6.0';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Gina',
  tagline: 'MVC framework for Node.js',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  markdown: {
    format: 'detect',
    mermaid: true,
  },

  themes: [
    '@docusaurus/theme-mermaid',
    ['@easyops-cn/docusaurus-search-local', /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */ ({
      hashed: true,
      indexDocs: true,
      indexBlog: false,
      indexPages: false,
      docsRouteBasePath: '/',
      highlightSearchTermsOnTargetPage: true,
      searchResultLimits: 10,
      explicitSearchResultPath: true,
    })],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Every old URL points directly to its final destination under
        // /templating/*. No redirect chains. Paired with Cloudflare Worker
        // 301s (infra/cloudflare/worker.js § TEMPLATING_REDIRECTS) so
        // indexed backlinks resolve via HTTP 301 at the edge; this
        // meta-refresh layer is the fallback for direct Vercel access.
        redirects: [
          // Original /swig/* and /swig/twig/* URLs (pre-restructure, indexed).
          {from: '/swig',                to: '/templating/swig'},
          {from: '/swig/getting-started',to: '/templating/swig/getting-started'},
          {from: '/swig/syntax',         to: '/templating/swig/syntax'},
          {from: '/swig/tags',           to: '/templating/swig/tags'},
          {from: '/swig/filters',        to: '/templating/swig/filters'},
          {from: '/swig/loaders',        to: '/templating/swig/loaders'},
          {from: '/swig/extending',      to: '/templating/swig/extending'},
          {from: '/swig/api',            to: '/templating/swig/api'},
          {from: '/swig/cli',            to: '/templating/swig/cli'},
          {from: '/swig/browser',        to: '/templating/swig/browser'},
          {from: '/swig/migration',      to: '/templating/swig/migration'},
          {from: '/swig/security',       to: '/templating/swig/security'},
          {from: '/swig/twig',           to: '/templating/twig'},
          {from: '/swig/twig/migration', to: '/templating/twig/migration'},
          {from: '/swig/twig/parity',    to: '/templating/twig/parity'},
          {from: '/swig/twig/non-goals', to: '/templating/twig/non-goals'},
          // Original /nunjucks URL.
          {from: '/nunjucks',            to: '/templating/nunjucks'},
          // Short-lived /views/* URLs (lived for ~1h before rename to
          // /templating/*). Covered so any reader who grabbed a link in that
          // window still lands correctly.
          {from: '/views',                    to: '/templating'},
          {from: '/views/swig',               to: '/templating/swig'},
          {from: '/views/swig/getting-started',to: '/templating/swig/getting-started'},
          {from: '/views/swig/syntax',        to: '/templating/swig/syntax'},
          {from: '/views/swig/tags',          to: '/templating/swig/tags'},
          {from: '/views/swig/filters',       to: '/templating/swig/filters'},
          {from: '/views/swig/loaders',       to: '/templating/swig/loaders'},
          {from: '/views/swig/extending',     to: '/templating/swig/extending'},
          {from: '/views/swig/api',           to: '/templating/swig/api'},
          {from: '/views/swig/cli',           to: '/templating/swig/cli'},
          {from: '/views/swig/browser',       to: '/templating/swig/browser'},
          {from: '/views/swig/migration',     to: '/templating/swig/migration'},
          {from: '/views/swig/security',      to: '/templating/swig/security'},
          {from: '/views/swig/twig',          to: '/templating/twig'},
          {from: '/views/swig/twig/migration',to: '/templating/twig/migration'},
          {from: '/views/swig/twig/parity',   to: '/templating/twig/parity'},
          {from: '/views/swig/twig/non-goals',to: '/templating/twig/non-goals'},
          {from: '/views/nunjucks',           to: '/templating/nunjucks'},
          // CLI reference pages — filename-form → id-form. Each page's `id: cli-<file>`
          // frontmatter routes the canonical URL to `/cli/cli-<file>`; these entries
          // cover external references that assume filename-form. Paired with Cloudflare
          // Worker 301s (infra/cloudflare/worker.js § CLI_REDIRECTS). See gina-io/docs#11.
          {from: '/cli/bundle',    to: '/cli/cli-bundle'},
          {from: '/cli/cache',     to: '/cli/cli-cache'},
          {from: '/cli/connector', to: '/cli/cli-connector'},
          {from: '/cli/env',       to: '/cli/cli-env'},
          {from: '/cli/framework', to: '/cli/cli-framework'},
          {from: '/cli/port',      to: '/cli/cli-port'},
          {from: '/cli/project',   to: '/cli/cli-project'},
          {from: '/cli/protocol',  to: '/cli/cli-protocol'},
          {from: '/cli/scope',     to: '/cli/cli-scope'},
          {from: '/cli/service',   to: '/cli/cli-service'},
          {from: '/cli/view',      to: '/cli/cli-view'},
        ],
      },
    ],
  ],

  url: 'https://gina.io',
  baseUrl: '/docs/',

  organizationName: 'gina-io',
  projectName: 'docs',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/gina-io/docs/tree/main/',
          remarkPlugins: [readingTimePlugin],
          async sidebarItemsGenerator({defaultSidebarItemsGenerator, ...args}) {
            const items = await defaultSidebarItemsGenerator(args);
            // Exclude standalone pages and the tutorials/ directory from the main Docs sidebar.
            // Each exclusion is handled via `displayed_sidebar` frontmatter in the relevant pages,
            // which routes them to their own dedicated sidebars.
            return items.filter(item => {
              if (item.type === 'doc' && (item.id === 'roadmap' || item.id === 'support')) return false;
              if (item.type === 'category' && item.label === 'Tutorials') return false;
              if (item.type === 'category' && item.label === 'Templating') return false;
              return true;
            });
          },
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/gina-io/docs/tree/main/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  customFields: {
    swigVersion,
  },

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Gina',
        logo: {
          alt: 'Gina logo',
          src: 'img/logo.svg',
          srcDark: 'img/logo.svg',
          width: 32,
          height: 32,
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docSidebar',
            sidebarId: 'tutorialsSidebar',
            position: 'left',
            label: 'Tutorials',
            className: 'navbar-tutorials-link',
          },
          {
            type: 'docSidebar',
            sidebarId: 'templatingSidebar',
            position: 'left',
            label: 'Templating',
            className: 'navbar-templating-link',
          },
          {
            type: 'docSidebar',
            sidebarId: 'roadmapSidebar',
            position: 'left',
            label: 'Roadmap',
            className: 'navbar-roadmap-link',
          },
          {
            label: 'v' + ginaVersion,
            href: 'https://github.com/gina-io/gina/releases',
            position: 'right',
          },
          {
            href: 'https://github.com/gina-io/gina',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub Issues',
                href: 'https://github.com/gina-io/gina/issues',
              },
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/gina-io/gina/discussions',
              },
              {
                label: 'Support Gina',
                to: '/support',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/gina',
              },
            ],
          },
        ],
        copyright: `Copyright © 2009-${new Date().getFullYear()} gina-io.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json'],
      },
    }),
};

export default config;

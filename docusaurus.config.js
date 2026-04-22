// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';
import readingTimePlugin from './src/remark/reading-time.js';

// Auto-patched on `npm start` / `npm run build` by scripts/sync-versions.js.
// Resolution order: <PKG>_PATH env → npm-global → ~/Sites/gina/<name> → node_modules.
const ginaVersion = '0.3.6';
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
        redirects: [
          // Swig pages moved under /views/swig/ (2026-04-23 Views umbrella).
          {from: '/swig',                to: '/views/swig'},
          {from: '/swig/getting-started',to: '/views/swig/getting-started'},
          {from: '/swig/syntax',         to: '/views/swig/syntax'},
          {from: '/swig/tags',           to: '/views/swig/tags'},
          {from: '/swig/filters',        to: '/views/swig/filters'},
          {from: '/swig/loaders',        to: '/views/swig/loaders'},
          {from: '/swig/extending',      to: '/views/swig/extending'},
          {from: '/swig/api',            to: '/views/swig/api'},
          {from: '/swig/cli',            to: '/views/swig/cli'},
          {from: '/swig/browser',        to: '/views/swig/browser'},
          {from: '/swig/migration',      to: '/views/swig/migration'},
          {from: '/swig/security',       to: '/views/swig/security'},
          {from: '/swig/twig',           to: '/views/swig/twig'},
          {from: '/swig/twig/migration', to: '/views/swig/twig/migration'},
          {from: '/swig/twig/parity',    to: '/views/swig/twig/parity'},
          {from: '/swig/twig/non-goals', to: '/views/swig/twig/non-goals'},
          // Nunjucks moved under /views/nunjucks/.
          {from: '/nunjucks',            to: '/views/nunjucks'},
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
              if (item.type === 'category' && item.label === 'Views') return false;
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
            sidebarId: 'viewsSidebar',
            position: 'left',
            label: 'Views',
            className: 'navbar-views-link',
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

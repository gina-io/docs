// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';
import readingTimePlugin from './src/remark/reading-time.js';

// Updated automatically by gina's post_publish script on each release.
const ginaVersion = '0.3.1-alpha.1';

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

  themes: ['@docusaurus/theme-mermaid'],

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
        copyright: `Copyright © 2009-${new Date().getFullYear()} Rhinostone.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json'],
      },
    }),
};

export default config;

import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Category from '@theme-original/DocSidebarItem/Category';
import styles from './styles.module.css';

const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

const BADGE_CONFIG = {
  Swig: {
    pkg: '@rhinostone/swig',
    versionField: 'swigVersion',
    npmHref: 'https://www.npmjs.com/package/@rhinostone/swig',
    repoHref: 'https://github.com/gina-io/swig',
    repoLabel: 'gina-io/swig on GitHub',
  },
  Twig: {
    pkg: '@rhinostone/swig-twig',
    versionField: 'twigVersion',
    npmHref: 'https://www.npmjs.com/package/@rhinostone/swig-twig',
    repoHref: 'https://github.com/gina-io/swig',
    repoLabel: 'gina-io/swig on GitHub',
  },
  Jinja2: {
    pkg: '@rhinostone/swig-jinja2',
    versionField: 'jinjaVersion',
    npmHref: 'https://www.npmjs.com/package/@rhinostone/swig-jinja2',
    repoHref: 'https://github.com/gina-io/swig',
    repoLabel: 'gina-io/swig on GitHub',
  },
};

function buildBadgeHtml(cfg, version) {
  return (
    '<div class="' + styles.swigBadge + '">' +
      '<a class="' + styles.swigPkg + '" href="' + cfg.npmHref + '" target="_blank" rel="noopener noreferrer" title="View ' + cfg.pkg + ' on npm">' +
        '<span class="' + styles.swigPkgName + '">' + cfg.pkg + '</span>' +
        '<span class="' + styles.swigPkgVersion + '">v' + version + '</span>' +
      '</a>' +
      '<a class="' + styles.swigRepo + '" href="' + cfg.repoHref + '" target="_blank" rel="noopener noreferrer" title="' + cfg.repoLabel + '" aria-label="' + cfg.repoLabel + '">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + GITHUB_PATH + '"/></svg>' +
      '</a>' +
    '</div>'
  );
}

export default function CategoryWrapper(props) {
  const {item} = props;
  const {siteConfig} = useDocusaurusContext();
  const cfg = item?.label && BADGE_CONFIG[item.label];
  const version = cfg && siteConfig.customFields?.[cfg.versionField];

  if (!cfg || !version) {
    return <Category {...props} />;
  }

  const patchedItem = {
    ...item,
    items: [
      {
        type: 'html',
        value: buildBadgeHtml(cfg, version),
        defaultStyle: false,
        className: styles.swigBadgeListItem,
      },
      ...(item.items || []),
    ],
  };

  return <Category {...props} item={patchedItem} />;
}

import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

// Parse "[label](url)" from a prereq string.
// Returns { label, url, external } or null if plain text.
function parseLink(item) {
  const m = item.match(/^\[(.+?)\]\((.+?)\)$/);
  if (!m) return null;
  return { label: m[1], url: m[2], external: /^https?:\/\//.test(m[2]) };
}

const LEVEL_CONFIG = {
  beginner:     { label: 'Beginner',     className: styles.levelBeginner },
  intermediate: { label: 'Intermediate', className: styles.levelIntermediate },
  expert:       { label: 'Expert',       className: styles.levelExpert },
};

export default function DocMeta({ minutes, level, prereqs }) {
  const levelConfig = level ? LEVEL_CONFIG[level] : null;
  const prereqList = Array.isArray(prereqs) && prereqs.length > 0 ? prereqs : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.metaRow}>
        <div className={styles.readingTime}>
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          {minutes} min read
        </div>

        {levelConfig && (
          <span className={`${styles.levelBadge} ${levelConfig.className}`}>
            {levelConfig.label}
          </span>
        )}
      </div>

      {prereqList && (
        <div className={styles.prereqs}>
          <span className={styles.prereqsLabel}>Prerequisites</span>
          <ul className={styles.prereqsList}>
            {prereqList.map((item, i) => {
              const link = parseLink(item);
              if (!link) return <li key={i}>{item}</li>;
              if (link.external) return (
                <li key={i}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                </li>
              );
              return <li key={i}><Link to={link.url}>{link.label}</Link></li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

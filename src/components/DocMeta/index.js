import React from 'react';
import styles from './styles.module.css';

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
            {prereqList.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

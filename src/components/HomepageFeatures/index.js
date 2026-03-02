import Heading from '@theme/Heading';
import styles from './styles.module.css';

/* ── Inline icons (stroke-based, white stroke on amber hex) ───────── */

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconGraph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="12" y1="7" x2="6.8" y2="17.1" />
      <line x1="12" y1="7" x2="17.2" y2="17.1" />
      <line x1="8.9" y1="19" x2="15.1" y2="19" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
      <polyline points="2,8.5 12,15 22,8.5" />
      <line x1="12" y1="15" x2="12" y2="22" />
    </svg>
  );
}

/* ── Feature data ─────────────────────────────────────────────────── */

const FeatureList = [
  {
    Icon: IconGrid,
    title: 'Projects and bundles',
    description:
      'Organise your applications into projects and bundles. Each bundle is an ' +
      'independent process with its own port, config, and lifecycle — start, ' +
      'stop, and restart them individually or all at once.',
  },
  {
    Icon: IconGraph,
    title: 'MVC and event-driven',
    description:
      'Gina follows an MVC architecture with an event-driven core. It does not ' +
      'rely on Express or Connect, yet is compatible with middleware and plugins ' +
      'written for those frameworks.',
  },
  {
    Icon: IconLayers,
    title: 'Built-in environments',
    description:
      'Switch between dev, prod, and custom environments with a single command. ' +
      'In dev mode, changes to controllers, templates, and assets are picked up ' +
      'without restarting.',
  },
];

function Feature({ Icon, title, description }) {
  return (
    <div className="col col--4">
      <div className={styles.featureCard}>
        <div className="text--center">
          <div className={styles.featureHex}>
            <Icon />
          </div>
        </div>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

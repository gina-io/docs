import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Projects and bundles',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Organise your applications into projects and bundles. Each bundle is an
        independent process with its own port, config, and lifecycle — start,
        stop, and restart them individually or all at once.
      </>
    ),
  },
  {
    title: 'MVC and event-driven',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Gina follows an MVC architecture with an event-driven core. It does not
        rely on Express or Connect, yet is compatible with middleware and plugins
        written for those frameworks.
      </>
    ),
  },
  {
    title: 'Built-in environments',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Switch between <code>dev</code>, <code>prod</code>, and custom
        environments with a single command. In dev mode, changes to controllers,
        templates, and assets are picked up without restarting.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
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

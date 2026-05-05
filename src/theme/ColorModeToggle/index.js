import React from 'react';
import clsx from 'clsx';
import useIsBrowser from '@docusaurus/useIsBrowser';
import {translate} from '@docusaurus/Translate';
import styles from './styles.module.css';

function getColorModeLabel(colorMode) {
  return colorMode === 'dark'
    ? translate({
        message: 'dark mode',
        id: 'theme.colorToggle.ariaLabel.mode.dark',
        description: 'The name for the dark color mode',
      })
    : translate({
        message: 'light mode',
        id: 'theme.colorToggle.ariaLabel.mode.light',
        description: 'The name for the light color mode',
      });
}

function getColorModeAriaLabel(colorMode) {
  return translate(
    {
      message: 'Switch between dark and light mode (currently {mode})',
      id: 'theme.colorToggle.ariaLabel',
      description: 'The ARIA label for the color mode toggle',
    },
    {mode: getColorModeLabel(colorMode)},
  );
}

function ColorModeToggle({className, buttonClassName, value, onChange}) {
  const isBrowser = useIsBrowser();
  const isLight = value === 'light';
  return (
    <label
      className={clsx(styles.toggle, className)}
      title={getColorModeLabel(value)}>
      <input
        type="checkbox"
        className={clsx(styles.input, buttonClassName)}
        checked={isLight}
        disabled={!isBrowser}
        onChange={() => onChange(isLight ? 'dark' : 'light')}
        aria-label={getColorModeAriaLabel(value)}
      />
      <span className={styles.track}>
        <span className={styles.moon} aria-hidden>{'☾'}</span>
        <span className={styles.sun} aria-hidden>{'☀'}</span>
      </span>
    </label>
  );
}

export default React.memo(ColorModeToggle);

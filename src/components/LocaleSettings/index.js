import React, { useState, useEffect } from 'react';
import CodeBlock from '@theme/CodeBlock';
import styles from './styles.module.css';

/**
 * Detect the visitor's locale and timezone, then render a pre-filled
 * settings.json code block they can paste into their bundle config.
 *
 * Falls back to en_US / America/New_York for unrecognised locales.
 */

// Map navigator.language to a Gina culture string (lang_COUNTRY).
function detectCulture() {
  try {
    var lang = navigator.language || 'en-US';
    var parts = lang.split('-');
    if (parts.length < 2) return 'en_US';
    return parts[0].toLowerCase() + '_' + parts[1].toUpperCase();
  } catch (_) {
    return 'en_US';
  }
}

// ISO 3166-1 alpha-2 from the culture string.
function isoShort(culture) {
  var parts = culture.split('_');
  return parts.length > 1 ? parts[1].toLowerCase() : 'us';
}

// Detect preferred languages from navigator.languages.
function detectLanguages() {
  try {
    if (navigator.languages && navigator.languages.length > 0) {
      return Array.from(navigator.languages).slice(0, 4);
    }
    return [navigator.language || 'en-US', navigator.language ? navigator.language.split('-')[0] : 'en'];
  } catch (_) {
    return ['en-US', 'en'];
  }
}

// Detect 24-hour time preference.
function detect24Hour() {
  try {
    var formatted = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).resolvedOptions();
    return formatted.hourCycle === 'h23' || formatted.hourCycle === 'h24';
  } catch (_) {
    return true;
  }
}

// Detect date format pattern from Intl.
function detectDateFormat() {
  try {
    var parts = new Intl.DateTimeFormat(navigator.language).formatToParts(new Date(2026, 0, 15));
    var order = parts.filter(function(p) { return p.type !== 'literal'; }).map(function(p) { return p.type; });
    if (order[0] === 'month') return 'mm/dd/yyyy';
    if (order[0] === 'day') return 'dd/mm/yyyy';
    if (order[0] === 'year') return 'yyyy/mm/dd';
    return 'mm/dd/yyyy';
  } catch (_) {
    return 'mm/dd/yyyy';
  }
}

// Detect timezone.
function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch (_) {
    return 'America/New_York';
  }
}

// Detect first day of week (0=Sunday, 1=Monday).
function detectFirstDay() {
  try {
    var locale = new Intl.Locale(navigator.language);
    if (typeof locale.getWeekInfo === 'function') {
      return locale.getWeekInfo().firstDay % 7;  // 7 → 0 (Sunday)
    }
    if (locale.weekInfo) {
      return locale.weekInfo.firstDay % 7;
    }
    return 1;
  } catch (_) {
    return 1;
  }
}

export default function LocaleSettings() {
  var [detected, setDetected] = useState(null);

  useEffect(function() {
    var culture = detectCulture();
    setDetected({
      culture: culture,
      isoShort: isoShort(culture),
      languages: detectLanguages(),
      is24Hour: detect24Hour(),
      dateFormat: detectDateFormat(),
      timeZone: detectTimeZone(),
      firstDay: detectFirstDay(),
    });
  }, []);

  if (!detected) return null;

  var json = JSON.stringify({
    region: {
      culture: detected.culture,
      isoShort: detected.isoShort,
      date: detected.dateFormat,
      timeZone: detected.timeZone,
    },
  }, null, 2);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.icon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>
        Your detected locale
      </div>
      <p className={styles.desc}>
        <code>gina bundle:add</code> auto-detects these values when scaffolding.
        If they don't match your target audience, edit{' '}
        <code>config/settings.json</code> after scaffolding.
      </p>
      <CodeBlock language="json" title="config/settings.json (region section)">
        {json}
      </CodeBlock>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useLocation } from '@docusaurus/router';
import styles from './styles.module.css';

const API = '/api/vote';

function pageFromPathname(pathname) {
  // pathname is relative to baseUrl, e.g. '/migration' or '/guides/caching'
  return pathname.replace(/^\//, '').replace(/\/$/, '') || 'intro';
}

export default function VoteWidget() {
  const { pathname }            = useLocation();
  const page                    = pageFromPathname(pathname);
  const storageKey              = `gina-vote:${page}`;

  const [counts,   setCounts]   = useState({ up: 0, down: 0 });
  const [userVote, setUserVote] = useState(null); // 'up' | 'down' | null
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [thanks,   setThanks]   = useState(false);

  // Seed from localStorage for instant render before the API responds
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setUserVote(stored);
    } catch {}
  }, [storageKey]);

  // Fetch live counts + server-side user vote (IP-based)
  useEffect(() => {
    setLoading(true);
    setThanks(false);
    fetch(`${API}?page=${encodeURIComponent(page)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setCounts({ up: data.up, down: data.down });
        if (data.userVote) {
          setUserVote(data.userVote);
          try { localStorage.setItem(storageKey, data.userVote); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, storageKey]);

  const vote = async (dir) => {
    if (busy || userVote) return;
    setBusy(true);
    try {
      const res  = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ page, dir }),
      });
      const data = await res.json();
      if (res.ok) {
        setCounts({ up: data.up, down: data.down });
        setUserVote(dir);
        setThanks(true);
        try { localStorage.setItem(storageKey, dir); } catch {}
      }
    } catch {}
    setBusy(false);
  };

  const voted = !!userVote;

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Was this page helpful?</span>
      <div className={styles.buttons}>
        <button
          className={`${styles.btn} ${userVote === 'up' ? styles.active : ''}`}
          onClick={() => vote('up')}
          disabled={voted || busy}
          aria-label="Yes, this was helpful"
          title="Yes"
        >
          <span className={styles.icon}>👍</span>
          <span className={styles.count}>{loading ? '–' : counts.up}</span>
        </button>
        <button
          className={`${styles.btn} ${userVote === 'down' ? styles.active : ''}`}
          onClick={() => vote('down')}
          disabled={voted || busy}
          aria-label="No, this was not helpful"
          title="No"
        >
          <span className={styles.icon}>👎</span>
          <span className={styles.count}>{loading ? '–' : counts.down}</span>
        </button>
      </div>
      {thanks && <span className={styles.thanks}>Thanks for your feedback!</span>}
    </div>
  );
}

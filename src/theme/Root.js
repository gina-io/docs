import React, { useEffect, useState, useRef, useCallback } from 'react';

// ── Inline SVG assets (Lucide icons, 24×24 viewBox, stroke="currentColor") ──

const SVG_PANEL_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M16 15l-3-3 3-3"/></svg>`;
const SVG_PANEL_OPEN  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M13 9l3 3-3 3"/></svg>`;

// Section icons matched against the lowercase label text of top-level nav items
const NAV_ICONS = {
  // intro page — Docusaurus uses the first h1 as sidebar label when no sidebar_label is set
  'what is gina?': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  'intro': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  'getting started': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  'concepts': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.1.7 3 .5.9 1.1 1.6 1.3 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  'guides': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  // cli _category_.json label is "CLI Reference"
  'cli reference': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  // api _category_.json label is "API Reference"
  'api reference': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  'api': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
};

const COLLAPSED_WIDTH = 52;

// ── SidebarManager ────────────────────────────────────────────────────────────
//
// Responsibilities:
//   1. Inject the panel-toggle button at the top of the sidebar
//   2. Inject section icons + wrap label text (so CSS can hide text when collapsed)
//   3. Collapse / expand via data-sidebar-collapsed on <html> + CSS variable
//   4. Render the drag-to-resize handle
//
function SidebarManager() {
  const [handleLeft, setHandleLeft]  = useState(-999);
  const [collapsed, setCollapsed]    = useState(false);
  const dragging      = useRef(false);
  const savedWidth    = useRef(300);
  const isCollapsed   = useRef(false);  // never stale — read inside event handlers
  const asideRef      = useRef(null);
  const collapseItRef = useRef(null);
  const expandItRef   = useRef(null);

  useEffect(() => {
    // ── Restore persisted state ──────────────────────────────────────────────
    // Suppress the sidebar width transition during restoration so the collapsed
    // state is applied instantly with no animation flash.
    document.documentElement.classList.add('sidebar-restoring');

    const storedWidth = parseInt(localStorage.getItem('sidebarWidth'), 10);
    if (storedWidth >= 150 && storedWidth <= 800) savedWidth.current = storedWidth;
    isCollapsed.current = localStorage.getItem('sidebarCollapsed') === '1';

    if (isCollapsed.current) {
      document.documentElement.dataset.sidebarCollapsed = '1';
      document.documentElement.style.setProperty('--doc-sidebar-width', COLLAPSED_WIDTH + 'px');
      setCollapsed(true);
      setHandleLeft(COLLAPSED_WIDTH - 3);
    } else {
      document.documentElement.style.setProperty('--doc-sidebar-width', savedWidth.current + 'px');
    }

    // Re-enable transitions after two paint frames (state is already applied by now)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('sidebar-restoring');
    }));

    // ── collapse / expand ────────────────────────────────────────────────────
    const collapseIt = () => {
      const aside = asideRef.current;
      if (!aside) return;
      const w = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--doc-sidebar-width').trim(),
        10,
      );
      if (w > COLLAPSED_WIDTH) savedWidth.current = w;
      isCollapsed.current = true;
      document.documentElement.dataset.sidebarCollapsed = '1';
      document.documentElement.style.setProperty('--doc-sidebar-width', COLLAPSED_WIDTH + 'px');
      localStorage.setItem('sidebarCollapsed', '1');
      localStorage.setItem('sidebarWidth', savedWidth.current);
      setCollapsed(true);
      setHandleLeft(COLLAPSED_WIDTH - 3);
    };

    const expandIt = () => {
      const aside = asideRef.current;
      if (!aside) return;
      isCollapsed.current = false;
      delete document.documentElement.dataset.sidebarCollapsed;
      document.documentElement.style.setProperty('--doc-sidebar-width', savedWidth.current + 'px');
      localStorage.removeItem('sidebarCollapsed');
      setCollapsed(false);
      hideFlyout();
      // handleLeft updated by ResizeObserver after width transition
    };

    // ── inject section icons & wrap label text ───────────────────────────────
    const injectNavIcons = (aside) => {
      if (!aside) return;
      const topLinks = aside.querySelectorAll(
        'ul.menu__list > li.menu__list-item > a.menu__link, ' +
        'ul.menu__list > li.menu__list-item > div.menu__list-item-collapsible > a.menu__link',
      );
      topLinks.forEach((link) => {
        if (link.dataset.iconInjected) return;
        link.dataset.iconInjected = '1';

        const labelText = link.textContent.trim();

        // Wrap bare text nodes so CSS can hide them independently in collapsed mode
        Array.from(link.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
          .forEach((textNode) => {
            const span = document.createElement('span');
            span.className = 'sidebar-nav-label';
            textNode.replaceWith(span);
            span.appendChild(textNode);
          });

        const iconSvg = NAV_ICONS[labelText.toLowerCase()];
        if (iconSvg) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'sidebar-nav-icon';
          iconSpan.innerHTML = iconSvg;
          link.prepend(iconSpan);
          link.title = labelText; // native browser tooltip shown in collapsed mode
        }
      });
    };

    collapseItRef.current = collapseIt;
    expandItRef.current   = expandIt;

    // ── inject reading progress bar into right TOC sidebar ───────────────────
    const injectTocProgress = (tocEl) => {
      if (!tocEl || tocEl.querySelector('.toc-reading-progress')) return;
      const bar = document.createElement('div');
      bar.className = 'toc-reading-progress';
      const fill = document.createElement('div');
      fill.className = 'toc-reading-progress-fill';
      bar.appendChild(fill);
      tocEl.prepend(bar);
    };

    // ── hover flyout for categories in collapsed mode ────────────────────────
    const flyout = document.createElement('div');
    flyout.className = 'sidebar-flyout';
    flyout.style.display = 'none';
    document.body.appendChild(flyout);

    let hideTimer = null;
    let activeCatItem = null;

    const hideFlyout = () => {
      flyout.style.display = 'none';
      activeCatItem = null;
    };

    const scheduleHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideFlyout, 280);
    };

    // Build (or rebuild) the flyout's inner content for a given category list item.
    // Separated from showFlyoutFor so it can be called recursively after lazy-load.
    const buildFlyoutContent = (listItem) => {
      const catLink  = listItem.querySelector('div.menu__list-item-collapsible > a.menu__link');
      const catLabel = catLink?.title || catLink?.textContent?.trim() || '';

      flyout.innerHTML = '';

      if (catLabel) {
        const header = document.createElement('div');
        header.className = 'sidebar-flyout-header';
        header.textContent = catLabel;
        flyout.appendChild(header);
      }

      const subItems = listItem.querySelectorAll(':scope > ul.menu__list > li.menu__list-item > a.menu__link');

      if (subItems.length === 0) {
        // Docusaurus lazy={true} — category sub-items not yet in DOM.
        // Programmatically expand then immediately re-collapse the category so React renders
        // the children once. After collapse the items stay in DOM (Collapsible keeps
        // rendered=true once it has been set), so future hovers show the full list.
        const caretBtn = listItem.querySelector(':scope > div.menu__list-item-collapsible > button.menu__caret');
        if (caretBtn) {
          caretBtn.click(); // expand → React renders sub-items
          setTimeout(() => {
            caretBtn.click(); // collapse → rendered=true stays, items remain in DOM
            if (activeCatItem === listItem) buildFlyoutContent(listItem); // rebuild with real items
          }, 80);
        }
        // Show category link as a temporary placeholder while React re-renders
        if (catLink && catLink.href) {
          const a = document.createElement('a');
          a.className = 'sidebar-flyout-item';
          a.href = catLink.href;
          const labelEl = catLink.querySelector('.sidebar-nav-label');
          a.textContent = labelEl ? labelEl.textContent.trim() : (catLabel || catLink.textContent.trim());
          flyout.appendChild(a);
        } else {
          flyout.style.display = 'none';
          return;
        }
      } else {
        subItems.forEach((subLink) => {
          const a = document.createElement('a');
          a.className = 'sidebar-flyout-item' +
            (subLink.classList.contains('menu__link--active') ? ' sidebar-flyout-item--active' : '');
          a.href = subLink.href;
          const labelEl = subLink.querySelector('.sidebar-nav-label');
          a.textContent = labelEl ? labelEl.textContent.trim() : subLink.textContent.trim();
          flyout.appendChild(a);
        });
      }

      flyout.style.display = 'block';
    };

    const showFlyoutFor = (listItem) => {
      if (listItem === activeCatItem) { clearTimeout(hideTimer); return; }
      clearTimeout(hideTimer);
      activeCatItem = listItem;

      const rect = listItem.getBoundingClientRect();
      flyout.style.top  = rect.top + 'px';
      flyout.style.left = COLLAPSED_WIDTH + 'px';

      buildFlyoutContent(listItem);
    };

    // Per-item mouseenter/mouseleave — non-bubbling, so child-to-child movement
    // within the same list item never triggers a spurious hide.
    const attachFlyoutListeners = (aside) => {
      aside.querySelectorAll('ul.menu__list > li.menu__list-item:not([data-flyout-attached])').forEach((item) => {
        if (!item.querySelector(':scope > div.menu__list-item-collapsible')) return;
        item.dataset.flyoutAttached = '1';
        item.addEventListener('mouseenter', () => {
          if (!isCollapsed.current) return;
          clearTimeout(hideTimer);
          showFlyoutFor(item);
        });
        item.addEventListener('mouseleave', () => {
          if (!isCollapsed.current) return;
          scheduleHide(); // flyout mouseenter will cancel if mouse goes there
        });
      });
    };

    flyout.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    flyout.addEventListener('mouseleave', () => scheduleHide());

    // ── resize handle position ───────────────────────────────────────────────
    let ro = null;
    const updateHandle = () => {
      if (!asideRef.current) return;
      if (isCollapsed.current) { setHandleLeft(COLLAPSED_WIDTH - 3); return; }
      const w = asideRef.current.getBoundingClientRect().width;
      setHandleLeft(w > 50 ? w - 3 : -999);
    };

    // ── attach to aside ──────────────────────────────────────────────────────
    const attach = () => {
      const el = document.querySelector('.theme-doc-sidebar-container');
      if (!el) return;
      const isNew = el !== asideRef.current;
      asideRef.current = el;
      if (isNew) {
        hideFlyout(); // dismiss stale flyout on real SPA navigation (new aside element)
        if (ro) ro.disconnect();
        ro = new ResizeObserver(updateHandle);
        ro.observe(el);
      }
      injectNavIcons(el);
      attachFlyoutListeners(el); // safe to call repeatedly (data-flyout-attached guard)
      updateHandle();
      const tocEl = document.querySelector('.theme-doc-toc-desktop');
      if (tocEl) injectTocProgress(tocEl);
    };

    attach();

    // ── Reading progress bar ─────────────────────────────────────────────────
    const updateProgress = () => {
      const fill = document.querySelector('.toc-reading-progress-fill');
      if (!fill) return;
      const scrollH = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = scrollH > 0 ? (window.scrollY / scrollH) * 100 : 0;
      fill.style.width = Math.min(100, pct) + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    // Re-attach / re-inject after SPA navigation or React re-renders
    let debounceTimer = null;
    const mo = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const aside = asideRef.current;
        if (aside) injectNavIcons(aside);
        if (aside) attachFlyoutListeners(aside); // pick up newly rendered lazy-loaded items
        attach(); // finds new aside on doc page navigation (hideFlyout called inside if new aside)
        const tocEl = document.querySelector('.theme-doc-toc-desktop');
        if (tocEl && !tocEl.querySelector('.toc-reading-progress')) injectTocProgress(tocEl);
        updateProgress(); // sync progress bar after navigation
      }, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (ro) ro.disconnect();
      mo.disconnect();
      clearTimeout(debounceTimer);
      clearTimeout(hideTimer);
      flyout.remove();
      window.removeEventListener('scroll', updateProgress);
    };
  }, []);

  // Drag-to-resize handler (noop when collapsed)
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0 || isCollapsed.current) return;
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('sidebar-resizing');

    const onMove = (ev) => {
      const w = Math.max(150, Math.min(800, ev.clientX));
      savedWidth.current = w;
      document.documentElement.style.setProperty('--doc-sidebar-width', w + 'px');
      setHandleLeft(w - 3);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('sidebar-resizing');
      localStorage.setItem('sidebarWidth', savedWidth.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  return (
    <div style={{ '--sidebar-handle-left': handleLeft + 'px' }}>
      <div
        className="sidebar-resize-handle"
        onMouseDown={onMouseDown}
      />
      <button
        className="sidebar-edge-toggle"
        type="button"
        onClick={() => {
          if (isCollapsed.current) expandItRef.current?.();
          else collapseItRef.current?.();
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        dangerouslySetInnerHTML={{ __html: collapsed ? SVG_PANEL_OPEN : SVG_PANEL_CLOSE }}
      />
    </div>
  );
}

// ── Diagram zoom modal ────────────────────────────────────────────────────────

function DiagramModal({ svgContent: { html, dark }, onClose }) {
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const contentRef = useRef(null);
  const dragRef    = useRef({ active: false, x: 0, y: 0 });
  const stateRef   = useRef({ scale: 1, offset: { x: 0, y: 0 } });

  const PAN_STEP = 40;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')             { onClose(); return; }
      if (e.key === '=' || e.key === '+') { setScale(s => Math.min(6, +(s + 0.2).toFixed(2))); return; }
      if (e.key === '-')                  { setScale(s => Math.max(0.2, +(s - 0.2).toFixed(2))); return; }
      if (e.key === '0')                  { setScale(1); setOffset({ x: 0, y: 0 }); return; }
      if (e.key === 'ArrowLeft')          { setOffset(o => ({ ...o, x: o.x + PAN_STEP })); return; }
      if (e.key === 'ArrowRight')         { setOffset(o => ({ ...o, x: o.x - PAN_STEP })); return; }
      if (e.key === 'ArrowUp')            { setOffset(o => ({ ...o, y: o.y + PAN_STEP })); return; }
      if (e.key === 'ArrowDown')          { setOffset(o => ({ ...o, y: o.y - PAN_STEP })); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const onWheel = (e) => {
      e.preventDefault();
      const { scale: s, offset: o } = stateRef.current;
      const d         = e.deltaY < 0 ? 0.12 : -0.12;
      const newScale  = Math.min(6, Math.max(0.2, +(s + d).toFixed(2)));
      const ratio     = newScale / s;
      const cx        = window.innerWidth  / 2;
      const cy        = window.innerHeight / 2;
      const newOffset = {
        x: (e.clientX - cx) * (1 - ratio) + o.x * ratio,
        y: (e.clientY - cy) * (1 - ratio) + o.y * ratio,
      };
      stateRef.current = { scale: newScale, offset: newOffset };
      setScale(newScale);
      setOffset(newOffset);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    if (!dragRef.current.active) return;
    setOffset(o => ({
      x: o.x + (e.clientX - dragRef.current.x),
      y: o.y + (e.clientY - dragRef.current.y),
    }));
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
  };

  const onMouseUp = (e) => {
    dragRef.current.active = false;
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'fixed', top: 14, right: 18,
          background: '#fff', color: '#222', border: 'none', borderRadius: '50%',
          width: 34, height: 34, fontSize: 20, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
          zIndex: 10001,
        }}
      >
        ×
      </button>
      <div
        style={{
          position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '5px 14px', borderRadius: 20, fontSize: 12,
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          zIndex: 10001,
        }}
      >
        Scroll/+− to zoom · Drag/arrows to pan · 0 to reset · Esc to close
      </div>
      <div
        ref={contentRef}
        onClick={e => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          background: dark ? '#1e1e1e' : '#fff',
          borderRadius: 8, padding: 24,
          cursor: 'grab', userSelect: 'none',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          lineHeight: 0,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Root({ children }) {
  const [svgContent, setSvgContent] = useState(null);

  useEffect(() => {
    const onClick = (e) => {
      const container = e.target.closest('.docusaurus-mermaid-container');
      if (!container) return;
      const svg = container.querySelector('svg');
      if (!svg) return;
      const { width, height } = svg.getBoundingClientRect();
      const maxW  = window.innerWidth  * 0.82;
      const maxH  = window.innerHeight * 0.78;
      const scale = Math.min(maxW / width, maxH / height);
      const clone = svg.cloneNode(true);
      clone.setAttribute('width',  Math.round(width  * scale) + 'px');
      clone.setAttribute('height', Math.round(height * scale) + 'px');
      clone.style.display = 'block';
      const isDark = document.documentElement.dataset.theme === 'dark';
      setSvgContent({ html: clone.outerHTML, dark: isDark });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const close = useCallback(() => setSvgContent(null), []);

  return (
    <>
      {children}
      <SidebarManager />
      {svgContent && <DiagramModal svgContent={svgContent} onClose={close} />}
    </>
  );
}

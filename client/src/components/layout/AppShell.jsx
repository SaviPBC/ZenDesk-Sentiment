import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppShell.module.css';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/insights', label: 'Insights' },
  { to: '/content-search', label: 'Content Search' },
  { label: '──────────', divider: true },
  { to: '/help-center', label: 'Help Center', exact: true },
  { to: '/help-center/articles', label: '  Article Audit' },
  { to: '/help-center/gaps', label: '  Gap Analysis' },
  { to: '/help-center/improvements', label: '  Improvements' },
  { to: '/help-center/discoverability', label: '  Discoverability' },
  { to: '/help-center/freshness', label: '  Freshness' },
  { label: '──────────', divider: true },
  { to: '/settings', label: 'Settings' },
];

export default function AppShell() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          <span>ZenDesk Analytics</span>
        </div>
        <nav className={styles.nav}>
          {NAV_LINKS.map((link, i) =>
            link.divider ? (
              <div key={i} style={{ borderTop: '1px solid var(--color-border)', margin: '6px 0', opacity: 0.4 }} />
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
              >
                {link.label}
              </NavLink>
            )
          )}
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

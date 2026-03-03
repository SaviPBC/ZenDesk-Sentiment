import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppShell.module.css';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/insights', label: 'Insights' },
  { to: '/content-search', label: 'Content Search' },
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
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

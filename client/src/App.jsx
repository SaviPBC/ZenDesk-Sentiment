import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import Insights from './pages/Insights';
import ContentSearch from './pages/ContentSearch';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import HelpCenterArticles from './pages/HelpCenterArticles';
import HelpCenterGaps from './pages/HelpCenterGaps';
import HelpCenterImprovements from './pages/HelpCenterImprovements';
import HelpCenterDiscoverability from './pages/HelpCenterDiscoverability';
import HelpCenterFreshness from './pages/HelpCenterFreshness';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/content-search" element={<ContentSearch />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/help-center/articles" element={<HelpCenterArticles />} />
          <Route path="/help-center/gaps" element={<HelpCenterGaps />} />
          <Route path="/help-center/improvements" element={<HelpCenterImprovements />} />
          <Route path="/help-center/discoverability" element={<HelpCenterDiscoverability />} />
          <Route path="/help-center/freshness" element={<HelpCenterFreshness />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

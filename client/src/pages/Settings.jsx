import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useSettings, useSaveSettings, useTestConnection } from '../hooks/useSettings';
import DateRangePicker from '../components/shared/DateRangePicker';
import SyncButton from '../components/shared/SyncButton';

export default function Settings() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: save, isPending: isSaving } = useSaveSettings();
  const { mutate: testConn, isPending: isTesting, data: testResult, reset: resetTest } = useTestConnection();

  const [form, setForm] = useState({
    zendesk_subdomain: '',
    zendesk_email: '',
    zendesk_api_token: '',
    anthropic_api_key: '',
    category_field_id: '',
    subcategory_field_id: '',
    bh_start_hour: '9',
    bh_end_hour: '17',
    bh_work_days: '1,2,3,4,5',
    bh_timezone: 'UTC',
  });

  const [syncFrom, setSyncFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [syncTo, setSyncTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setForm({
        zendesk_subdomain: settings.zendesk_subdomain || '',
        zendesk_email: settings.zendesk_email || '',
        zendesk_api_token: '',  // always blank (don't show masked)
        anthropic_api_key: '',   // always blank
        category_field_id: settings.category_field_id || '',
        subcategory_field_id: settings.subcategory_field_id || '',
        bh_start_hour: settings.bh_start_hour || '9',
        bh_end_hour: settings.bh_end_hour || '17',
        bh_work_days: settings.bh_work_days || '1,2,3,4,5',
        bh_timezone: settings.bh_timezone || 'UTC',
      });
    }
  }, [settings]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    resetTest();
  }

  const BH_DAYS = [
    { label: 'Sun', value: '0' },
    { label: 'Mon', value: '1' },
    { label: 'Tue', value: '2' },
    { label: 'Wed', value: '3' },
    { label: 'Thu', value: '4' },
    { label: 'Fri', value: '5' },
    { label: 'Sat', value: '6' },
  ];

  function toggleWorkDay(dayVal) {
    const current = form.bh_work_days ? form.bh_work_days.split(',').filter(Boolean) : [];
    const updated = current.includes(dayVal)
      ? current.filter((d) => d !== dayVal)
      : [...current, dayVal].sort();
    setForm((f) => ({ ...f, bh_work_days: updated.join(',') }));
  }

  function handleSave(e) {
    e.preventDefault();
    const payload = {
      zendesk_subdomain: form.zendesk_subdomain,
      zendesk_email: form.zendesk_email,
      category_field_id: form.category_field_id,
      subcategory_field_id: form.subcategory_field_id,
      bh_start_hour: form.bh_start_hour,
      bh_end_hour: form.bh_end_hour,
      bh_work_days: form.bh_work_days,
      bh_timezone: form.bh_timezone,
    };
    if (form.zendesk_api_token) payload.zendesk_api_token = form.zendesk_api_token;
    if (form.anthropic_api_key) payload.anthropic_api_key = form.anthropic_api_key;

    save(payload, {
      onSuccess: () => {
        setSavedMsg('Settings saved.');
        setTimeout(() => setSavedMsg(''), 3000);
      },
    });
  }

  function handleTest() {
    testConn({
      zendesk_subdomain: form.zendesk_subdomain,
      zendesk_email: form.zendesk_email,
      zendesk_api_token: form.zendesk_api_token || undefined,
    });
  }

  if (isLoading) return <p className="text-muted">Loading…</p>;

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '22px', marginBottom: '1.5rem' }}>Settings</h1>

      <form onSubmit={handleSave}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="section-title">ZenDesk Credentials</p>

          <div className="form-group">
            <label>Subdomain</label>
            <input
              className="form-control"
              name="zendesk_subdomain"
              value={form.zendesk_subdomain}
              onChange={handleChange}
              placeholder="yourcompany"
            />
            <small className="text-muted">e.g. yourcompany → yourcompany.zendesk.com</small>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              className="form-control"
              name="zendesk_email"
              type="email"
              value={form.zendesk_email}
              onChange={handleChange}
              placeholder="you@company.com"
            />
          </div>

          <div className="form-group">
            <label>
              API Token
              {settings?.has_zendesk_token && !form.zendesk_api_token && (
                <span style={{ marginLeft: '8px', color: 'var(--color-positive)', fontWeight: 400 }}>
                  (saved)
                </span>
              )}
            </label>
            <input
              className="form-control"
              name="zendesk_api_token"
              type="password"
              value={form.zendesk_api_token}
              onChange={handleChange}
              placeholder={settings?.has_zendesk_token ? 'Leave blank to keep current' : 'Paste API token'}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={isTesting || !form.zendesk_subdomain || !form.zendesk_email}
            >
              {isTesting ? 'Testing…' : 'Test Connection'}
            </button>

            {testResult && (
              <span
                style={{
                  alignSelf: 'center',
                  fontSize: '13px',
                  color: testResult.success ? 'var(--color-positive)' : 'var(--color-negative)',
                }}
              >
                {testResult.success
                  ? `Connected as ${testResult.user?.name || 'unknown'}`
                  : `Failed: ${testResult.error}`}
              </span>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="section-title">Anthropic</p>
          <div className="form-group">
            <label>
              API Key
              {settings?.has_anthropic_key && !form.anthropic_api_key && (
                <span style={{ marginLeft: '8px', color: 'var(--color-positive)', fontWeight: 400 }}>
                  (saved)
                </span>
              )}
            </label>
            <input
              className="form-control"
              name="anthropic_api_key"
              type="password"
              value={form.anthropic_api_key}
              onChange={handleChange}
              placeholder={settings?.has_anthropic_key ? 'Leave blank to keep current' : 'sk-ant-…'}
            />
          </div>
        </div>

        <div className="card" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="section-title">Custom Fields</p>
          <p className="text-muted" style={{ fontSize: '13px' }}>
            Find field IDs in ZenDesk Admin → Objects and Rules → Tickets → Fields. Hover a field and note the ID in the URL.
          </p>

          <div className="form-group">
            <label>Category Field ID</label>
            <input
              className="form-control"
              name="category_field_id"
              value={form.category_field_id}
              onChange={handleChange}
              placeholder="e.g. 12345678"
            />
          </div>

          <div className="form-group">
            <label>Subcategory Field ID</label>
            <input
              className="form-control"
              name="subcategory_field_id"
              value={form.subcategory_field_id}
              onChange={handleChange}
              placeholder="e.g. 87654321"
            />
          </div>
        </div>

        <div className="card" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="section-title">Business Hours</p>
          <p className="text-muted" style={{ fontSize: '13px' }}>
            Used to calculate resolution and first reply times in business hours on the dashboard. Times are evaluated in UTC.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '120px' }}>
              <label>Start Hour (0–23)</label>
              <input
                className="form-control"
                name="bh_start_hour"
                type="number"
                min="0"
                max="23"
                value={form.bh_start_hour}
                onChange={handleChange}
              />
            </div>
            <div className="form-group" style={{ flex: '1', minWidth: '120px' }}>
              <label>End Hour (0–23)</label>
              <input
                className="form-control"
                name="bh_end_hour"
                type="number"
                min="0"
                max="23"
                value={form.bh_end_hour}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Work Days</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '4px' }}>
              {BH_DAYS.map(({ label, value }) => {
                const active = (form.bh_work_days || '').split(',').includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleWorkDay(value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: active ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Timezone</label>
            <input
              className="form-control"
              name="bh_timezone"
              value={form.bh_timezone}
              onChange={handleChange}
              placeholder="UTC"
            />
            <small className="text-muted">IANA timezone name, e.g. America/New_York, America/Chicago, UTC</small>
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Settings'}
          </button>
          {savedMsg && <span style={{ color: 'var(--color-positive)', fontSize: '13px' }}>{savedMsg}</span>}
        </div>
      </form>

      <div className="card" style={{ marginTop: '2rem' }}>
        <p className="section-title" style={{ marginBottom: '1rem' }}>Sync Data</p>
        <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '13px' }}>
          Select a date range to fetch tickets from ZenDesk and run sentiment analysis.
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <DateRangePicker
            from={syncFrom}
            to={syncTo}
            onChange={(f, t) => { setSyncFrom(f); setSyncTo(t); }}
          />
        </div>
        <SyncButton from={syncFrom} to={syncTo} />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editService, setEditService] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [testing, setTesting] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { loadKeys(); }, []);

  const loadKeys = async () => {
    try {
      const res = await api.getApiKeys();
      setKeys(res.data);
    } catch {}
    setLoading(false);
  };

  const handleUpdate = async (service) => {
    try {
      await api.updateApiKey(service, { key: newKey });
      setMsg(`${service} API key updated`);
      setEditService(null);
      setNewKey('');
      loadKeys();
    } catch (err) { setMsg(err.error || 'Update failed'); }
  };

  const handleTest = async (service) => {
    setTesting(service);
    try {
      const res = await api.testApiKey(service);
      setMsg(`${service}: ${res.data.message} (${res.data.result})`);
      loadKeys();
    } catch (err) { setMsg(err.error || 'Test failed'); }
    setTesting('');
  };

  const handleClear = async (service) => {
    if (!confirm(`Clear API key for ${service}?`)) return;
    try {
      await api.clearApiKey(service);
      setMsg(`${service} API key cleared`);
      loadKeys();
    } catch (err) { setMsg(err.error || 'Clear failed'); }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>API Key Management</h1>
          <p className="text-muted">Configure external AI service API keys</p>
        </div>
      </div>

      {msg && <div className="alert alert-info" onClick={() => setMsg('')}>{msg} (click to dismiss)</div>}

      <div className="api-keys-grid">
        {keys.map(k => (
          <div key={k.service} className="card api-key-card">
            <div className="api-key-header">
              <div>
                <h3>{k.name}</h3>
                <p className="text-muted text-sm">{k.description}</p>
              </div>
              <span className={`status-dot ${k.isConfigured ? 'green' : 'gray'}`} />
            </div>

            <div className="api-key-details">
              <div className="api-key-row">
                <span className="text-muted">Status:</span>
                <span className={k.isConfigured ? 'text-green' : 'text-muted'}>{k.isConfigured ? 'Configured' : 'Not configured'}</span>
              </div>
              {k.maskedKey && (
                <div className="api-key-row">
                  <span className="text-muted">Key:</span>
                  <code>{k.maskedKey}</code>
                </div>
              )}
              <div className="api-key-row">
                <span className="text-muted">Usage:</span>
                <span>{k.usageCount} calls</span>
              </div>
              {k.lastTested && (
                <div className="api-key-row">
                  <span className="text-muted">Last Test:</span>
                  <span className={k.lastTestResult === 'success' ? 'text-green' : 'text-red'}>
                    {k.lastTestResult} - {new Date(k.lastTested).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {editService === k.service ? (
              <div className="api-key-edit">
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={`Enter ${k.name} API key`} className="api-key-input" />
                <div className="btn-group">
                  <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(k.service)}>Save</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setEditService(null); setNewKey(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="btn-group api-key-actions">
                <button className="btn btn-sm btn-primary" onClick={() => setEditService(k.service)}>
                  {k.isConfigured ? 'Update Key' : 'Add Key'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => handleTest(k.service)} disabled={testing === k.service}>
                  {testing === k.service ? 'Testing...' : 'Test'}
                </button>
                {k.isConfigured && (
                  <button className="btn btn-sm btn-danger-ghost" onClick={() => handleClear(k.service)}>Clear</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

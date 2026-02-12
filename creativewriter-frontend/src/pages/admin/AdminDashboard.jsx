import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard().then(res => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!data) return <div className="page"><div className="alert alert-error">Failed to load dashboard</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
      </div>

      <div className="stat-grid stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon blue">👥</div>
          <div className="stat-info">
            <span className="stat-value">{data.stats.users.total}</span>
            <span className="stat-label">Total Users</span>
            <span className="stat-sub">{data.stats.users.active} active</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">🎵</div>
          <div className="stat-info">
            <span className="stat-value">{data.stats.lyrics.total}</span>
            <span className="stat-label">Total Lyrics</span>
            <span className="stat-sub">{data.stats.lyrics.today} today</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🔑</div>
          <div className="stat-info">
            <span className="stat-value">{data.stats.apis.configured}/{data.stats.apis.total}</span>
            <span className="stat-label">APIs Configured</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">👑</div>
          <div className="stat-info">
            <span className="stat-value">{data.stats.users.byRole?.admin || 0}</span>
            <span className="stat-label">Admin Users</span>
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="card">
          <div className="card-header">
            <h3>API Services</h3>
            <Link to="/admin/apikeys" className="btn btn-sm btn-ghost">Manage</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Service</th><th>Status</th><th>Last Tested</th></tr></thead>
            <tbody>
              {data.apiStatus.map(k => (
                <tr key={k.service}>
                  <td><strong>{k.name}</strong></td>
                  <td>
                    <span className={`status-dot ${k.isConfigured ? 'green' : 'gray'}`} />
                    {k.isConfigured ? 'Configured' : 'Not set'}
                  </td>
                  <td className="text-muted text-sm">
                    {k.lastTested ? `${k.lastTestResult} - ${new Date(k.lastTested).toLocaleDateString()}` : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Users</h3>
            <Link to="/admin/users" className="btn btn-sm btn-ghost">View All</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {data.recent.users.map(u => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong><br/><span className="text-muted text-sm">{u.email}</span></td>
                  <td><span className={`tag tag-sm ${u.role === 'admin' ? 'tag-purple' : 'tag-green'}`}>{u.role}</span></td>
                  <td className="text-muted text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.recent.lyrics.length > 0 && (
        <div className="card">
          <h3>Recent Lyrics</h3>
          <table className="data-table">
            <thead><tr><th>Title</th><th>Style</th><th>Dialect</th><th>Author</th><th>Date</th></tr></thead>
            <tbody>
              {data.recent.lyrics.map(l => (
                <tr key={l._id}>
                  <td><strong>{l.title}</strong></td>
                  <td><span className="tag tag-sm">{l.style}</span></td>
                  <td><span className="tag tag-sm">{l.dialect}</span></td>
                  <td className="text-muted">{l.user?.name || 'Unknown'}</td>
                  <td className="text-muted text-sm">{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

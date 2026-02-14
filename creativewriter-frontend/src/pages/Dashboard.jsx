import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import UsageIndicator from '../components/UsageIndicator';
import api from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const { currentPlan, subscription } = useSubscription();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, lyricsRes] = await Promise.all([
        api.getLyricsStats(),
        api.getMyLyrics({ limit: 5 })
      ]);
      setStats(statsRes.data);
      setRecent(lyricsRes.data);
    } catch {}
    setLoading(false);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-muted">Here's your creative overview</p>
        </div>
        <Link to="/generate" className="btn btn-primary">+ Generate New Lyrics</Link>
      </div>

      {/* Current Plan Card */}
      {currentPlan && (
        <div className="card dash-plan-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{currentPlan.name} Plan</h3>
              <span className={`tag ${subscription?.status === 'active' ? 'tag-green' : 'tag-purple'}`} style={{ textTransform: 'capitalize' }}>
                {subscription?.status || 'active'}
              </span>
            </div>
            <Link to="/pricing" className="btn btn-sm btn-primary">
              {currentPlan.tier === 'free' ? 'Upgrade' : 'Change Plan'}
            </Link>
          </div>
          <div className="usage-grid">
            <UsageIndicator type="lyrics" />
            <UsageIndicator type="music" />
            <UsageIndicator type="video" />
            <UsageIndicator type="voice" />
          </div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">🎵</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.totalLyrics || 0}</span>
            <span className="stat-label">Total Lyrics</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📝</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.totalWords || 0}</span>
            <span className="stat-label">Total Words</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon pink">❤️</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.favorites || 0}</span>
            <span className="stat-label">Favorites</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📊</div>
          <div className="stat-info">
            <span className="stat-value">{user?.stats?.lyricsGenerated || 0}</span>
            <span className="stat-label">Generated</span>
          </div>
        </div>
      </div>

      {stats?.styleBreakdown && Object.keys(stats.styleBreakdown).length > 0 && (
        <div className="card">
          <h3>Style Breakdown</h3>
          <div className="tag-grid">
            {Object.entries(stats.styleBreakdown).map(([style, count]) => (
              <span key={style} className="tag">{style} <strong>{count}</strong></span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Recent Lyrics</h3>
          <Link to="/lyrics" className="btn btn-sm btn-ghost">View All</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <p>No lyrics yet. Start creating!</p>
            <Link to="/generate" className="btn btn-primary btn-sm">Generate Your First Lyrics</Link>
          </div>
        ) : (
          <div className="lyrics-list">
            {recent.map(l => (
              <Link to={`/lyrics/${l._id}`} key={l._id} className="lyrics-card">
                <div className="lyrics-card-header">
                  <h4>{l.title}</h4>
                  {l.isFavorite && <span className="fav-icon">❤️</span>}
                </div>
                <div className="lyrics-card-meta">
                  <span className="tag tag-sm">{l.style}</span>
                  <span className="tag tag-sm">{l.dialect}</span>
                  <span className="text-muted text-sm">{new Date(l.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

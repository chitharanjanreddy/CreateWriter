import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function PublicLyrics() {
  const [lyrics, setLyrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getPublicLyrics(20).then(res => setLyrics(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page public-page">
      <div className="page-header">
        <div>
          <h1>🎵 Explore Telugu Lyrics</h1>
          <p className="text-muted">Popular public lyrics from the community</p>
        </div>
        <div className="btn-group">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
        </div>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : lyrics.length === 0 ? (
        <div className="empty-state card"><p>No public lyrics yet. Be the first to share!</p></div>
      ) : (
        <div className="public-layout">
          <div className="public-list">
            {lyrics.map(l => (
              <div key={l._id} className={`public-card ${selected?._id === l._id ? 'active' : ''}`} onClick={() => setSelected(l)}>
                <h4>{l.title}</h4>
                <div className="lyrics-card-meta">
                  <span className="tag tag-sm">{l.style}</span>
                  <span className="tag tag-sm">{l.dialect}</span>
                  {l.rating && <span className="rating text-sm">{'⭐'.repeat(l.rating)}</span>}
                </div>
                <span className="text-muted text-sm">by {l.user?.name || 'Anonymous'} &middot; {new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
          <div className="public-detail card">
            {selected ? (
              <>
                <h2>{selected.title}</h2>
                <div className="detail-meta">
                  <span className="tag">{selected.style}</span>
                  <span className="tag">{selected.dialect}</span>
                  <span className="text-muted">by {selected.user?.name || 'Anonymous'}</span>
                </div>
                <pre className="lyrics-display-text">{selected.content || selected.excerpt || 'Content not available in preview'}</pre>
              </>
            ) : (
              <div className="empty-state"><p>Select a lyrics to preview</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

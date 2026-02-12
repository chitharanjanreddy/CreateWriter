import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function MyLyrics() {
  const [lyrics, setLyrics] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filter, setFilter] = useState({ page: 1, limit: 12, style: '', isFavorite: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLyrics(); }, [filter.page, filter.style, filter.isFavorite]);

  const loadLyrics = async () => {
    setLoading(true);
    try {
      const params = { page: filter.page, limit: filter.limit };
      if (filter.style) params.style = filter.style;
      if (filter.isFavorite) params.isFavorite = filter.isFavorite;
      const res = await api.getMyLyrics(params);
      setLyrics(res.data);
      setPagination(res.pagination);
    } catch {}
    setLoading(false);
  };

  const handleFav = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.toggleFavorite(id);
      setLyrics(prev => prev.map(l => l._id === id ? { ...l, isFavorite: !l.isFavorite } : l));
    } catch {}
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this lyrics?')) return;
    try {
      await api.deleteLyrics(id);
      setLyrics(prev => prev.filter(l => l._id !== id));
    } catch {}
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Lyrics</h1>
          <p className="text-muted">{pagination.total || 0} lyrics saved</p>
        </div>
        <Link to="/generate" className="btn btn-primary">+ Generate New</Link>
      </div>

      <div className="filter-bar">
        <select value={filter.style} onChange={e => setFilter(f => ({ ...f, style: e.target.value, page: 1 }))}>
          <option value="">All Styles</option>
          <option value="devotional">Devotional</option>
          <option value="folk">Folk</option>
          <option value="romantic">Romantic</option>
          <option value="patriotic">Patriotic</option>
          <option value="lullaby">Lullaby</option>
          <option value="celebration">Celebration</option>
          <option value="philosophical">Philosophical</option>
          <option value="cinematic">Cinematic</option>
        </select>
        <select value={filter.isFavorite} onChange={e => setFilter(f => ({ ...f, isFavorite: e.target.value, page: 1 }))}>
          <option value="">All</option>
          <option value="true">Favorites Only</option>
        </select>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : lyrics.length === 0 ? (
        <div className="empty-state card">
          <p>No lyrics found</p>
          <Link to="/generate" className="btn btn-primary btn-sm">Generate Your First Lyrics</Link>
        </div>
      ) : (
        <>
          <div className="lyrics-grid">
            {lyrics.map(l => (
              <Link to={`/lyrics/${l._id}`} key={l._id} className="lyrics-card">
                <div className="lyrics-card-header">
                  <h4>{l.title}</h4>
                  <button className={`fav-btn ${l.isFavorite ? 'active' : ''}`} onClick={e => handleFav(l._id, e)}>
                    {l.isFavorite ? '❤️' : '🤍'}
                  </button>
                </div>
                <p className="lyrics-preview">{l.content?.substring(0, 120)}...</p>
                <div className="lyrics-card-meta">
                  <span className="tag tag-sm">{l.style}</span>
                  <span className="tag tag-sm">{l.dialect}</span>
                  {l.rating && <span className="rating">{'⭐'.repeat(l.rating)}</span>}
                </div>
                <div className="lyrics-card-footer">
                  <span className="text-muted text-sm">{new Date(l.createdAt).toLocaleDateString()}</span>
                  <button className="btn btn-sm btn-danger-ghost" onClick={e => handleDelete(l._id, e)}>Delete</button>
                </div>
              </Link>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={filter.page <= 1}
                onClick={() => setFilter(f => ({ ...f, page: f.page - 1 }))}>Previous</button>
              <span className="text-muted">Page {pagination.page} of {pagination.pages}</span>
              <button className="btn btn-sm" disabled={filter.page >= pagination.pages}
                onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function LyricsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lyrics, setLyrics] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadLyrics(); }, [id]);

  const loadLyrics = async () => {
    try {
      const res = await api.getLyricsById(id);
      setLyrics(res.data);
      setEditForm({ title: res.data.title, content: res.data.content, rating: res.data.rating || '', isPublic: res.data.isPublic, tags: res.data.tags?.join(', ') || '' });
    } catch (err) {
      setError(err.error || 'Failed to load lyrics');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      const body = { title: editForm.title, content: editForm.content, isPublic: editForm.isPublic };
      if (editForm.rating) body.rating = parseInt(editForm.rating);
      if (editForm.tags) body.tags = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await api.updateLyrics(id, body);
      setLyrics(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.error || 'Update failed');
    }
  };

  const handleFav = async () => {
    try {
      const res = await api.toggleFavorite(id);
      setLyrics(l => ({ ...l, isFavorite: res.data.isFavorite }));
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this lyrics?')) return;
    try {
      await api.deleteLyrics(id);
      navigate('/lyrics');
    } catch {}
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!lyrics) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lyrics')}>&larr; Back to My Lyrics</button>
          {editing ? (
            <input className="edit-title-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          ) : (
            <h1>{lyrics.title}</h1>
          )}
        </div>
        <div className="btn-group">
          <button className={`btn btn-sm ${lyrics.isFavorite ? 'btn-danger' : 'btn-ghost'}`} onClick={handleFav}>
            {lyrics.isFavorite ? '❤️ Favorited' : '🤍 Favorite'}
          </button>
          {editing ? (
            <>
              <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn btn-sm btn-danger" onClick={handleDelete}>Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="detail-meta">
        <span className="tag">{lyrics.styleDisplay || lyrics.style}</span>
        <span className="tag">{lyrics.dialectDisplay || lyrics.dialect}</span>
        <span className="tag">{lyrics.poetryForm}</span>
        {lyrics.isPublic && <span className="tag tag-green">Public</span>}
        {lyrics.rating && <span className="rating">{'⭐'.repeat(lyrics.rating)}</span>}
        <span className="text-muted text-sm">{lyrics.metadata?.wordCount} words &middot; {lyrics.metadata?.lineCount} lines</span>
        <span className="text-muted text-sm">{new Date(lyrics.createdAt).toLocaleString()}</span>
      </div>

      {lyrics.tags?.length > 0 && (
        <div className="tag-grid" style={{ marginBottom: 16 }}>
          {lyrics.tags.map((t, i) => <span key={i} className="tag tag-sm">#{t}</span>)}
        </div>
      )}

      {editing ? (
        <div className="card">
          <div className="form-group">
            <label>Content</label>
            <textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={20} className="lyrics-editor" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rating (1-5)</label>
              <select value={editForm.rating} onChange={e => setEditForm(f => ({ ...f, rating: e.target.value }))}>
                <option value="">No rating</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Public</label>
              <select value={editForm.isPublic} onChange={e => setEditForm(f => ({ ...f, isPublic: e.target.value === 'true' }))}>
                <option value="false">Private</option>
                <option value="true">Public</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g., spring, folk, telugu" />
          </div>
        </div>
      ) : (
        <div className="card lyrics-display">
          <pre>{lyrics.content}</pre>
        </div>
      )}

      {lyrics.generationParams && (
        <div className="card">
          <h3>Generation Info</h3>
          <div className="info-grid">
            <span className="text-muted">Model:</span><span>{lyrics.generationParams.model}</span>
            {lyrics.theme && <><span className="text-muted">Theme:</span><span>{lyrics.theme}</span></>}
            {lyrics.customLines && <><span className="text-muted">Custom Lines:</span><span>{lyrics.customLines}</span></>}
          </div>
        </div>
      )}
    </div>
  );
}

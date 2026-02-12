import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const STYLES = [
  { value: 'devotional', label: 'భక్తి - Devotional' },
  { value: 'folk', label: 'జానపద - Folk' },
  { value: 'romantic', label: 'ప్రేమ - Romantic' },
  { value: 'patriotic', label: 'దేశభక్తి - Patriotic' },
  { value: 'lullaby', label: 'జోల పాట - Lullaby' },
  { value: 'celebration', label: 'పండుగ - Celebration' },
  { value: 'philosophical', label: 'తత్వ - Philosophical' },
  { value: 'cinematic', label: 'సినిమా - Cinematic' }
];
const DIALECTS = [
  { value: 'coastal', label: 'కోస్తాంధ్ర - Coastal' },
  { value: 'telangana', label: 'తెలంగాణ - Telangana' },
  { value: 'rayalaseema', label: 'రాయలసీమ - Rayalaseema' },
  { value: 'uttarandhra', label: 'ఉత్తరాంధ్ర - Uttarandhra' }
];
const FORMS = [
  { value: 'geeyam', label: 'గేయం - Lyrical Poetry' },
  { value: 'padyam', label: 'పద్యం - Classical Verse' },
  { value: 'janapada', label: 'జానపద - Folk Poetry' },
  { value: 'keertana', label: 'కీర్తన - Devotional' },
  { value: 'modern', label: 'ఆధునిక - Modern Free Verse' }
];

export default function GenerateLyrics() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    theme: '', customLines: '', style: 'romantic', dialect: 'coastal', poetryForm: 'geeyam'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.theme && !form.customLines) {
      setError('Please provide a theme or custom lines');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await api.generateLyrics(form);
      setResult(res.data);
    } catch (err) {
      setError(err.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Generate Telugu Lyrics</h1>
          <p className="text-muted">AI-powered Telugu song lyrics generator</p>
        </div>
      </div>

      <div className="generate-layout">
        <div className="card generate-form-card">
          <h3>Configuration</h3>
          <form onSubmit={handleGenerate}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Theme / Topic</label>
              <input value={form.theme} onChange={e => set('theme', e.target.value)} placeholder="e.g., Spring season, Love, Devotion to Lord Venkateswara" />
            </div>

            <div className="form-group">
              <label>Custom Lines (optional)</label>
              <textarea value={form.customLines} onChange={e => set('customLines', e.target.value)}
                placeholder="Your own lines to incorporate into the lyrics" rows={3} />
            </div>

            <div className="form-group">
              <label>Style</label>
              <select value={form.style} onChange={e => set('style', e.target.value)}>
                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Dialect</label>
                <select value={form.dialect} onChange={e => set('dialect', e.target.value)}>
                  {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Poetry Form</label>
                <select value={form.poetryForm} onChange={e => set('poetryForm', e.target.value)}>
                  {FORMS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Lyrics'}
            </button>
          </form>
        </div>

        <div className="card generate-result-card">
          <h3>Generated Lyrics</h3>
          {loading && (
            <div className="empty-state"><div className="spinner" /><p>Generating your lyrics...</p></div>
          )}
          {!loading && !result && (
            <div className="empty-state"><p>Configure options and click Generate to create Telugu lyrics</p></div>
          )}
          {result && (
            <>
              {result.generationInfo?.isDemo && (
                <div className="alert alert-warning">Demo Mode - Configure Anthropic API key in Admin panel for AI generation</div>
              )}
              <div className="lyrics-content">
                <pre>{result.content}</pre>
              </div>
              <div className="lyrics-meta-bar">
                <span className="tag">{result.metadata?.style}</span>
                <span className="tag">{result.metadata?.dialect}</span>
                <span className="text-muted text-sm">{result.metadata?.wordCount} words, {result.metadata?.lineCount} lines</span>
              </div>
              {result.saved && (
                <div className="result-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/lyrics/${result.saved.id}`)}>
                    View Saved Lyrics
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

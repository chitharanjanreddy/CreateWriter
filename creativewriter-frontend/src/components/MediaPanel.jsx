import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function MediaPanel({ lyricsId, lyrics }) {
  const [activeTab, setActiveTab] = useState('music');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [voices, setVoices] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const audioRef = useRef(null);

  // Music config
  const [musicPlatform, setMusicPlatform] = useState('suno');
  const [tempo, setTempo] = useState('medium tempo');
  const [instrumental, setInstrumental] = useState(false);

  // Voice config
  const [voiceId, setVoiceId] = useState('');

  // Video config
  const [avatarId, setAvatarId] = useState('af78fd01567347b3a6859ea1e4a46410');

  useEffect(() => {
    api.getVoices().then(r => setVoices(r.data)).catch(() => {});
    api.getAvatars().then(r => setAvatars(r.data)).catch(() => {});
  }, []);

  const handleGenerateMusic = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api.generateMusic(lyricsId, { platform: musicPlatform, tempo, instrumental });
      setResult(res.data);
      // Poll for music status if we got a task ID
      if (res.data.id && res.data.status === 'processing') {
        pollMusicStatus(res.data.id);
      }
    } catch (err) { setError(err.error || 'Music generation failed'); }
    setLoading(false);
  };

  const pollMusicStatus = (taskId) => {
    let attempts = 0;
    const maxAttempts = 30; // ~5 minutes at 10s intervals
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.checkMusicStatus(taskId);
        const songs = res.data?.songs || [];
        if (res.data?.status === 'completed' && songs.length > 0 && songs[0].audioUrl) {
          clearInterval(interval);
          setResult(prev => ({ ...prev, status: 'completed', songs, message: 'Music is ready!' }));
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setResult(prev => ({ ...prev, message: 'Still processing. Check back later with task ID: ' + taskId }));
        }
      } catch {
        if (attempts >= maxAttempts) clearInterval(interval);
      }
    }, 10000);
  };

  const handleGenerateVideo = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api.generateVideo(lyricsId, { avatarId });
      setResult(res.data);
    } catch (err) { setError(err.error || 'Video generation failed'); }
    setLoading(false);
  };

  const handleGenerateVoice = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api.generateVoice(lyricsId, { voiceId: voiceId || undefined });
      setResult(res.data);
      // Auto-play audio if we got base64
      if (res.data.audioBase64) {
        const audio = new Audio(`data:${res.data.contentType};base64,${res.data.audioBase64}`);
        audioRef.current = audio;
      }
    } catch (err) { setError(err.error || 'Voice generation failed'); }
    setLoading(false);
  };

  const playAudio = () => {
    if (audioRef.current) audioRef.current.play();
  };

  const downloadAudio = () => {
    if (!result?.audioBase64) return;
    const link = document.createElement('a');
    link.href = `data:${result.contentType};base64,${result.audioBase64}`;
    link.download = `${lyrics?.title || 'lyrics'}-voice.mp3`;
    link.click();
  };

  return (
    <div className="card media-panel">
      <h3>Media Generation</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        Convert your lyrics into music, video, or speech
      </p>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'music' ? 'active' : ''}`} onClick={() => { setActiveTab('music'); setResult(null); setError(''); }}>
          🎵 Music (Suno/Udio)
        </button>
        <button className={`tab ${activeTab === 'video' ? 'active' : ''}`} onClick={() => { setActiveTab('video'); setResult(null); setError(''); }}>
          🎬 Video (HeyGen)
        </button>
        <button className={`tab ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => { setActiveTab('voice'); setResult(null); setError(''); }}>
          🗣️ Voice (ElevenLabs)
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Music Tab ── */}
      {activeTab === 'music' && (
        <div className="media-form">
          <div className="form-row">
            <div className="form-group">
              <label>Platform</label>
              <select value={musicPlatform} onChange={e => setMusicPlatform(e.target.value)}>
                <option value="suno">Suno AI</option>
                <option value="udio">Udio</option>
              </select>
            </div>
            <div className="form-group">
              <label>Tempo</label>
              <select value={tempo} onChange={e => setTempo(e.target.value)}>
                <option value="slow tempo">Slow</option>
                <option value="medium tempo">Medium</option>
                <option value="fast tempo">Fast</option>
                <option value="very fast">Very Fast</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={instrumental} onChange={e => setInstrumental(e.target.checked)} style={{ width: 'auto' }} />
              Instrumental only (no vocals)
            </label>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleGenerateMusic} disabled={loading}>
            {loading ? 'Generating Music...' : `Generate Music with ${musicPlatform === 'suno' ? 'Suno' : 'Udio'}`}
          </button>
        </div>
      )}

      {/* ── Video Tab ── */}
      {activeTab === 'video' && (
        <div className="media-form">
          <div className="form-group">
            <label>Avatar</label>
            <select value={avatarId} onChange={e => setAvatarId(e.target.value)}>
              {avatars.map(a => (
                <option key={a.avatar_id} value={a.avatar_id}>{a.name}</option>
              ))}
            </select>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
            The avatar will speak/perform your lyrics as a video. Video generation typically takes 2-5 minutes.
          </p>
          <button className="btn btn-primary btn-full" onClick={handleGenerateVideo} disabled={loading}>
            {loading ? 'Generating Video...' : 'Generate Video with HeyGen'}
          </button>
        </div>
      )}

      {/* ── Voice Tab ── */}
      {activeTab === 'voice' && (
        <div className="media-form">
          <div className="form-group">
            <label>Voice</label>
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}>
              <option value="">Default (Rachel)</option>
              {voices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.language})</option>
              ))}
            </select>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
            Uses ElevenLabs multilingual v2 model for Telugu speech synthesis.
          </p>
          <button className="btn btn-primary btn-full" onClick={handleGenerateVoice} disabled={loading}>
            {loading ? 'Generating Voice...' : 'Generate Voice with ElevenLabs'}
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <div className="spinner" />
          <p className="text-muted">Processing your request...</p>
        </div>
      )}

      {/* ── Result ── */}
      {result && !loading && (
        <div className="media-result">
          {result.demo ? (
            <div className="alert alert-warning">
              <strong>API Key Required</strong><br />
              {result.message}
            </div>
          ) : result.status === 'error' ? (
            <div className="alert alert-error">
              <strong>Error:</strong> {result.message}
            </div>
          ) : (
            <div className="alert alert-success">
              {/* Music result */}
              {result.platform === 'suno' || result.platform === 'udio' ? (
                <>
                  <strong>Music generation {result.status === 'processing' ? 'started' : result.status}!</strong>
                  {result.status === 'processing' && (
                    <p style={{ marginTop: 4 }}>
                      <span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                      Generating your music... This may take 1-3 minutes.
                    </p>
                  )}
                  {result.songs?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {result.songs.map((song, i) => (
                        <div key={i} style={{ background: '#0a0e1a', border: '1px solid #1e293b', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            {song.imageUrl && <img src={song.imageUrl} alt={song.title} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              {song.title && <p style={{ fontWeight: 600, marginBottom: 4, color: '#f8fafc' }}>{song.title}</p>}
                              {song.duration && <p className="text-sm text-muted">{Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, '0')}</p>}
                              {song.tags && <p className="text-sm text-muted" style={{ marginTop: 2 }}>{song.tags}</p>}
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            {(song.audioUrl || song.streamAudioUrl) && (
                              <audio
                                controls
                                style={{ width: '100%', height: 40 }}
                                src={song.streamAudioUrl || song.audioUrl}
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  // Fallback: try the other URL if first fails
                                  const el = e.target;
                                  const alt = song.audioUrl && el.src !== song.audioUrl ? song.audioUrl : song.streamAudioUrl;
                                  if (alt && el.src !== alt) el.src = alt;
                                }}
                              />
                            )}
                            <div className="btn-group" style={{ marginTop: 8 }}>
                              {song.id && (
                                <a href={`https://suno.com/song/${song.id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{ color: 'white' }}>
                                  Play on Suno
                                </a>
                              )}
                              {song.audioUrl && (
                                <a href={song.audioUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                                  Download MP3
                                </a>
                              )}
                              {song.streamAudioUrl && (
                                <a href={song.streamAudioUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                                  Stream
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.id && <p className="text-sm text-muted" style={{ marginTop: 4 }}>Task ID: {result.id}</p>}
                </>
              ) : null}

              {/* Video result */}
              {result.platform === 'heygen' ? (
                <>
                  <strong>Video generation {result.status}!</strong>
                  <p style={{ marginTop: 4 }}>{result.message}</p>
                  {result.videoId && <p className="text-sm" style={{ marginTop: 4 }}>Video ID: {result.videoId}</p>}
                </>
              ) : null}

              {/* Voice result */}
              {result.platform === 'elevenlabs' && result.audioBase64 ? (
                <>
                  <strong>Voice generated successfully!</strong>
                  <div className="btn-group" style={{ marginTop: 12 }}>
                    <button className="btn btn-sm btn-primary" onClick={playAudio}>▶ Play Audio</button>
                    <button className="btn btn-sm btn-ghost" onClick={downloadAudio}>⬇ Download MP3</button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Previous Media ── */}
      {(lyrics?.musicGenerated?.url || lyrics?.videoGenerated?.url) && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8 }}>Previously Generated</h4>
          {lyrics.musicGenerated?.url && (
            <div className="media-prev-item">
              <span>🎵 Music ({lyrics.musicGenerated.platform})</span>
              <a href={lyrics.musicGenerated.url} target="_blank" rel="noreferrer" className="btn btn-xs btn-ghost">Open</a>
            </div>
          )}
          {lyrics.videoGenerated?.url && (
            <div className="media-prev-item">
              <span>🎬 Video ({lyrics.videoGenerated.platform})</span>
              <span className="text-muted text-sm">ID: {lyrics.videoGenerated.url}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

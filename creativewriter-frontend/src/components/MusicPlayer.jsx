import { useState, useRef, useEffect } from 'react';

export default function MusicPlayer({ songs }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  const song = songs[currentIndex];
  const audioUrl = song?.audioUrl || song?.streamAudioUrl;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (currentIndex < songs.length - 1) {
        setCurrentIndex(i => i + 1);
        setPlaying(true);
      } else {
        setPlaying(false);
      }
    };
    const onError = () => {
      // Try alternate URL
      const alt = song?.streamAudioUrl && audio.src !== song.streamAudioUrl
        ? song.streamAudioUrl
        : song?.audioUrl && audio.src !== song.audioUrl
        ? song.audioUrl
        : null;
      if (alt) {
        audio.src = alt;
        if (playing) audio.play().catch(() => {});
      } else {
        setError('Unable to load audio. Try "View on Suno" link below.');
        setPlaying(false);
      }
    };
    const onCanPlay = () => setError('');

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [currentIndex, songs, playing, song]);

  // Load new source when song changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.src = audioUrl;
    audio.volume = volume;
    if (playing) audio.play().catch(() => {});
  }, [currentIndex, audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {
        setError('Playback failed. Try "View on Suno" link.');
      });
    }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const changeVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const prevTrack = () => { if (currentIndex > 0) { setCurrentIndex(i => i - 1); setPlaying(true); } };
  const nextTrack = () => { if (currentIndex < songs.length - 1) { setCurrentIndex(i => i + 1); setPlaying(true); } };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!songs?.length) return null;

  return (
    <div className="music-player">
      <audio ref={audioRef} preload="auto" />

      {/* Song info */}
      <div className="mp-info">
        {song?.imageUrl && <img src={song.imageUrl} alt="" className="mp-cover" />}
        <div className="mp-details">
          <p className="mp-title">{song?.title || 'Untitled'}</p>
          {song?.tags && <p className="mp-tags">{song.tags}</p>}
          {songs.length > 1 && <p className="mp-tags">Track {currentIndex + 1} of {songs.length}</p>}
        </div>
      </div>

      {error && <p style={{ color: '#fca5a5', fontSize: 12, margin: '6px 0' }}>{error}</p>}

      {/* Controls */}
      <div className="mp-controls">
        {songs.length > 1 && (
          <button className="mp-btn" onClick={prevTrack} disabled={currentIndex === 0}>⏮</button>
        )}
        <button className="mp-btn mp-play" onClick={togglePlay}>
          {playing ? '⏸' : '▶'}
        </button>
        {songs.length > 1 && (
          <button className="mp-btn" onClick={nextTrack} disabled={currentIndex === songs.length - 1}>⏭</button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mp-progress-wrap">
        <span className="mp-time">{fmt(currentTime)}</span>
        <div className="mp-progress" onClick={seek}>
          <div className="mp-progress-bar" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
        </div>
        <span className="mp-time">{fmt(duration || song?.duration)}</span>
      </div>

      {/* Volume + actions */}
      <div className="mp-footer">
        <div className="mp-volume">
          <span style={{ fontSize: 14 }}>{volume > 0 ? '🔊' : '🔇'}</span>
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={changeVolume} className="mp-volume-slider" />
        </div>
        <div className="btn-group">
          {song?.audioUrl && (
            <a href={song.audioUrl} download={`${song.title || 'song'}.mp3`} className="btn btn-xs btn-ghost">
              Download
            </a>
          )}
          {song?.id && (
            <a href={`https://suno.com/song/${song.id}`} target="_blank" rel="noreferrer" className="btn btn-xs btn-ghost">
              View on Suno
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

import { useSubscription } from '../context/SubscriptionContext';

/**
 * Reusable usage progress bar component
 * @param {string} type - 'lyrics', 'music', 'video', 'voice'
 * @param {boolean} compact - Show compact version
 */
export default function UsageIndicator({ type, compact = false }) {
  const { getRemaining, currentPlan } = useSubscription();
  const info = getRemaining(type);

  if (!currentPlan) return null;

  const labels = {
    lyrics: 'Lyrics',
    music: 'Music',
    video: 'Video',
    voice: 'Voice'
  };

  const label = labels[type] || type;

  // Unlimited
  if (info.limit === -1) {
    if (compact) return <span className="usage-badge usage-unlimited">Unlimited {label}</span>;
    return (
      <div className="usage-indicator">
        <div className="usage-header">
          <span className="usage-label">{label}</span>
          <span className="usage-count">Unlimited</span>
        </div>
        <div className="usage-bar"><div className="usage-fill unlimited" /></div>
      </div>
    );
  }

  // Not available (limit = 0)
  if (info.limit === 0) {
    if (compact) return <span className="usage-badge usage-unavailable">No {label}</span>;
    return (
      <div className="usage-indicator">
        <div className="usage-header">
          <span className="usage-label">{label}</span>
          <span className="usage-count">Not available</span>
        </div>
        <div className="usage-bar"><div className="usage-fill unavailable" /></div>
        <span className="usage-hint">Upgrade to access {label.toLowerCase()} generation</span>
      </div>
    );
  }

  const pct = Math.min(100, (info.current / info.limit) * 100);
  const isLow = info.remaining <= Math.ceil(info.limit * 0.2);
  const isExhausted = info.remaining === 0;

  if (compact) {
    return (
      <span className={`usage-badge ${isExhausted ? 'usage-exhausted' : isLow ? 'usage-low' : 'usage-ok'}`}>
        {info.remaining}/{info.limit} {label}
      </span>
    );
  }

  return (
    <div className="usage-indicator">
      <div className="usage-header">
        <span className="usage-label">{label}</span>
        <span className="usage-count">{info.current} / {info.limit}</span>
      </div>
      <div className="usage-bar">
        <div
          className={`usage-fill ${isExhausted ? 'exhausted' : isLow ? 'low' : 'ok'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isExhausted && <span className="usage-hint exhausted">Limit reached - upgrade for more</span>}
      {isLow && !isExhausted && <span className="usage-hint low">{info.remaining} remaining</span>}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-logo">🎵</span>
          <h1>CreativeWriter</h1>
          <p>Telugu Lyrics Generator</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Sign In</h2>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Sign Up</Link></p>
            <Link to="/explore" className="explore-link">Browse public lyrics</Link>
          </div>
        </form>

        <div className="quick-login">
          <span className="quick-label">Quick Login:</span>
          <button type="button" onClick={() => quickLogin('admin@akashinnotech.com', 'Admin@123')} className="btn btn-sm">Admin</button>
          <button type="button" onClick={() => quickLogin('ramu@example.com', 'User@123')} className="btn btn-sm">Ramu</button>
          <button type="button" onClick={() => quickLogin('lakshmi@example.com', 'User@123')} className="btn btn-sm">Lakshmi</button>
          <button type="button" onClick={() => quickLogin('krishna@example.com', 'User@123')} className="btn btn-sm">Krishna</button>
        </div>
      </div>
    </div>
  );
}

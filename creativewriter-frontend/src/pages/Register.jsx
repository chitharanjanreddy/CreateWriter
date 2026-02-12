import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', organization: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      setError(err.error || err.errors?.map(e => e.message).join(', ') || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-logo">🎵</span>
          <h1>CreativeWriter</h1>
          <p>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Sign Up</h2>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Full Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" required minLength={6} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label>Organization</label>
              <input value={form.organization} onChange={e => set('organization', e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign In</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
}

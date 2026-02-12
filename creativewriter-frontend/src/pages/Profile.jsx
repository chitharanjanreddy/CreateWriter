import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.profile?.phone || '',
    organization: user?.profile?.organization || '', bio: user?.profile?.bio || '',
    defaultDialect: user?.preferences?.defaultDialect || 'coastal',
    defaultStyle: user?.preferences?.defaultStyle || 'romantic',
    defaultPoetryForm: user?.preferences?.defaultPoetryForm || 'geeyam'
  });
  const [passForm, setPassForm] = useState({ current: '', newPass: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMsg('');
    try {
      await api.updateProfile(form);
      await refreshUser();
      setMsg('Profile updated successfully');
    } catch (err) { setError(err.error || 'Update failed'); }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMsg('');
    try {
      await api.updatePassword(passForm.current, passForm.newPass);
      setMsg('Password changed successfully');
      setPassForm({ current: '', newPass: '' });
    } catch (err) { setError(err.error || 'Password change failed'); }
    setLoading(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Profile Settings</h1>
      </div>

      <div className="profile-header card">
        <div className="profile-avatar">{user?.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}</div>
        <div>
          <h2>{user?.name}</h2>
          <p className="text-muted">{user?.email}</p>
          <span className={`tag ${user?.role === 'admin' ? 'tag-purple' : 'tag-green'}`}>{user?.role}</span>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profile & Preferences</button>
        <button className={`tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>Change Password</button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'profile' && (
        <form onSubmit={handleUpdateProfile} className="card">
          <h3>Personal Information</h3>
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div className="form-group"><label>Organization</label><input value={form.organization} onChange={e => set('organization', e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Bio</label><textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} /></div>

          <h3 style={{ marginTop: 24 }}>Lyrics Preferences</h3>
          <div className="form-row">
            <div className="form-group"><label>Default Dialect</label>
              <select value={form.defaultDialect} onChange={e => set('defaultDialect', e.target.value)}>
                <option value="coastal">Coastal</option><option value="telangana">Telangana</option>
                <option value="rayalaseema">Rayalaseema</option><option value="uttarandhra">Uttarandhra</option>
              </select>
            </div>
            <div className="form-group"><label>Default Style</label>
              <select value={form.defaultStyle} onChange={e => set('defaultStyle', e.target.value)}>
                <option value="romantic">Romantic</option><option value="devotional">Devotional</option>
                <option value="folk">Folk</option><option value="patriotic">Patriotic</option>
                <option value="cinematic">Cinematic</option>
              </select>
            </div>
            <div className="form-group"><label>Default Poetry Form</label>
              <select value={form.defaultPoetryForm} onChange={e => set('defaultPoetryForm', e.target.value)}>
                <option value="geeyam">Geeyam</option><option value="padyam">Padyam</option>
                <option value="janapada">Janapada</option><option value="keertana">Keertana</option>
                <option value="modern">Modern</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
        </form>
      )}

      {tab === 'password' && (
        <form onSubmit={handleChangePassword} className="card">
          <h3>Change Password</h3>
          <div className="form-group"><label>Current Password</label>
            <input type="password" value={passForm.current} onChange={e => setPassForm(f => ({ ...f, current: e.target.value }))} required />
          </div>
          <div className="form-group"><label>New Password</label>
            <input type="password" value={passForm.newPass} onChange={e => setPassForm(f => ({ ...f, newPass: e.target.value }))} required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
        </form>
      )}
    </div>
  );
}

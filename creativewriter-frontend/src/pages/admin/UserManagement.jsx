import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => { loadUsers(); }, [page, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await api.getUsers(params);
      setUsers(res.data);
      setPagination(res.pagination);
    } catch {}
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const toggleRole = async (id) => {
    try {
      const res = await api.toggleUserRole(id);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, role: res.data.role } : u));
      setMsg(res.message);
    } catch (err) { setMsg(err.error); }
  };

  const toggleStatus = async (id) => {
    try {
      const res = await api.toggleUserStatus(id);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: res.data.isActive } : u));
      setMsg(res.message);
    } catch (err) { setMsg(err.error); }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api.deleteUser(id, true);
      setUsers(prev => prev.filter(u => u._id !== id));
      setMsg('User deleted');
    } catch (err) { setMsg(err.error); }
  };

  const startEdit = (u) => {
    setEditingUser(u._id);
    setEditForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive });
  };

  const saveEdit = async () => {
    try {
      const res = await api.adminUpdateUser(editingUser, editForm);
      setUsers(prev => prev.map(u => u._id === editingUser ? { ...u, ...res.data } : u));
      setEditingUser(null);
      setMsg('User updated');
    } catch (err) { setMsg(err.error); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>User Management</h1>
        <span className="text-muted">{pagination.total || 0} total users</span>
      </div>

      {msg && <div className="alert alert-info" onClick={() => setMsg('')}>{msg} (click to dismiss)</div>}

      <form className="filter-bar" onSubmit={handleSearch}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="filter-input" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <button type="submit" className="btn btn-sm btn-primary">Search</button>
      </form>

      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Last Active</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    {editingUser === u._id ? (
                      <div>
                        <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} className="inline-input" />
                        <input value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} className="inline-input" style={{marginTop:4}} />
                      </div>
                    ) : (
                      <><strong>{u.name}</strong><br/><span className="text-muted text-sm">{u.email}</span></>
                    )}
                  </td>
                  <td><span className={`tag tag-sm ${u.role === 'admin' ? 'tag-purple' : 'tag-green'}`}>{u.role}</span></td>
                  <td><span className={`status-dot ${u.isActive ? 'green' : 'red'}`} />{u.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="text-muted text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="text-muted text-sm">{u.stats?.lastActive ? new Date(u.stats.lastActive).toLocaleDateString() : '-'}</td>
                  <td>
                    {u._id === me?._id || u._id === me?.id ? (
                      <span className="text-muted text-sm">You</span>
                    ) : editingUser === u._id ? (
                      <div className="btn-group">
                        <button className="btn btn-xs btn-primary" onClick={saveEdit}>Save</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => setEditingUser(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="btn-group">
                        <button className="btn btn-xs btn-ghost" onClick={() => startEdit(u)}>Edit</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => toggleRole(u._id)}>
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button className="btn btn-xs btn-ghost" onClick={() => toggleStatus(u._id)}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-xs btn-danger-ghost" onClick={() => deleteUser(u._id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="text-muted">Page {pagination.page} of {pagination.pages}</span>
              <button className="btn btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

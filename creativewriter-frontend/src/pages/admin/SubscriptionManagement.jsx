import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function SubscriptionManagement() {
  const [activeTab, setActiveTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit states
  const [editingPlan, setEditingPlan] = useState(null);
  const [offerForm, setOfferForm] = useState({ planId: null, code: '', discountPercentage: '', validUntil: '', maxRedemptions: '' });
  const [overrideForm, setOverrideForm] = useState({ userId: '', planId: '', reason: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, analyticsRes] = await Promise.all([
        api.adminGetPlans(),
        api.adminGetAnalytics()
      ]);
      setPlans(plansRes.data);
      setAnalytics(analyticsRes.data);

      const subsRes = await api.adminGetSubscriptions();
      setSubscriptions(subsRes.data);
    } catch (err) {
      setError(err.error || 'Failed to load data');
    }
    setLoading(false);
  };

  const showMessage = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const handleTogglePlan = async (planId) => {
    try {
      const res = await api.adminTogglePlan(planId);
      showMessage(res.message);
      loadData();
    } catch (err) {
      showMessage(err.error || 'Failed to toggle plan', true);
    }
  };

  const handleUpdatePlan = async (planId) => {
    if (!editingPlan) return;
    try {
      await api.adminUpdatePlan(planId, editingPlan);
      showMessage('Plan updated successfully');
      setEditingPlan(null);
      loadData();
    } catch (err) {
      showMessage(err.error || 'Failed to update plan', true);
    }
  };

  const handleAddOffer = async () => {
    if (!offerForm.planId || !offerForm.code || !offerForm.discountPercentage || !offerForm.validUntil) {
      showMessage('Fill all required offer fields', true);
      return;
    }
    try {
      await api.adminAddOffer(offerForm.planId, {
        code: offerForm.code,
        discountPercentage: Number(offerForm.discountPercentage),
        validUntil: offerForm.validUntil,
        maxRedemptions: offerForm.maxRedemptions ? Number(offerForm.maxRedemptions) : -1
      });
      showMessage('Offer added successfully');
      setOfferForm({ planId: null, code: '', discountPercentage: '', validUntil: '', maxRedemptions: '' });
      loadData();
    } catch (err) {
      showMessage(err.error || 'Failed to add offer', true);
    }
  };

  const handleRemoveOffer = async (planId, offerId) => {
    try {
      await api.adminRemoveOffer(planId, offerId);
      showMessage('Offer removed');
      loadData();
    } catch (err) {
      showMessage(err.error || 'Failed to remove offer', true);
    }
  };

  const handleOverride = async () => {
    if (!overrideForm.userId || !overrideForm.planId) {
      showMessage('User ID and Plan are required', true);
      return;
    }
    try {
      const res = await api.adminOverrideSubscription(overrideForm.userId, overrideForm.planId, overrideForm.reason);
      showMessage(res.message);
      setOverrideForm({ userId: '', planId: '', reason: '' });
      loadData();
    } catch (err) {
      showMessage(err.error || 'Failed to override subscription', true);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Subscription Management</h1>
          <p className="text-muted">Manage plans, offers, and user subscriptions</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Analytics */}
      {analytics && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon blue">&#128101;</div>
            <div className="stat-info">
              <span className="stat-value">{analytics.totalSubscribers}</span>
              <span className="stat-label">Total Subscribers</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">&#9989;</div>
            <div className="stat-info">
              <span className="stat-value">{analytics.activeSubscribers}</span>
              <span className="stat-label">Active</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">&#8377;</div>
            <div className="stat-info">
              <span className="stat-value">{analytics.totalRevenue?.toLocaleString() || 0}</span>
              <span className="stat-label">Total Revenue (INR)</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">&#128179;</div>
            <div className="stat-info">
              <span className="stat-value">{analytics.totalPayments}</span>
              <span className="stat-label">Total Payments</span>
            </div>
          </div>
        </div>
      )}

      {analytics?.tierBreakdown && Object.keys(analytics.tierBreakdown).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Tier Breakdown</h3>
          <div className="tag-grid">
            {Object.entries(analytics.tierBreakdown).map(([tier, count]) => (
              <span key={tier} className="tag" style={{ textTransform: 'capitalize' }}>{tier}: <strong>{count}</strong></span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>Plans & Offers</button>
        <button className={`tab ${activeTab === 'subscribers' ? 'active' : ''}`} onClick={() => setActiveTab('subscribers')}>Subscribers</button>
        <button className={`tab ${activeTab === 'override' ? 'active' : ''}`} onClick={() => setActiveTab('override')}>User Override</button>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          {plans.map(plan => (
            <div key={plan._id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{plan.name} <span className="tag tag-sm" style={{ textTransform: 'capitalize' }}>{plan.tier}</span></h3>
                  <p className="text-muted text-sm">{plan.description}</p>
                </div>
                <div className="btn-group">
                  <span className={`tag ${plan.isActive ? 'tag-green' : 'tag-purple'}`}>{plan.isActive ? 'Active' : 'Inactive'}</span>
                  <button className="btn btn-xs" onClick={() => handleTogglePlan(plan._id)}>
                    {plan.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-xs" onClick={() => setEditingPlan(editingPlan?._id === plan._id ? null : {
                    _id: plan._id,
                    name: plan.name,
                    description: plan.description,
                    'pricing.monthly': plan.pricing.monthly,
                    'pricing.yearly': plan.pricing.yearly,
                    'limits.lyricsPerMonth': plan.limits.lyricsPerMonth,
                    'limits.musicGenerations': plan.limits.musicGenerations,
                    'limits.videoGenerations': plan.limits.videoGenerations,
                    'limits.voiceGenerations': plan.limits.voiceGenerations
                  })}>
                    {editingPlan?._id === plan._id ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              <div className="sub-details-grid" style={{ marginBottom: 12 }}>
                <div className="sub-detail"><span className="sub-detail-label">Monthly</span><span>&#8377;{plan.pricing.monthly}</span></div>
                <div className="sub-detail"><span className="sub-detail-label">Yearly</span><span>&#8377;{plan.pricing.yearly}</span></div>
                <div className="sub-detail"><span className="sub-detail-label">Lyrics</span><span>{plan.limits.lyricsPerMonth === -1 ? 'Unlimited' : plan.limits.lyricsPerMonth}</span></div>
                <div className="sub-detail"><span className="sub-detail-label">Music</span><span>{plan.limits.musicGenerations === -1 ? 'Unlimited' : plan.limits.musicGenerations}</span></div>
                <div className="sub-detail"><span className="sub-detail-label">Video</span><span>{plan.limits.videoGenerations === -1 ? 'Unlimited' : plan.limits.videoGenerations}</span></div>
                <div className="sub-detail"><span className="sub-detail-label">Voice</span><span>{plan.limits.voiceGenerations === -1 ? 'Unlimited' : plan.limits.voiceGenerations}</span></div>
              </div>

              {/* Edit form */}
              {editingPlan?._id === plan._id && (
                <div style={{ background: '#0a0e1a', padding: 16, borderRadius: 8, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, marginBottom: 12, color: '#94a3b8' }}>Edit Plan</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name</label>
                      <input value={editingPlan.name} onChange={e => setEditingPlan(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input value={editingPlan.description} onChange={e => setEditingPlan(p => ({ ...p, description: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Monthly Price (INR)</label>
                      <input type="number" value={editingPlan['pricing.monthly']} onChange={e => setEditingPlan(p => ({ ...p, 'pricing.monthly': Number(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label>Yearly Price (INR)</label>
                      <input type="number" value={editingPlan['pricing.yearly']} onChange={e => setEditingPlan(p => ({ ...p, 'pricing.yearly': Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Lyrics/month (-1 = unlimited)</label>
                      <input type="number" value={editingPlan['limits.lyricsPerMonth']} onChange={e => setEditingPlan(p => ({ ...p, 'limits.lyricsPerMonth': Number(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label>Music generations</label>
                      <input type="number" value={editingPlan['limits.musicGenerations']} onChange={e => setEditingPlan(p => ({ ...p, 'limits.musicGenerations': Number(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label>Video generations</label>
                      <input type="number" value={editingPlan['limits.videoGenerations']} onChange={e => setEditingPlan(p => ({ ...p, 'limits.videoGenerations': Number(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label>Voice generations</label>
                      <input type="number" value={editingPlan['limits.voiceGenerations']} onChange={e => setEditingPlan(p => ({ ...p, 'limits.voiceGenerations': Number(e.target.value) }))} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleUpdatePlan(plan._id, {
                    name: editingPlan.name,
                    description: editingPlan.description,
                    pricing: { monthly: editingPlan['pricing.monthly'], yearly: editingPlan['pricing.yearly'] },
                    limits: {
                      lyricsPerMonth: editingPlan['limits.lyricsPerMonth'],
                      musicGenerations: editingPlan['limits.musicGenerations'],
                      videoGenerations: editingPlan['limits.videoGenerations'],
                      voiceGenerations: editingPlan['limits.voiceGenerations']
                    }
                  })}>
                    Save Changes
                  </button>
                </div>
              )}

              {/* Offers */}
              {plan.offers?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Active Offers</h4>
                  {plan.offers.map(offer => (
                    <div key={offer._id} className="media-prev-item">
                      <span>
                        <strong>{offer.code}</strong> - {offer.discountPercentage}% off
                        {offer.maxRedemptions !== -1 && ` (${offer.currentRedemptions}/${offer.maxRedemptions} used)`}
                        <span className="text-muted text-sm"> until {new Date(offer.validUntil).toLocaleDateString()}</span>
                      </span>
                      <button className="btn btn-xs btn-danger-ghost" onClick={() => handleRemoveOffer(plan._id, offer._id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add offer */}
              <div>
                <button
                  className="btn btn-xs btn-ghost"
                  onClick={() => setOfferForm(f => ({ ...f, planId: f.planId === plan._id ? null : plan._id }))}
                >
                  {offerForm.planId === plan._id ? 'Cancel' : '+ Add Offer'}
                </button>
                {offerForm.planId === plan._id && (
                  <div style={{ background: '#0a0e1a', padding: 12, borderRadius: 8, marginTop: 8 }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Code</label>
                        <input value={offerForm.code} onChange={e => setOfferForm(f => ({ ...f, code: e.target.value }))} placeholder="SAVE20" />
                      </div>
                      <div className="form-group">
                        <label>Discount %</label>
                        <input type="number" value={offerForm.discountPercentage} onChange={e => setOfferForm(f => ({ ...f, discountPercentage: e.target.value }))} placeholder="20" />
                      </div>
                      <div className="form-group">
                        <label>Valid Until</label>
                        <input type="date" value={offerForm.validUntil} onChange={e => setOfferForm(f => ({ ...f, validUntil: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Max Uses (-1=unlimited)</label>
                        <input type="number" value={offerForm.maxRedemptions} onChange={e => setOfferForm(f => ({ ...f, maxRedemptions: e.target.value }))} placeholder="-1" />
                      </div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={handleAddOffer}>Add Offer</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subscribers Tab */}
      {activeTab === 'subscribers' && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Billing</th>
                <th>Usage (L/M/V/Vc)</th>
                <th>Override</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => (
                <tr key={sub._id}>
                  <td>
                    <div>{sub.user?.name || 'Unknown'}</div>
                    <div className="text-muted text-sm">{sub.user?.email}</div>
                  </td>
                  <td><span className="tag tag-sm" style={{ textTransform: 'capitalize' }}>{sub.plan?.tier || 'N/A'}</span></td>
                  <td><span className={`tag tag-sm ${sub.status === 'active' ? 'tag-green' : 'tag-purple'}`}>{sub.status}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{sub.billingCycle}</td>
                  <td className="text-sm">
                    {sub.usage?.lyricsGenerated}/{sub.usage?.musicGenerated}/{sub.usage?.videoGenerated}/{sub.usage?.voiceGenerated}
                  </td>
                  <td>{sub.adminOverride?.isOverridden ? 'Yes' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {subscriptions.length === 0 && (
            <div className="empty-state"><p>No subscriptions found</p></div>
          )}
        </div>
      )}

      {/* Override Tab */}
      {activeTab === 'override' && (
        <div className="card">
          <h3>Override User Subscription</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            Manually assign a plan to a user. This overrides their current subscription.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>User ID</label>
              <input value={overrideForm.userId} onChange={e => setOverrideForm(f => ({ ...f, userId: e.target.value }))} placeholder="Paste user ID" />
            </div>
            <div className="form-group">
              <label>New Plan</label>
              <select value={overrideForm.planId} onChange={e => setOverrideForm(f => ({ ...f, planId: e.target.value }))}>
                <option value="">Select plan...</option>
                {plans.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.tier})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Reason</label>
            <input value={overrideForm.reason} onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g., Customer support, promotional upgrade" />
          </div>
          <button className="btn btn-primary" onClick={handleOverride}>Apply Override</button>
        </div>
      )}
    </div>
  );
}

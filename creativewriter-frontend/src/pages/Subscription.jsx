import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import UsageIndicator from '../components/UsageIndicator';
import api from '../services/api';

export default function SubscriptionPage() {
  const { subscription, currentPlan, refresh, loading } = useSubscription();
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState('');

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) return;
    setCancelling(true);
    try {
      const res = await api.cancelSubscription();
      setMessage(res.message);
      refresh();
    } catch (err) {
      setMessage(err.error || 'Failed to cancel subscription');
    }
    setCancelling(false);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  if (!subscription) {
    return (
      <div className="page">
        <div className="page-header"><h1>Subscription</h1></div>
        <div className="card">
          <div className="empty-state">
            <p>No active subscription found.</p>
            <Link to="/pricing" className="btn btn-primary">View Plans</Link>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    active: 'green',
    cancelled: 'orange',
    expired: 'red',
    trial: 'blue',
    past_due: 'red'
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Subscription</h1>
          <p className="text-muted">Manage your plan and track usage</p>
        </div>
        <Link to="/pricing" className="btn btn-primary">Upgrade Plan</Link>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {/* Current Plan Card */}
      <div className="card sub-plan-card">
        <div className="sub-plan-header">
          <div>
            <h3 className="sub-plan-name">{currentPlan?.name || 'Free'} Plan</h3>
            <span className={`sub-status status-${statusColors[subscription.status] || 'gray'}`}>
              {subscription.status}
            </span>
          </div>
          {currentPlan?.tier !== 'free' && (
            <div className="sub-plan-price">
              <span className="price-currency">&#8377;</span>
              <span className="price-amount">
                {subscription.billingCycle === 'yearly' ? currentPlan?.pricing?.yearly : currentPlan?.pricing?.monthly}
              </span>
              <span className="price-period">/{subscription.billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
            </div>
          )}
        </div>

        <div className="sub-details-grid">
          {subscription.startDate && (
            <div className="sub-detail">
              <span className="sub-detail-label">Started</span>
              <span>{new Date(subscription.startDate).toLocaleDateString()}</span>
            </div>
          )}
          {subscription.endDate && (
            <div className="sub-detail">
              <span className="sub-detail-label">Ends</span>
              <span>{new Date(subscription.endDate).toLocaleDateString()}</span>
            </div>
          )}
          {subscription.renewalDate && subscription.status === 'active' && currentPlan?.tier !== 'free' && (
            <div className="sub-detail">
              <span className="sub-detail-label">Renewal</span>
              <span>{new Date(subscription.renewalDate).toLocaleDateString()}</span>
            </div>
          )}
          <div className="sub-detail">
            <span className="sub-detail-label">Billing</span>
            <span style={{ textTransform: 'capitalize' }}>{subscription.billingCycle}</span>
          </div>
        </div>

        {subscription.appliedPromo?.code && (
          <div className="sub-promo">
            Promo: <strong>{subscription.appliedPromo.code}</strong> ({subscription.appliedPromo.discountPercentage}% off)
          </div>
        )}

        {subscription.adminOverride?.isOverridden && (
          <div className="alert alert-info" style={{ marginTop: 12, cursor: 'default' }}>
            Plan assigned by admin: {subscription.adminOverride.reason}
          </div>
        )}
      </div>

      {/* Usage Section */}
      <div className="card">
        <h3>Usage This Period</h3>
        <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
          {subscription.usage?.periodStart && subscription.usage?.periodEnd && (
            <>Resets on {new Date(subscription.usage.periodEnd).toLocaleDateString()}</>
          )}
        </p>
        <div className="usage-grid">
          <UsageIndicator type="lyrics" />
          <UsageIndicator type="music" />
          <UsageIndicator type="video" />
          <UsageIndicator type="voice" />
        </div>
      </div>

      {/* Payment History */}
      {subscription.paymentHistory?.length > 0 && (
        <div className="card">
          <h3>Payment History</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {subscription.paymentHistory.map((p, i) => (
                <tr key={i}>
                  <td>{new Date(p.paidAt).toLocaleDateString()}</td>
                  <td>&#8377;{p.amount} {p.currency}</td>
                  <td>
                    <span className={`tag ${p.status === 'captured' ? 'tag-green' : 'tag-purple'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{p.razorpayPaymentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel */}
      {currentPlan?.tier !== 'free' && subscription.status === 'active' && (
        <div className="card">
          <h3>Cancel Subscription</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
            After cancellation, you'll retain access until the end of your current billing period.
          </p>
          <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        </div>
      )}
    </div>
  );
}

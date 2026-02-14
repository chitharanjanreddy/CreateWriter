import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import api from '../services/api';

export default function Pricing() {
  const { user } = useAuth();
  const { plans, currentPlan, refresh, loadPlans } = useSubscription();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleValidatePromo = async (planId) => {
    if (!promoCode.trim()) return;
    try {
      const res = await api.validatePromo(promoCode, planId);
      setPromoResult(res.data);
    } catch (err) {
      setPromoResult(null);
      setError(err.error || 'Invalid promo code');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getPrice = (plan) => {
    const base = billingCycle === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly;
    if (promoResult && selectedPlan === plan._id) {
      return Math.round(base * (1 - promoResult.discountPercentage / 100));
    }
    return base;
  };

  const handleSubscribe = async (plan) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (plan.tier === 'free') return;

    if (currentPlan?.tier === plan.tier) return;

    setLoading(true);
    setError('');

    try {
      const orderRes = await api.createOrder(plan._id, billingCycle, promoResult ? promoCode : undefined);
      const { orderId, amount, currency, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'CreativeWriter',
        description: `${plan.name} Plan - ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan._id,
              billingCycle,
              promoCode: promoResult ? promoCode : undefined
            });
            refresh();
            navigate('/subscription');
          } catch (err) {
            setError(err.error || 'Payment verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: {
          color: '#6366f1'
        }
      };

      if (window.Razorpay) {
        const razorpayCheckout = new window.Razorpay(options);
        razorpayCheckout.open();
      } else {
        setError('Payment gateway not loaded. Please refresh the page.');
      }
    } catch (err) {
      setError(err.error || 'Failed to create order');
    }

    setLoading(false);
  };

  return (
    <div className="page">
      <div className="page-header" style={{ textAlign: 'center', display: 'block' }}>
        <h1>Choose Your Plan</h1>
        <p className="text-muted">Unlock the full power of AI-powered Telugu lyrics creation</p>
      </div>

      <div className="billing-toggle">
        <button
          className={`toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </button>
        <button
          className={`toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
          onClick={() => setBillingCycle('yearly')}
        >
          Yearly <span className="save-badge">Save ~17%</span>
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ maxWidth: 600, margin: '0 auto 16px' }}>{error}</div>}

      <div className="pricing-grid">
        {plans.map(plan => {
          const isCurrent = currentPlan?.tier === plan.tier;
          const price = getPrice(plan);

          return (
            <div key={plan._id} className={`pricing-card ${plan.tier === 'premium' ? 'featured' : ''} ${isCurrent ? 'current' : ''}`}>
              {plan.tier === 'premium' && <div className="pricing-badge">Most Popular</div>}
              {isCurrent && <div className="pricing-badge current-badge">Current Plan</div>}

              <h3 className="pricing-name">{plan.name}</h3>
              <p className="pricing-desc">{plan.description}</p>

              <div className="pricing-price">
                <span className="price-currency">&#8377;</span>
                <span className="price-amount">{price}</span>
                {plan.tier !== 'free' && (
                  <span className="price-period">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                )}
              </div>

              {promoResult && selectedPlan === plan._id && (
                <div className="promo-applied">
                  {promoResult.discountPercentage}% off applied!
                </div>
              )}

              <ul className="pricing-features">
                {plan.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>

              <div className="pricing-limits">
                <div className="limit-row">
                  <span>Lyrics/month</span>
                  <strong>{plan.limits.lyricsPerMonth === -1 ? 'Unlimited' : plan.limits.lyricsPerMonth}</strong>
                </div>
                <div className="limit-row">
                  <span>Music</span>
                  <strong>{plan.limits.musicGenerations === -1 ? 'Unlimited' : plan.limits.musicGenerations}</strong>
                </div>
                <div className="limit-row">
                  <span>Video</span>
                  <strong>{plan.limits.videoGenerations === -1 ? 'Unlimited' : plan.limits.videoGenerations}</strong>
                </div>
                <div className="limit-row">
                  <span>Voice</span>
                  <strong>{plan.limits.voiceGenerations === -1 ? 'Unlimited' : plan.limits.voiceGenerations}</strong>
                </div>
              </div>

              {plan.tier !== 'free' && !isCurrent && (
                <div className="pricing-promo">
                  <div className="promo-input-row">
                    <input
                      placeholder="Promo code"
                      value={selectedPlan === plan._id ? promoCode : ''}
                      onChange={e => { setSelectedPlan(plan._id); setPromoCode(e.target.value); setPromoResult(null); }}
                      className="promo-input"
                    />
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => { setSelectedPlan(plan._id); handleValidatePromo(plan._id); }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              <button
                className={`btn btn-full ${plan.tier === 'free' ? 'btn-ghost' : 'btn-primary'} pricing-btn`}
                disabled={isCurrent || loading || plan.tier === 'free'}
                onClick={() => handleSubscribe(plan)}
              >
                {isCurrent ? 'Current Plan' : plan.tier === 'free' ? 'Free Forever' : `Subscribe to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

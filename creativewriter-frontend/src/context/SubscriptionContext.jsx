import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setUsage(null);
      return;
    }
    setLoading(true);
    try {
      const [subRes, usageRes] = await Promise.all([
        api.getMySubscription(),
        api.getMyUsage()
      ]);
      setSubscription(subRes.data);
      setUsage(usageRes.data);
    } catch {
      setSubscription(null);
      setUsage(null);
    }
    setLoading(false);
  }, [user]);

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.getPlans();
      setPlans(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadSubscription();
    loadPlans();
  }, [loadSubscription, loadPlans]);

  /**
   * Check if user can use a specific feature
   * @param {string} type - 'lyrics', 'music', 'video', 'voice'
   * @returns {boolean}
   */
  const canUse = (type) => {
    if (!usage) return true; // Allow if data not loaded yet
    const u = usage.usage?.[type];
    if (!u) return true;
    return u.allowed;
  };

  /**
   * Get remaining count for a feature
   * @param {string} type - 'lyrics', 'music', 'video', 'voice'
   * @returns {object} { current, limit, remaining, allowed }
   */
  const getRemaining = (type) => {
    if (!usage) return { current: 0, limit: -1, remaining: -1, allowed: true };
    const u = usage.usage?.[type];
    if (!u) return { current: 0, limit: -1, remaining: -1, allowed: true };
    return u;
  };

  /**
   * Get current plan info
   */
  const currentPlan = subscription?.plan || null;

  /**
   * Refresh subscription data (call after payment or usage)
   */
  const refresh = () => loadSubscription();

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      usage,
      plans,
      loading,
      currentPlan,
      canUse,
      getRemaining,
      refresh,
      loadPlans
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function AuthModal({ isOpen, onClose, onSuccess, initialTab = 'login' }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTab(initialTab);
    setError('');
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ name: form.name, email: form.email, password: form.password });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="authModal-overlay" onClick={onClose} role="presentation">
      <div
        className="authModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={tab === 'login' ? 'Sign In' : 'Create an Account'}
      >
        <button className="authModal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="authModal-head">
          <span className="authModal-badge">Account Required</span>
          <h3>{tab === 'login' ? 'Sign in to Buy' : 'Create an Account'}</h3>
          <p>
            {tab === 'login'
              ? 'Log in to complete your checkout with this product.'
              : 'Create a free account to finish checkout and track your orders.'}
          </p>
        </div>

        <div className="authModal-tabs">
          <button
            type="button"
            className={`authModal-tab ${tab === 'login' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('login');
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`authModal-tab ${tab === 'register' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('register');
              setError('');
            }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="authModal-error">{error}</div>}

        <form className="authModal-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="authModal-field">
              <label htmlFor="auth-modal-name">Full Name</label>
              <input
                id="auth-modal-name"
                name="name"
                type="text"
                placeholder="Your Name"
                required
                value={form.name}
                onChange={handleChange}
                autoFocus
              />
            </div>
          )}

          <div className="authModal-field">
            <label htmlFor="auth-modal-email">Email Address</label>
            <input
              id="auth-modal-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              value={form.email}
              onChange={handleChange}
              autoFocus={tab === 'login'}
            />
          </div>

          <div className="authModal-field">
            <label htmlFor="auth-modal-password">Password</label>
            <input
              id="auth-modal-password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={handleChange}
            />
          </div>

          {tab === 'login' && (
            <div className="authModal-extra">
              <Link to="/forgot-password" onClick={onClose}>
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            className="authModal-submitBtn"
            disabled={submitting}
          >
            {submitting ? 'Please wait…' : tab === 'login' ? 'Sign In & Proceed to Checkout' : 'Create Account & Checkout'}
          </button>
        </form>

        <div className="authModal-foot">
          {tab === 'login' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="authModal-switchLink"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
              >
                Sign up here
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="authModal-switchLink"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;

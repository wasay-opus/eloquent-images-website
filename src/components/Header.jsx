import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import bannerImage from '../assets/banner-image.jpg';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { IMAGE_CATEGORIES } from '../data/galleryCategoryOrder.js';
import SocialLinks from './SocialLinks.jsx';
import { SHOP_ENABLED } from '../config.js';

const DROPDOWN_IMAGE_CATEGORIES = IMAGE_CATEGORIES.filter((category) => category.slug !== 'gallery');

// Exact horizontal menu order requested by the client.
const MENU = [
  { label: 'Home', path: '/' },
  { label: 'Gallery', path: '/gallery/#gallery' },
  { label: 'Blogs', path: '/blogs' },
  { label: 'Images', children: DROPDOWN_IMAGE_CATEGORIES },
  { label: 'Products', path: '/products', shopOnly: true },
  { label: 'Create your own', path: '/create-your-own', shopOnly: true },
  { label: 'About Us', path: '/about-us' },
];

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const searchInputRef = useRef(null);
  const profileRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const userInitial = (user?.name?.trim()?.[0] || 'U').toUpperCase();

  useEffect(() => {
    if (!isProfileOpen) return undefined;

    const handleOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isMobileMenuOpen]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    if (!isSearchOpen) {
      setIsSearchOpen(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }

    const query = searchInputRef.current?.value.trim() ?? '';

    if (!query) {
      searchInputRef.current?.focus();
      return;
    }

    navigate(`/search?q=${encodeURIComponent(query)}`);
    setSearchValue('');
    setIsSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const handleMenuClick = (event, linkPath) => {
    if (!linkPath.includes('#')) {
      return;
    }

    const [pathname, hash] = linkPath.split('#');

    event.preventDefault();
    navigate(pathname, {
      state: { gallerySlug: hash },
    });
    setIsMobileMenuOpen(false);
  };

  const renderMenuLink = (entry, className) => {
    const to = entry.navPath ?? entry.path;
    const isHashLink = to.includes('#');
    const isActive = isHashLink
      ? `${location.pathname}${location.hash}` === to
      : location.pathname === entry.path;

    return (
      <NavLink
        className={`${className}${isActive ? ' menu-link-active' : ''}`}
        onClick={(event) => handleMenuClick(event, to)}
        to={to}
      >
        {entry.label}
      </NavLink>
    );
  };

  const renderAccountMenu = () =>
    isAuthenticated ? (
      <div className="profile-menu" ref={profileRef}>
        <button
          type="button"
          className="profile-trigger"
          aria-label="Account menu"
          aria-expanded={isProfileOpen}
          onClick={() => setIsProfileOpen((open) => !open)}
        >
          <span className="profile-avatar">{userInitial}</span>
        </button>

        {isProfileOpen && (
          <div className="profile-dropdown">
            <div className="profile-dropdownHead">
              <span className="profile-avatar profile-avatar-lg">{userInitial}</span>
              <span className="profile-name">{user?.name || 'Account'}</span>
            </div>

            <Link
              className="profile-item"
              to="/profile"
              onClick={() => setIsProfileOpen(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z" />
              </svg>
              <span>Edit profile</span>
            </Link>

            <Link
              className="profile-item"
              to="/orders"
              onClick={() => setIsProfileOpen(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 16H5V5h14v14ZM7 7h10v2H7V7Zm0 4h10v2H7v-2Zm0 4h7v2H7v-2Z" />
              </svg>
              <span>My Orders</span>
            </Link>

            <button
              type="button"
              className="profile-item profile-logout"
              onClick={() => {
                setIsProfileOpen(false);
                logout();
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M16 17v-3H9v-4h7V7l5 5-5 5ZM14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9Z" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    ) : (
      <Link
        className="auth-login-link"
        to="/login"
        state={{ from: currentPath }}
      >
        Login
      </Link>
    );

  return (
    <header className="site-header">
      <div
        className="header-banner"
        style={{ backgroundImage: `url(${bannerImage})` }}
      >
        <div className="container-fluid">
          <div className="header-top row align-items-start">
            <div className="col">
              <SocialLinks className="social-links d-flex" />
            </div>
            <div className="col-auto header-actions">
              {SHOP_ENABLED && (
                <Link
                  to="/checkout"
                  className="header-cartLink"
                  title="Cart / Checkout"
                  aria-label="View Cart"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                  {cartCount > 0 && <span className="header-cartBadge">{cartCount}</span>}
                </Link>
              )}
              {SHOP_ENABLED && <div className="desktop-account">{renderAccountMenu()}</div>}

              <form
                className={`search-form input-group ${
                  isSearchOpen ? 'search-form-open' : ''
                }`}
                onSubmit={handleSearchSubmit}
                onMouseEnter={() => setIsSearchOpen(true)}
                onMouseLeave={() => {
                  setIsSearchOpen(false);
                  searchInputRef.current?.blur();
                }}
              >
                <input
                  aria-label="Search"
                  className="form-control"
                  ref={searchInputRef}
                  type="search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                />
                <button
                  aria-label="Submit search"
                  className="btn"
                  type="submit"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m20.7 19.3-4.2-4.2a7.8 7.8 0 1 0-1.4 1.4l4.2 4.2 1.4-1.4ZM4.8 10.5a5.7 5.7 0 1 1 11.4 0 5.7 5.7 0 0 1-11.4 0Z" />
                  </svg>
                </button>
              </form>

              <button
                type="button"
                className="mobile-menu-toggle"
                aria-label="Open menu"
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen((open) => !open)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>
        </div>

        {/* <div className="brand-signature">Eloquent Images by Adrian</div> */}

        <nav className="main-menu navbar navbar-expand">
          <div className="container justify-content-center flex-wrap">
            {MENU.map((item) => {
              if (item.shopOnly && !SHOP_ENABLED) return null;

              if (!item.children) {
                return <span key={item.label}>{renderMenuLink(item, 'menu-link nav-link')}</span>;
              }

              return (
                <div className="menu-group" key={item.label}>
                  {item.path ? (
                    <NavLink
                      className="menu-link nav-link menu-groupToggle"
                      to={item.path}
                      onClick={(event) => handleMenuClick(event, item.path)}
                    >
                      {item.label}
                      <svg className="menu-caret" aria-hidden="true" viewBox="0 0 24 24">
                        <path d="m7 10 5 5 5-5z" />
                      </svg>
                    </NavLink>
                  ) : (
                    <span className="menu-link nav-link menu-groupToggle">
                      {item.label}
                      <svg className="menu-caret" aria-hidden="true" viewBox="0 0 24 24">
                        <path d="m7 10 5 5 5-5z" />
                      </svg>
                    </span>
                  )}

                  <div className="menu-dropdown">
                    {item.children.map((child) => (
                      <span key={child.label}>{renderMenuLink(child, 'menu-dropdownLink')}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className={`mobile-menu-panel ${isMobileMenuOpen ? 'is-open' : ''}`}>
          <div className="mobile-menu-head">
            <span>Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              className="mobile-menu-close"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              X
            </button>
          </div>

          <nav className="mobile-menu-links" aria-label="Mobile navigation">
            {MENU.map((item) => {
              if (item.shopOnly && !SHOP_ENABLED) return null;

              if (!item.children) {
                return (
                  <span key={item.label}>
                    {renderMenuLink(item, 'mobile-menu-link')}
                  </span>
                );
              }

              return (
                <div className="mobile-menu-group" key={item.label}>
                  <span className="mobile-menu-label">{item.label}</span>
                  {item.children.map((child) => (
                    <span key={child.label}>
                      {renderMenuLink(child, 'mobile-menu-link mobile-menu-child')}
                    </span>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="mobile-menu-social">
            <SocialLinks className="social-links d-flex" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

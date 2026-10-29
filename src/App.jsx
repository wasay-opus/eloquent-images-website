import { lazy, Suspense, useEffect } from 'react';
import AOS from 'aos';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import Header from './components/Header.jsx';
import Loader from './components/Loader.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { SHOP_ENABLED } from './config.js';
import 'aos/dist/aos.css';

const AboutUs = lazy(() => import('./pages/AboutUs.jsx'));
const Birds = lazy(() => import('./pages/Birds.jsx'));
const BlogDetail = lazy(() => import('./pages/BlogDetail.jsx'));
const Blogs = lazy(() => import('./pages/Blogs.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess.jsx'));
const ContactUs = lazy(() => import('./pages/ContactUs.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Flora = lazy(() => import('./pages/Flora.jsx'));
const Gallery = lazy(() => import('./pages/Gallery.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const InsectsSpiders = lazy(() => import('./pages/InsectsSpiders.jsx'));
const Landscapes = lazy(() => import('./pages/Landscapes.jsx'));
const Mammals = lazy(() => import('./pages/Mammals.jsx'));
const Miscellaneous = lazy(() => import('./pages/Miscellaneous.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const CreateYourOwn = lazy(() => import('./pages/CreateYourOwn.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const ReptilesAmphibians = lazy(() => import('./pages/ReptilesAmphibians.jsx'));
const SearchResults = lazy(() => import('./pages/SearchResults.jsx'));
const WhatsNew = lazy(() => import('./pages/WhatsNew.jsx'));


export const pages = [
  { name: 'Home', path: '/', component: Home },
  { name: "What's New", path: '/whats-new', component: WhatsNew },

  { name: 'About Us', path: '/about-us', component: AboutUs },
  { name: 'Gallery', path: '/gallery', component: Gallery },
  { name: 'Blogs', path: '/blogs', component: Blogs },
  { name: 'Products', path: '/products', component: Products, hidden: !SHOP_ENABLED },
  {
    name: 'Create your own',
    path: '/create-your-own',
    component: CreateYourOwn,
    hidden: !SHOP_ENABLED,
  },
  { name: 'Birds', path: '/birds', navPath: '/gallery/#birds', component: Birds },
  {
    name: 'Mammals',
    path: '/mammals',
    navPath: '/gallery/#mammals',
    component: Mammals,
  },
  {
    name: 'Insects & Spiders',
    path: '/insects-spiders',
    navPath: '/gallery/#insects-spiders',
    component: InsectsSpiders,
  },
  {
    name: 'Reptiles & Amphibians',
    path: '/reptiles-amphibians',
    navPath: '/gallery/#reptiles-amphibians',
    component: ReptilesAmphibians,
  },
  { name: 'Flora', path: '/flora', navPath: '/gallery/#flora', component: Flora },
  {
    name: 'Landscapes',
    path: '/landscapes',
    navPath: '/gallery/#landscapes',
    component: Landscapes,
  },
  {
    name: 'Miscellaneous',
    path: '/miscellaneous',
    navPath: '/gallery/#miscellaneous',
    component: Miscellaneous,
  },
];

function PageLoader() {
  return (
    <section className="route-loader">
      <Loader />
    </section>
  );
}

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    AOS.init({
      duration: 1000,
      easing: 'ease-out-cubic',
      offset: 120,
      once: true,
    });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      AOS.refresh();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [location.pathname]);

  useEffect(() => {
    if (location.hash || location.state?.gallerySlug) {
      return;
    }

    if (location.pathname === '/') {
      window.scrollTo({
        top: 0,
        behavior: 'auto',
      });
      return;
    }

    // On inner pages, scroll so the navbar and a nice strip of banner (~90px)
    // remain visible at the top, perfectly framing the first section below it.
    const frameId = window.requestAnimationFrame(() => {
      const header = document.querySelector('header.site-header');
      const mainMenu = document.querySelector('.main-menu');
      if (header) {
        const navHeight = mainMenu?.offsetHeight || 70;
        const bannerStrip = window.innerWidth >= 992 ? 90 : 20;
        const targetY = Math.max(0, header.offsetHeight - navHeight - bannerStrip);
        window.scrollTo({
          top: targetY,
          behavior: 'smooth',
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.pathname, location.hash, location.state]);

  return (
    <>
      <Header pages={pages} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {pages.map(({ path, component: Page }) => (
            <Route key={path} path={path} element={<Page />} />
          ))}
          <Route path="/blogs/:slug" element={<BlogDetail />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/contact-us" element={<ContactUs />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

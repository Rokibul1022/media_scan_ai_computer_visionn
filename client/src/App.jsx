import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { PageLoader } from './components/PageLoader.jsx';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const Analyze = lazy(() => import('./pages/Analyze.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const Tools = lazy(() => import('./pages/Tools.jsx'));
const About = lazy(() => import('./pages/About.jsx'));

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Landing />} />
              <Route path="/analyze" element={<Analyze />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <Footer />
    </div>
  );
}
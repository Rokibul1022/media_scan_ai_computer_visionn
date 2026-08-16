import { motion } from 'framer-motion';

export function PageLoader({ full = true }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: full ? '50vh' : '200px',
        padding: '3rem',
      }}
    >
      <motion.div
        className="spinner"
        style={{ width: 44, height: 44, margin: 0 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
      />
    </div>
  );
}
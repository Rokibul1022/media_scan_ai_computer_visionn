import { Reveal } from '../components/Motion.jsx';
import HealthTools from '../components/HealthTools.jsx';

export default function Tools() {
  return (
    <div>
      <div className="page-hero">
        <Reveal>
          <h2>🧰 Health Tools & Calculators</h2>
          <p>Quick utilities to help you track, estimate and understand your health between visits.</p>
        </Reveal>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <HealthTools />
      </div>
    </div>
  );
}
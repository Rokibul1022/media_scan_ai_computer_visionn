import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { costEstimates, hospitalList, languages } from '../data.js';
import { Stagger, StaggerItem } from './Motion.jsx';

function ResultBanner({ color, children }) {
  return (
    <motion.div
      className="result-banner"
      style={{ borderLeftColor: color, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ToolHead({ icon, title, sub }) {
  return (
    <div className="tool-head">
      <div className="t-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        {sub && <p className="tool-sub">{sub}</p>}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label className="input-label">{children}</label>;
}

function Input({ value, onChange, placeholder, unit, type = 'number', min, step }) {
  return (
    <div className="input-wrap">
      <input
        className="field"
        type={type}
        placeholder={placeholder}
        value={value}
        min={min}
        step={step}
        onChange={onChange}
      />
      {unit && <span className="input-unit">{unit}</span>}
    </div>
  );
}

function Ring({ value, color, size = 92, label }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" width={size} height={size}>
        <circle className="ring-track" cx="40" cy="40" r={r} />
        <motion.circle
          className="ring-fill"
          cx="40"
          cy="40"
          r={r}
          stroke={color}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-val" style={{ color }}>{Math.round(value)}</span>
        {label && <span className="ring-label">{label}</span>}
      </div>
    </div>
  );
}

const BMI_SEGMENTS = [
  { from: 14, to: 18.5, color: '#38bdf8', label: 'Under' },
  { from: 18.5, to: 25, color: '#34d399', label: 'Normal' },
  { from: 25, to: 30, color: '#fbbf24', label: 'Over' },
  { from: 30, to: 40, color: '#f87171', label: 'Obese' },
];

function BmiGauge({ value }) {
  const clamp = (v) => Math.min(100, Math.max(0, ((v - 14) / (40 - 14)) * 100));
  return (
    <div className="bmi-gauge-wrap">
      <div className="bmi-gauge">
        {BMI_SEGMENTS.map((s) => (
          <span
            key={s.label}
            className="bmi-seg"
            style={{ width: `${clamp(s.to) - clamp(s.from)}%`, background: s.color }}
          />
        ))}
        <motion.span
          className="bmi-marker"
          initial={{ left: `${clamp(18.5)}%` }}
          animate={{ left: `${clamp(value)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        />
      </div>
      <div className="bmi-labels">
        {BMI_SEGMENTS.map((s) => (
          <span key={s.label} style={{ color: s.color }}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

const BMI_TIPS = {
  Underweight: 'Focus on nutrient-dense meals and strength training. Consider talking to a doctor about healthy weight gain.',
  Normal: 'Great balance! Keep up a varied diet and regular movement.',
  Overweight: 'Small changes add up — try 30 minutes of daily activity and balanced portions.',
  Obese: 'A structured plan with diet, exercise and medical guidance can make a big difference.',
};

export default function HealthTools({ max }) {
  const [bmi, setBmi] = useState({ h: '', w: '', unit: 'm', result: null });
  const [bio, setBio] = useState({ age: '', chol: '', bp: '', result: null });
  const [water, setWater] = useState({ w: '', unit: 'm', result: null });
  const [cost, setCost] = useState({ type: '', result: null });
  const [hospital, setHospital] = useState({ type: '', result: null });
  const [organs, setOrgans] = useState([
    { name: 'Heart', icon: '❤️', val: 85 },
    { name: 'Lungs', icon: '🫁', val: 78 },
    { name: 'Kidneys', icon: '🫘', val: 65 },
    { name: 'Liver', icon: '🫀', val: 90 },
  ]);
  const [lang, setLang] = useState('en');

  const calcBMI = () => {
    const unit = bmi.unit;
    let h = parseFloat(bmi.h);
    let w = parseFloat(bmi.w);
    if (!h || !w || h <= 0) return;
    if (unit === 'i') {
      h = h * 2.54; // inches → cm
      w = w * 0.453592; // lbs → kg
    }
    h = h / 100;
    const v = w / (h * h);
    const cat = BMI_SEGMENTS.find((s) => v < s.to) || BMI_SEGMENTS[3];
    const minW = (18.5 * h * h).toFixed(1);
    const maxW = (24.9 * h * h).toFixed(1);
    const weightUnit = unit === 'i' ? 'lbs' : 'kg';
    setBmi({ ...bmi, result: { v, cat, minW, maxW, weightUnit } });
  };

  const calcBio = () => {
    const age = parseInt(bio.age);
    const chol = parseFloat(bio.chol);
    const bp = parseFloat(bio.bp);
    if (!age || !chol || !bp) return;

    let bioAge = age;
    const flags = [];
    if (chol > 240) { bioAge += 5; flags.push('High cholesterol is adding years'); }
    else if (chol > 200) { bioAge += 2; flags.push('Slightly elevated cholesterol'); }
    else if (chol < 150) { bioAge -= 2; flags.push('Healthy cholesterol levels'); }

    if (bp > 140) { bioAge += 5; flags.push('Elevated blood pressure'); }
    else if (bp > 130) { bioAge += 3; flags.push('Blood pressure creeping up'); }
    else if (bp < 90) { bioAge += 2; flags.push('Blood pressure on the low side'); }
    else if (bp <= 120) { bioAge -= 3; flags.push('Ideal blood pressure'); }
    else flags.push('Acceptable blood pressure');

    const diff = bioAge - age;
    const score = Math.round(Math.max(30, Math.min(98, 100 - diff * 4)));
    setBio({
      ...bio,
      result: {
        bioAge: Math.round(bioAge),
        diff,
        color: diff > 0 ? '#f87171' : diff < 0 ? '#34d399' : '#38bdf8',
        score,
        flags,
      },
    });
  };

  const calcWater = () => {
    const unit = water.unit;
    let w = parseFloat(water.w);
    if (!w || w <= 0) return;
    if (unit === 'i') w = w * 0.453592;
    const liters = w * 0.033;
    const glasses = liters / 0.25;
    const status = liters < 2 ? { label: 'Low hydration', color: '#f87171', icon: '💧' }
      : liters < 3 ? { label: 'Good hydration', color: '#fbbf24', icon: '💦' }
      : { label: 'Excellent hydration', color: '#34d399', icon: '🌊' };
    setWater({ ...water, result: { liters, glasses, status } });
  };

  const estimateCost = () => {
    if (!cost.type) return;
    setCost({ ...cost, result: costEstimates[cost.type] });
  };

  const findHospital = () => {
    if (!hospital.type) return;
    setHospital({ ...hospital, result: hospital.type });
  };

  const updateOrgans = () => {
    setOrgans((prev) =>
      prev.map((o) => {
        const val = Math.min(98, Math.max(45, o.val + Math.floor(Math.random() * 12) - 5));
        return { ...o, val };
      })
    );
  };

  const organColor = (v) => (v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : '#f87171');
  const organStatus = (v) => (v >= 80 ? 'Excellent' : v >= 60 ? 'Good' : 'Needs care');
  const wellness = Math.round(organs.reduce((a, o) => a + o.val, 0) / organs.length);
  const wellnessColor = organColor(wellness);

  const langName = languages.find((l) => l.code === lang)?.name || 'English';

  const tools = [
    // 1 · BMI
    <StaggerItem key="bmi">
      <div className="card tool-card">
        <ToolHead icon="⚖️" title="BMI Calculator" sub="Body Mass Index" />

        <div className="seg">
          <button className={`seg-btn ${bmi.unit === 'm' ? 'active' : ''}`} onClick={() => setBmi({ ...bmi, unit: 'm', result: null })}>Metric</button>
          <button className={`seg-btn ${bmi.unit === 'i' ? 'active' : ''}`} onClick={() => setBmi({ ...bmi, unit: 'i', result: null })}>Imperial</button>
        </div>

        <div className="tool-inputs">
          <div>
            <Label>Height</Label>
            <Input
              value={bmi.h}
              onChange={(e) => setBmi({ ...bmi, h: e.target.value, result: null })}
              placeholder={bmi.unit === 'm' ? 'e.g. 170' : 'e.g. 68'}
              unit={bmi.unit === 'm' ? 'cm' : 'in'}
            />
          </div>
          <div>
            <Label>Weight</Label>
            <Input
              value={bmi.w}
              onChange={(e) => setBmi({ ...bmi, w: e.target.value, result: null })}
              placeholder={bmi.unit === 'm' ? 'e.g. 70' : 'e.g. 154'}
              unit={bmi.unit === 'm' ? 'kg' : 'lbs'}
            />
          </div>
          <button className="btn btn-primary" onClick={calcBMI}>Calculate BMI</button>
        </div>

        <AnimatePresence>
          {bmi.result && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="bmi-value-row">
                <div>
                  <div className="bmi-num" style={{ color: bmi.result.cat.color }}>{bmi.result.v.toFixed(1)}</div>
                  <div className="bmi-cat" style={{ color: bmi.result.cat.color }}>{bmi.result.cat.label}</div>
                </div>
                <div className="bmi-ideal">
                  <span className="bmi-ideal-label">Healthy range</span>
                  <span className="bmi-ideal-val">{bmi.result.minW}–{bmi.result.maxW} {bmi.result.weightUnit}</span>
                </div>
              </div>
              <BmiGauge value={bmi.result.v} />
              <p className="tip-text">{BMI_TIPS[bmi.result.cat.label]}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StaggerItem>,

    // 2 · Biological age
    <StaggerItem key="bio">
      <div className="card tool-card">
        <ToolHead icon="🧬" title="Biological Age" sub="How old your body acts" />

        <div className="tool-inputs">
          <div>
            <Label>Age</Label>
            <Input value={bio.age} onChange={(e) => setBio({ ...bio, age: e.target.value, result: null })} placeholder="e.g. 45" />
          </div>
          <div>
            <Label>Cholesterol</Label>
            <Input value={bio.chol} onChange={(e) => setBio({ ...bio, chol: e.target.value, result: null })} placeholder="e.g. 210" unit="mg/dL" />
          </div>
          <div>
            <Label>Systolic BP</Label>
            <Input value={bio.bp} onChange={(e) => setBio({ ...bio, bp: e.target.value, result: null })} placeholder="e.g. 120" unit="mmHg" />
          </div>
          <button className="btn btn-primary" onClick={calcBio}>Estimate</button>
        </div>

        <AnimatePresence>
          {bio.result && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="bio-score-row">
                <Ring value={bio.result.score} color={bio.result.color} label="Health" />
                <div>
                  <div className="bio-big">
                    <span style={{ color: bio.result.color }}>{bio.result.bioAge}</span>
                    <span className="bio-diff">
                      {bio.result.diff > 0 ? `+${bio.result.diff}y` : bio.result.diff < 0 ? `${bio.result.diff}y` : 'on track'}
                    </span>
                  </div>
                  <div className="bio-line">
                    {bio.result.diff > 0
                      ? 'Your body is aging faster than your age.'
                      : bio.result.diff < 0
                      ? 'Your body is aging slower than your age.'
                      : 'Your body age matches your age.'}
                  </div>
                </div>
              </div>
              <div className="meter">
                <motion.div
                  className="meter-fill"
                  style={{ background: bio.result.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${bio.result.score}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <ul className="tip-list">
                {bio.result.flags.map((f) => (
                  <li key={f}>
                    {f.startsWith('Healthy') || f.startsWith('Ideal') ? '✅' : '⚠️'} {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StaggerItem>,

    // 3 · Water intake
    <StaggerItem key="water">
      <div className="card tool-card">
        <ToolHead icon="🚰" title="Water Intake" sub="Daily hydration target" />

        <div className="seg">
          <button className={`seg-btn ${water.unit === 'm' ? 'active' : ''}`} onClick={() => setWater({ ...water, unit: 'm', result: null })}>Metric</button>
          <button className={`seg-btn ${water.unit === 'i' ? 'active' : ''}`} onClick={() => setWater({ ...water, unit: 'i', result: null })}>Imperial</button>
        </div>

        <div className="tool-inputs">
          <div>
            <Label>Weight</Label>
            <Input
              value={water.w}
              onChange={(e) => setWater({ ...water, w: e.target.value, result: null })}
              placeholder={water.unit === 'm' ? 'e.g. 70' : 'e.g. 154'}
              unit={water.unit === 'm' ? 'kg' : 'lbs'}
            />
          </div>
          <button className="btn btn-primary" onClick={calcWater}>Calculate</button>
        </div>

        <AnimatePresence>
          {water.result && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="water-row">
                <Ring value={Math.min(100, (water.result.liters / 3.7) * 100)} color={water.result.status.color} label="Goal" />
                <div>
                  <div className="water-liter">{water.result.liters.toFixed(1)} <small>L / day</small></div>
                  <div className="water-glasses">≈ {Math.round(water.result.glasses)} glasses (250ml)</div>
                  <span className="water-status" style={{ color: water.result.status.color }}>
                    {water.result.status.icon} {water.result.status.label}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StaggerItem>,

    // 4 · Organ health
    <StaggerItem key="organs">
      <div className="card tool-card">
        <div className="tool-head">
          <div className="t-icon">🫀</div>
          <div>
            <h3>Organ Health</h3>
            <p className="tool-sub">Wellness score from your report</p>
          </div>
        </div>

        <div className="wellness-row">
          <Ring value={wellness} color={wellnessColor} size={112} label="Overall" />
          <div className="organ-list">
            {organs.map((o) => (
              <div className="organ-mini" key={o.name}>
                <span className="organ-mini-icon">{o.icon}</span>
                <div className="organ-mini-track">
                  <motion.div
                    className="organ-mini-fill"
                    style={{ background: organColor(o.val) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${o.val}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="organ-mini-val" style={{ color: organColor(o.val) }}>{o.val}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="organ-status-row">
          {organs.map((o) => (
            <span key={o.name} className="organ-status" style={{ background: `${organColor(o.val)}22`, color: organColor(o.val) }}>
              {o.icon} {o.name} · {organStatus(o.val)}
            </span>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ marginTop: '1.1rem' }} onClick={updateOrgans}>
          🔄 Simulate from report
        </button>
      </div>
    </StaggerItem>,

    // 5 · Cost estimator
    <StaggerItem key="cost">
      <div className="card tool-card">
        <ToolHead icon="💰" title="Cost Estimator" sub="Typical out-of-pocket range" />
        <div className="tool-inputs">
          <div>
            <Label>Treatment</Label>
            <select className="field" value={cost.type} onChange={(e) => setCost({ ...cost, type: e.target.value, result: null })}>
              <option value="">Select treatment</option>
              {Object.entries(costEstimates).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={estimateCost}>Estimate</button>
        </div>
        <AnimatePresence>
          {cost.result && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ResultBanner color="var(--primary)">
                <span className="big text-gradient">${cost.result.min}–${cost.result.max}</span>
                <div className="sub">{cost.result.icon} {cost.result.name} — typical range</div>
              </ResultBanner>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StaggerItem>,

    // 6 · Hospital finder
    <StaggerItem key="hospital">
      <div className="card tool-card">
        <ToolHead icon="🏥" title="Hospital Finder" sub="Nearest options by specialty" />
        <div className="tool-inputs">
          <div>
            <Label>Specialty</Label>
            <select className="field" value={hospital.type} onChange={(e) => setHospital({ ...hospital, type: e.target.value, result: null })}>
              <option value="">Select specialty</option>
              <option value="cardiology">Cardiology</option>
              <option value="neurology">Neurology</option>
              <option value="orthopedics">Orthopedics</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={findHospital}>Find Nearby</button>
        </div>
        <AnimatePresence>
          {hospital.result && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="hospital-list">
                {hospitalList.map((h) => (
                  <div key={h.name} className="hospital-card">
                    <div className="hospital-top">
                      <strong>{h.name}</strong>
                      <span className="hospital-rating">⭐ {h.rating}</span>
                    </div>
                    <div className="hospital-meta">🚗 {h.distance} · ⏱️ {h.wait} wait</div>
                    <a
                      className="btn btn-outline btn-sm"
                      href={`https://www.google.com/maps/search/${encodeURIComponent(h.name)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🗺️ Open in Maps
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StaggerItem>,

    // 7 · Language
    <StaggerItem key="lang">
      <div className="card tool-card">
        <ToolHead icon="🌐" title="Language" sub="Report delivery language" />
        <div className="tool-inputs">
          <div>
            <Label>Select language</Label>
            <select className="field" value={lang} onChange={(e) => setLang(e.target.value)}>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="tool-result">
          <div className="lang-preview">
            <span className="lang-badge">{languages.find((l) => l.code === lang)?.name.split('(')[0].trim()}</span>
            Reports will be delivered in <strong>{langName}</strong>
          </div>
        </div>
      </div>
    </StaggerItem>,
  ];

  return <Stagger className="tools-grid" staggerChildren={0.08}>{tools.slice(0, max || tools.length)}</Stagger>;
}
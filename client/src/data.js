export const categories = [
  { name: 'General Prescription', desc: 'Medication & dosage analysis', tags: ['Drug names', 'Dosage', 'Interactions'], icon: '💊' },
  { name: 'X-ray Analysis', desc: 'Skeletal & structural imaging', tags: ['Hand', 'Leg', 'Chest', 'Spine'], icon: '🦴' },
  { name: 'Kidney & Renal', desc: 'Function & structure reports', tags: ['Creatinine', 'GFR', 'Urine analysis'], icon: '🫘' },
  { name: 'Skin Analysis', desc: 'Dermatology reports', tags: ['Biopsy', 'Lesion photos', 'Rash analysis'], icon: '🧴' },
  { name: 'Heart & Cardiac', desc: 'Cardiovascular diagnostics', tags: ['ECG', 'Echo', 'Troponin', 'Chest X-ray'], icon: '❤️' },
  { name: 'Brain & Neurology', desc: 'CNS imaging & tests', tags: ['CT scan', 'MRI', 'EEG', 'Lumbar puncture'], icon: '🧠' },
  { name: 'Blood & Lab Tests', desc: 'General pathology panels', tags: ['CBC', 'LFT', 'Thyroid', 'HbA1c'], icon: '🩸' },
  { name: 'Liver & GI', desc: 'Digestive system reports', tags: ['LFT', 'Endoscopy', 'Bilirubin'], icon: '🍽️' },
  { name: 'Hormones & Endocrine', desc: 'Gland & hormone reports', tags: ['Insulin', 'Cortisol', 'Testosterone'], icon: '🧬' },
  { name: 'Lung & Respiratory', desc: 'Pulmonary function', tags: ['Spirometry', 'CT chest', 'PFT'], icon: '🫁' },
  { name: 'Reproductive & OB-GYN', desc: 'Fertility & prenatal', tags: ['Ultrasound', 'AMH', 'Pap smear'], icon: '🤰' },
  { name: 'Oncology', desc: 'Cancer markers & reports', tags: ['Tumor markers', 'Biopsy', 'PET-CT'], icon: '🎗️' },
];

export const stats = [
  { value: 12, suffix: '+', label: 'Medical categories' },
  { value: 98, suffix: '%', label: 'Analysis accuracy' },
  { value: 50, suffix: '+', label: 'Languages supported' },
  { value: 40, suffix: 'k', label: 'Reports analyzed' },
];

export const features = [
  {
    icon: '🧠',
    title: 'AI-Powered Analysis',
    desc: 'LLM-powered interpretation of complex medical reports in seconds, delivering clear, plain-language insights.',
  },
  {
    icon: '🔍',
    title: 'OCR Text Extraction',
    desc: 'Upload scanned images or PDFs and watch handwritten or printed text become readable, analyzable content.',
  },
  {
    icon: '🔊',
    title: 'Audio Summaries',
    desc: 'Listen to your medical summary on the go instead of reading dense clinical language.',
  },
  {
    icon: '⚠️',
    title: 'Critical Value Alerts',
    desc: 'Dangerous readings are instantly flagged with severity levels so nothing important gets missed.',
  },
  {
    icon: '💬',
    title: 'Smart Assistant Chat',
    desc: 'Ask follow-up questions about your report and get empathetic, plain-language answers.',
  },
  {
    icon: '🌐',
    title: 'Multi-Language',
    desc: 'Reports translated into dozens of languages, including Spanish, Bengali, Hindi and Arabic.',
  },
];

export const steps = [
  {
    num: '01',
    icon: '📤',
    title: 'Upload your report',
    desc: 'Drag and drop an image, PDF, or paste the text of any medical report.',
  },
  {
    num: '02',
    icon: '🤖',
    title: 'AI analyzes it',
    desc: 'OCR extracts the content and the LLM interprets the findings against 12 medical categories.',
  },
  {
    num: '03',
    icon: '📋',
    title: 'Understand instantly',
    desc: 'Get a plain-language summary, critical alerts, and questions to ask your doctor.',
  },
];

export const testimonials = [
  {
    name: 'Dr. Sarah Mitchell',
    role: 'General Practitioner',
    quote: 'MediScan has been a game-changer for helping my patients understand their lab results without overwhelm.',
    initials: 'SM',
  },
  {
    name: 'Jason Carter',
    role: 'Patient',
    quote: 'I finally understood my grandfather\'s blood work. The critical alerts told us exactly what to ask the doctor.',
    initials: 'JC',
  },
  {
    name: 'Priya Sharma',
    role: 'Caregiver',
    quote: 'The audio summaries are perfect for my dad. He listens to his report while walking in the morning.',
    initials: 'PS',
  },
];

export const aiModes = [
  { id: 'medical', label: 'Medical Q&A', icon: '💊' },
  { id: 'therapy', label: 'Mental Health Support', icon: '🧠' },
  { id: 'voice', label: 'Voice Notes', icon: '🎤' },
];

export const hospitalList = [
  { name: 'City General', distance: '2.3km', rating: 4.5, wait: '15m' },
  { name: 'Medical Plus', distance: '3.7km', rating: 4.2, wait: '25m' },
];

export const costEstimates = {
  'blood-test': { min: 50, max: 200, name: 'Blood Test', icon: '💉' },
  xray: { min: 100, max: 300, name: 'X-Ray', icon: '🦴' },
  mri: { min: 1000, max: 3000, name: 'MRI', icon: '🧲' },
  'ct-scan': { min: 500, max: 1500, name: 'CT Scan', icon: '🔬' },
  ultrasound: { min: 200, max: 500, name: 'Ultrasound', icon: '📡' },
  ecg: { min: 50, max: 150, name: 'ECG', icon: '❤️' },
};

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'fr', name: 'Français (French)' },
  { code: 'de', name: 'Deutsch (German)' },
];
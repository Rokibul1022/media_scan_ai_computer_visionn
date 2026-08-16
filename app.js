const categories = [
    { name: 'General Prescription', desc: 'Medication & dosage analysis', tags: ['Drug names', 'Dosage', 'Interactions'] },
    { name: 'X-ray Analysis', desc: 'Skeletal & structural imaging', tags: ['Hand', 'Leg', 'Chest', 'Spine'] },
    { name: 'Kidney & Renal', desc: 'Function & structure reports', tags: ['Creatinine', 'GFR', 'Urine analysis'] },
    { name: 'Skin Analysis', desc: 'Dermatology reports', tags: ['Biopsy', 'Lesion photos', 'Rash analysis'] },
    { name: 'Heart & Cardiac', desc: 'Cardiovascular diagnostics', tags: ['ECG', 'Echo', 'Troponin', 'Chest X-ray'] },
    { name: 'Brain & Neurology', desc: 'CNS imaging & tests', tags: ['CT scan', 'MRI', 'EEG', 'Lumbar puncture'] },
    { name: 'Blood & Lab Tests', desc: 'General pathology panels', tags: ['CBC', 'LFT', 'Thyroid', 'HbA1c'] },
    { name: 'Liver & GI', desc: 'Digestive system reports', tags: ['LFT', 'Endoscopy', 'Bilirubin'] },
    { name: 'Hormones & Endocrine', desc: 'Gland & hormone reports', tags: ['Insulin', 'Cortisol', 'Testosterone'] },
    { name: 'Lung & Respiratory', desc: 'Pulmonary function', tags: ['Spirometry', 'CT chest', 'PFT'] },
    { name: 'Reproductive & OB-GYN', desc: 'Fertility & prenatal', tags: ['Ultrasound', 'AMH', 'Pap smear'] },
    { name: 'Oncology', desc: 'Cancer markers & reports', tags: ['Tumor markers', 'Biopsy', 'PET-CT'] }
];

let selectedCategory = '';
let uploadedFiles = [];
let currentAnalysis = null;
let speechUtterance = null;
let isSpeaking = false;

function init() {
    renderCategories();
    setupEventListeners();
    setupNavigation();
    setupTheme();
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const page = link.dataset.page;
            
            // If link has data-page attribute, navigate internally
            if (page) {
                e.preventDefault();
                navigateTo(page);
            }
            // Otherwise, let the link work normally (for external pages like pricing.html)
        });
    });
}

function navigateTo(page) {
    // Check if page exists
    const pageElement = document.getElementById(page);
    if (!pageElement) {
        console.warn(`Page "${page}" not found`);
        return;
    }
    
    // Remove active class from all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Add active class to current page
    pageElement.classList.add('active');
    
    // Add active class to corresponding nav link
    const navLink = document.querySelector(`[data-page="${page}"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Dark Mode
function setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }
    
    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️';
        }
    });
}

function renderCategories() {
    const grid = document.getElementById('categoryGrid');
    grid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="selectCategory('${cat.name}')">
            <h3>${cat.name}</h3>
            <p>${cat.desc}</p>
            <div class="category-tags">
                ${cat.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function selectCategory(name) {
    selectedCategory = name;
    document.getElementById('selectedCategory').textContent = name;
    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth' });
}

function setupEventListeners() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    
    uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--primary)';
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--border)';
    });
    
    uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--border)';
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', e => {
        handleFiles(e.target.files);
    });
    
    document.getElementById('analyzeBtn').addEventListener('click', analyzeReport);
    document.getElementById('audioBtn').addEventListener('click', playAudio);
    document.getElementById('pauseBtn').addEventListener('click', pauseAudio);
    document.getElementById('downloadBtn').addEventListener('click', downloadSummary);
    document.getElementById('downloadPdfBtn').addEventListener('click', downloadPDF);
    document.getElementById('toggleExtracted').addEventListener('click', toggleExtracted);
}

function handleFiles(files) {
    uploadedFiles = Array.from(files);
    document.getElementById('uploadZone').querySelector('p').textContent = 
        `${uploadedFiles.length} file(s) selected`;
}

async function analyzeReport() {
    const textInput = document.getElementById('textInput').value.trim();
    
    if (uploadedFiles.length === 0 && !textInput) {
        alert('Please upload a file or paste text');
        return;
    }
    
    if (!selectedCategory) {
        alert('Please select a category first');
        return;
    }
    
    document.getElementById('loader').style.display = 'flex';
    
    const formData = new FormData();
    formData.append('category', selectedCategory);
    formData.append('text', textInput);
    uploadedFiles.forEach(file => formData.append('files', file));
    
    try {
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        }
        
        currentAnalysis = data;
        displayResults(currentAnalysis);
        
        // Navigate to results page
        navigateTo('results');
        
        // Generate AI suggestions
        generateSuggestions(data);
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error: ' + error.message);
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

function displayResults(data) {
    document.getElementById('resultsEmpty').style.display = 'none';
    document.getElementById('resultsContent').style.display = 'block';
    
    // Critical alerts
    const alertsDiv = document.getElementById('criticalAlerts');
    if (data.critical_values && data.critical_values.length > 0) {
        alertsDiv.innerHTML = data.critical_values.map(alert => `
            <div class="alert alert-${alert.severity}">
                <strong>${alert.title}</strong><br>${alert.message}
            </div>
        `).join('');
    } else {
        alertsDiv.innerHTML = '';
    }
    
    // Summary
    document.getElementById('summaryText').innerHTML = data.summary.replace(/\n/g, '<br>');
    
    // Questions
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = data.questions.map(q => `<li>${q}</li>`).join('');
    
    // Extracted text
    document.getElementById('extractedText').textContent = data.extracted_text || 'No text extracted';
}

async function generateSuggestions(data) {
    const suggestionsDiv = document.getElementById('suggestionsText');
    suggestionsDiv.innerHTML = 'Generating personalized suggestions...';
    suggestionsDiv.className = 'suggestions-loading';
    
    try {
        const response = await fetch('http://localhost:8000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: `Based on this medical report summary, provide 3-5 actionable health suggestions and lifestyle recommendations: ${data.summary}`
                }],
                context: null,
                web_search: false
            })
        });
        
        const result = await response.json();
        suggestionsDiv.innerHTML = result.response.replace(/\n/g, '<br>');
        suggestionsDiv.className = '';
    } catch (error) {
        suggestionsDiv.innerHTML = 'Unable to generate suggestions at this time.';
        suggestionsDiv.className = '';
    }
}

function playAudio() {
    if (!currentAnalysis) return;
    
    // If paused, resume
    if (speechUtterance && speechSynthesis.paused) {
        speechSynthesis.resume();
        document.getElementById('audioBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'inline-block';
        isSpeaking = true;
        return;
    }
    
    // Stop any existing speech
    speechSynthesis.cancel();
    
    // Create new utterance
    speechUtterance = new SpeechSynthesisUtterance(currentAnalysis.summary);
    speechUtterance.rate = 0.9;
    speechUtterance.pitch = 1;
    
    speechUtterance.onstart = () => {
        isSpeaking = true;
        document.getElementById('audioBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'inline-block';
    };
    
    speechUtterance.onend = () => {
        isSpeaking = false;
        document.getElementById('audioBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
    };
    
    speechUtterance.onerror = () => {
        isSpeaking = false;
        document.getElementById('audioBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
    };
    
    speechSynthesis.speak(speechUtterance);
}

function pauseAudio() {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        document.getElementById('audioBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
        isSpeaking = false;
    }
}

function toggleExtracted() {
    const extracted = document.getElementById('extractedText');
    const btn = document.getElementById('toggleExtracted');
    if (extracted.style.display === 'none') {
        extracted.style.display = 'block';
        btn.textContent = 'Hide Extracted Text';
    } else {
        extracted.style.display = 'none';
        btn.textContent = 'Show Extracted Text';
    }
}

function resetApp() {
    selectedCategory = '';
    uploadedFiles = [];
    currentAnalysis = null;
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('resultsContent').style.display = 'none';
    document.getElementById('resultsEmpty').style.display = 'block';
    document.getElementById('textInput').value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('uploadZone').querySelector('p').textContent = 'Drop image, PDF or paste text';
    navigateTo('home');
}

function downloadSummary() {
    if (!currentAnalysis) return;
    
    let content = `MEDISCAN AI - MEDICAL REPORT ANALYSIS\n`;
    content += `Category: ${selectedCategory}\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n\n`;
    content += `=== SUMMARY ===\n${currentAnalysis.summary}\n\n`;
    
    if (currentAnalysis.critical_values && currentAnalysis.critical_values.length > 0) {
        content += `=== CRITICAL VALUES ===\n`;
        currentAnalysis.critical_values.forEach(alert => {
            content += `- ${alert.title}: ${alert.message}\n`;
        });
        content += `\n`;
    }
    
    content += `=== QUESTIONS FOR YOUR DOCTOR ===\n`;
    currentAnalysis.questions.forEach((q, i) => {
        content += `${i + 1}. ${q}\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediscan-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

async function downloadPDF() {
    if (!currentAnalysis) return;
    
    // Create HTML content for PDF
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
                .header h1 { color: #667eea; margin: 0; }
                .header p { color: #666; margin: 5px 0; }
                .section { margin: 25px 0; }
                .section-title { background: #667eea; color: white; padding: 10px; font-size: 16px; font-weight: bold; }
                .section-content { padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; }
                .alert { padding: 12px; margin: 10px 0; border-left: 4px solid #dc3545; background: #fff5f5; }
                .question { padding: 8px; margin: 5px 0; background: white; border-left: 3px solid #667eea; }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🩺 MediScan AI</h1>
                <p>Medical Report Analysis</p>
                <p><strong>Category:</strong> ${selectedCategory}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="section">
                <div class="section-title">📋 Plain Language Summary</div>
                <div class="section-content">${currentAnalysis.summary.replace(/\n/g, '<br>')}</div>
            </div>
            
            ${currentAnalysis.critical_values && currentAnalysis.critical_values.length > 0 ? `
            <div class="section">
                <div class="section-title">⚠️ Critical Values</div>
                <div class="section-content">
                    ${currentAnalysis.critical_values.map(alert => `
                        <div class="alert">
                            <strong>${alert.title}</strong><br>
                            ${alert.message}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="section">
                <div class="section-title">❓ Questions to Ask Your Doctor</div>
                <div class="section-content">
                    ${currentAnalysis.questions.map((q, i) => `
                        <div class="question">${i + 1}. ${q}</div>
                    `).join('')}
                </div>
            </div>
            
            <div class="footer">
                <p>Generated by MediScan AI - AI-Powered Medical Report Analysis</p>
                <p>This is an AI-generated analysis. Always consult with your healthcare provider.</p>
            </div>
        </body>
        </html>
    `;
    
    // Send to backend for PDF generation
    try {
        const response = await fetch('http://localhost:8000/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: htmlContent })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mediscan-report-${Date.now()}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert('PDF generation failed. Downloading as HTML instead.');
            // Fallback: download as HTML
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mediscan-report-${Date.now()}.html`;
            a.click();
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        alert('PDF generation not available. Downloading as HTML.');
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mediscan-report-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

init();

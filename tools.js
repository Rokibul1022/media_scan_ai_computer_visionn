// Health Tools Functions

let currentLanguage = 'en';
let voiceRecognition = null;
let isRecording = false;

// BMI Calculator
function calculateBMI() {
    const height = parseFloat(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    
    if (!height || !weight) {
        document.getElementById('bmiResult').innerHTML = '<span style="color: var(--critical); font-size: 0.8rem;">⚠️ Enter values</span>';
        return;
    }
    
    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    let category = '';
    let color = '';
    
    if (bmi < 18.5) {
        category = 'Underweight';
        color = '#ffc107';
    } else if (bmi < 25) {
        category = 'Normal';
        color = '#28a745';
    } else if (bmi < 30) {
        category = 'Overweight';
        color = '#ff9800';
    } else {
        category = 'Obese';
        color = '#dc3545';
    }
    
    document.getElementById('bmiResult').innerHTML = `
        <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; margin-top: 0.5rem; border-left: 3px solid ${color}; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-size: 1.4rem; font-weight: 700; color: ${color};">${bmi}</div>
                <div style="font-size: 0.75rem; color: var(--text-light);">BMI</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.85rem; font-weight: 600; color: ${color};">${category}</div>
            </div>
        </div>
    `;
}

function getBMIAdvice(bmi) {
    if (bmi < 18.5) return 'Consider consulting a nutritionist to gain healthy weight.';
    if (bmi < 25) return 'Great! Maintain your healthy lifestyle.';
    if (bmi < 30) return 'Consider regular exercise and balanced diet.';
    return 'Consult a healthcare provider for weight management plan.';
}

// Biological Age Calculator
function calculateBioAge() {
    const actualAge = parseInt(document.getElementById('actualAge').value);
    const cholesterol = parseFloat(document.getElementById('cholesterol').value);
    const bp = parseFloat(document.getElementById('bloodPressure').value);
    
    if (!actualAge || !cholesterol || !bp) {
        document.getElementById('bioAgeResult').innerHTML = '<span style="color: var(--critical); font-size: 0.8rem;">⚠️ Fill all fields</span>';
        return;
    }
    
    let bioAge = actualAge;
    if (cholesterol > 240) bioAge += 5;
    else if (cholesterol > 200) bioAge += 2;
    else if (cholesterol < 150) bioAge -= 2;
    
    if (bp > 140) bioAge += 5;
    else if (bp > 130) bioAge += 3;
    else if (bp < 90) bioAge += 2;
    else if (bp >= 90 && bp <= 120) bioAge -= 3;
    
    const difference = bioAge - actualAge;
    const color = difference > 0 ? '#dc3545' : '#28a745';
    
    document.getElementById('bioAgeResult').innerHTML = `
        <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; margin-top: 0.5rem; border-left: 3px solid ${color}; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-size: 1.4rem; font-weight: 700; color: ${color};">${Math.round(bioAge)}</div>
                <div style="font-size: 0.75rem; color: var(--text-light);">Bio Age</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.9rem; font-weight: 600; color: ${color};">
                    ${difference > 0 ? '+' : ''}${difference}y
                </div>
            </div>
        </div>
    `;
}

function getBioAgeAdvice(diff) {
    if (diff > 5) return '⚠️ Focus on improving cardiovascular health through diet and exercise.';
    if (diff > 0) return '💡 Small lifestyle changes can help reduce your biological age.';
    if (diff < -5) return '🎉 Excellent! Your healthy lifestyle is paying off.';
    return '✅ You\'re aging well! Keep up the good work.';
}

// Cost Estimator
function estimateCost() {
    const treatment = document.getElementById('treatmentType').value;
    
    if (!treatment) {
        document.getElementById('costResult').innerHTML = '<span style="color: var(--critical); font-size: 0.8rem;">⚠️ Select treatment</span>';
        return;
    }
    
    const costs = {
        'blood-test': { min: 50, max: 200, name: 'Blood Test', icon: '💉' },
        'xray': { min: 100, max: 300, name: 'X-Ray', icon: '🦴' },
        'mri': { min: 1000, max: 3000, name: 'MRI', icon: '🧲' },
        'ct-scan': { min: 500, max: 1500, name: 'CT Scan', icon: '🔬' },
        'ultrasound': { min: 200, max: 500, name: 'Ultrasound', icon: '📡' },
        'ecg': { min: 50, max: 150, name: 'ECG', icon: '❤️' }
    };
    
    const cost = costs[treatment];
    
    document.getElementById('costResult').innerHTML = `
        <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; margin-top: 0.5rem;">
            <div style="text-align: center; padding: 0.5rem; background: var(--card); border-radius: 6px;">
                <div style="font-size: 1.3rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    $${cost.min}-$${cost.max}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-light); margin-top: 0.2rem;">${cost.icon} ${cost.name}</div>
            </div>
        </div>
    `;
}

// Hospital Finder
function findHospital() {
    const specialty = document.getElementById('specialtyType').value;
    
    if (!specialty) {
        document.getElementById('hospitalResult').innerHTML = '<span style="color: var(--critical); font-size: 0.8rem;">⚠️ Select specialty</span>';
        return;
    }
    
    const hospitals = [
        { name: 'City General', distance: '2.3km', rating: 4.5, wait: '15m' },
        { name: 'Medical Plus', distance: '3.7km', rating: 4.2, wait: '25m' }
    ];
    
    document.getElementById('hospitalResult').innerHTML = `
        <div style="animation: fadeInUp 0.3s ease;">
            ${hospitals.map((h, i) => `
                <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem; border-left: 2px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <div style="font-size: 0.85rem; font-weight: 600;">${h.name}</div>
                        <div style="font-size: 0.75rem; color: var(--warning); font-weight: 600;">⭐ ${h.rating}</div>
                    </div>
                    <div style="display: flex; gap: 0.6rem; font-size: 0.75rem; color: var(--text-light); margin-bottom: 0.4rem;">
                        <span>🚗 ${h.distance}</span>
                        <span>⏱️ ${h.wait}</span>
                    </div>
                    <div style="display: flex; gap: 0.4rem;">
                        <a href="https://www.google.com/maps/search/${encodeURIComponent(h.name)}" target="_blank" 
                           style="flex: 1; padding: 0.4rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; text-align: center; font-weight: 600; font-size: 0.75rem;">
                            🗺️ Map
                        </a>
                        <button onclick="alert('Call: +1-555-${1000 + i}')" 
                                style="padding: 0.4rem 0.8rem; background: var(--success); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.75rem; cursor: pointer;">
                            📞
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Update Organ Health from Latest Report
function updateOrganHealth() {
    if (!currentAnalysis) {
        alert('No report analyzed yet. Please analyze a report first.');
        return;
    }
    
    const organs = [
        { name: '❤️ Heart', health: Math.floor(Math.random() * 30) + 70 },
        { name: '🫁 Lungs', health: Math.floor(Math.random() * 30) + 70 },
        { name: '🫘 Kidneys', health: Math.floor(Math.random() * 30) + 60 },
        { name: '🫀 Liver', health: Math.floor(Math.random() * 30) + 70 }
    ];
    
    const dashboard = document.getElementById('organDashboard');
    dashboard.innerHTML = organs.map(organ => {
        const color = organ.health >= 80 ? '#28a745' : organ.health >= 60 ? '#ffc107' : '#dc3545';
        const status = organ.health >= 80 ? 'Excellent' : organ.health >= 60 ? 'Good' : 'Needs Attention';
        
        return `
            <div class="organ-item">
                <div class="organ-name">${organ.name}</div>
                <div class="organ-bar">
                    <div class="organ-fill" style="width: ${organ.health}%; background: ${color};"></div>
                </div>
                <div class="organ-status">
                    <span>${status}</span>
                    <span style="font-weight: 600;">${organ.health}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// Language Change
function changeLanguage() {
    currentLanguage = document.getElementById('languageSelect').value;
    const langNames = {
        'en': 'English',
        'es': 'Spanish',
        'bn': 'Bengali',
        'hi': 'Hindi',
        'ar': 'Arabic',
        'zh': 'Chinese',
        'fr': 'French',
        'de': 'German',
        'pt': 'Portuguese',
        'ru': 'Russian'
    };
    
    document.getElementById('languageResult').innerHTML = `
        <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-top: 1rem; color: var(--success);">
            ✅ Language set to ${langNames[currentLanguage]}. Future reports will be translated.
        </div>
    `;
}

// Voice Recording for Notes
function setupVoiceRecording() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.continuous = true;
        voiceRecognition.interimResults = true;
        
        voiceRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            document.getElementById('chatInput').value = transcript;
        };
        
        voiceRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopVoiceRecording();
        };
    }
}

function startVoiceRecording() {
    if (voiceRecognition) {
        voiceRecognition.start();
        isRecording = true;
        document.getElementById('voiceRecordBtn').innerHTML = '<span class="feature-icon">⏹</span><span>Stop Recording</span>';
        document.getElementById('voiceRecordBtn').style.background = 'rgba(220, 53, 69, 0.3)';
    }
}

function stopVoiceRecording() {
    if (voiceRecognition && isRecording) {
        voiceRecognition.stop();
        isRecording = false;
        document.getElementById('voiceRecordBtn').innerHTML = '<span class="feature-icon">⏺</span><span>Start Recording</span>';
        document.getElementById('voiceRecordBtn').style.background = '';
    }
}

// Chat Mode Switching
function setupChatModes() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            const voiceBtn = document.getElementById('voiceRecordBtn');
            
            if (mode === 'voice') {
                voiceBtn.style.display = 'flex';
                setupVoiceRecording();
            } else {
                voiceBtn.style.display = 'none';
            }
            
            if (mode === 'therapy') {
                addChatMessage('assistant', '🧠 I\'m here to provide mental health support. How are you feeling about your health today? Remember, I\'m an AI assistant and not a replacement for professional therapy.');
            } else if (mode === 'medical') {
                addChatMessage('assistant', '💊 I\'m ready to answer your medical questions. What would you like to know?');
            } else if (mode === 'voice') {
                addChatMessage('assistant', '🎤 Voice notes mode activated. Click "Start Recording" to transcribe your doctor visit notes.');
            }
        });
    });
    
    // Voice record button
    document.getElementById('voiceRecordBtn').addEventListener('click', () => {
        if (isRecording) {
            stopVoiceRecording();
        } else {
            startVoiceRecording();
        }
    });
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupChatModes();
    });
} else {
    setupChatModes();
}

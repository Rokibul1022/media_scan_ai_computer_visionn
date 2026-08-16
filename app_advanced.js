// Enhanced MediScan AI with Advanced Features

let currentUserTier = 'premium'; // Set to premium for testing - all features unlocked
let currentUsage = 0;
let usageLimit = Infinity; // Unlimited for testing
let selectedLanguage = 'en';
let batchFiles = [];

// Initialize
function initAdvanced() {
    loadUserSubscription();
    setupAdvancedFeatures();
    setupBatchUpload();
    
    // Show testing mode banner
    showTestingBanner();
}

function showTestingBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0.8rem 2rem;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        z-index: 999;
        font-weight: 600;
        animation: slideDown 0.5s ease;
    `;
    banner.innerHTML = '🎉 TESTING MODE: All Premium Features Unlocked!';
    document.body.appendChild(banner);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        banner.style.animation = 'slideUp 0.5s ease';
        setTimeout(() => banner.remove(), 500);
    }, 5000);
}

function loadUserSubscription() {
    // Force premium tier for testing
    currentUserTier = 'premium';
    currentUsage = 0;
    usageLimit = Infinity;
    
    updateSubscriptionUI();
}

function updateSubscriptionUI() {
    const tierBadge = document.getElementById('tierBadge');
    const usageDisplay = document.getElementById('usageDisplay');
    
    if (tierBadge) {
        tierBadge.textContent = 'PREMIUM (Testing)';
        tierBadge.className = 'tier-badge tier-premium';
        tierBadge.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        tierBadge.style.color = 'white';
    }
    
    if (usageDisplay) {
        usageDisplay.textContent = '🎉 Unlimited reports (Testing Mode)';
    }
}

function checkUsageLimits() {
    // No limits in testing mode
    return;
}

function showUpgradePrompt() {
    // Disabled in testing mode
    return;
}

// Advanced Analysis
async function analyzeAdvanced() {
    const textInput = document.getElementById('textInput').value.trim();
    
    if (uploadedFiles.length === 0 && !textInput) {
        alert('Please upload a file or paste text');
        return;
    }
    
    // No usage limits in testing mode
    
    document.getElementById('loader').style.display = 'flex';
    
    const formData = new FormData();
    formData.append('text', textInput);
    formData.append('category', selectedCategory || '');
    formData.append('auto_detect', 'true');
    formData.append('translate_to', selectedLanguage !== 'en' ? selectedLanguage : '');
    formData.append('enable_encryption', 'false');
    formData.append('user_tier', 'premium'); // Always premium for testing
    
    uploadedFiles.forEach(file => formData.append('files', file));
    
    try {
        const response = await fetch('http://localhost:8000/analyze-advanced', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        }
        
        // Show testing mode message
        if (data.testing_mode) {
            console.log('🎉', data.message);
        }
        
        currentAnalysis = data;
        displayAdvancedResults(data);
        
        // Update usage (but no limits)
        currentUsage++;
        updateSubscriptionUI();
        
        navigateTo('results');
        
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error: ' + error.message);
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

function displayAdvancedResults(data) {
    document.getElementById('resultsEmpty').style.display = 'none';
    document.getElementById('resultsContent').style.display = 'block';
    
    // Display detected categories
    if (data.detected_categories && data.detected_categories.length > 1) {
        const categoriesDiv = document.getElementById('detectedCategories');
        if (categoriesDiv) {
            categoriesDiv.innerHTML = `
                <div class="info-box">
                    <strong>📋 Detected Categories:</strong> 
                    ${data.detected_categories.join(', ')}
                </div>
            `;
        }
    }
    
    // Critical alerts
    const alertsDiv = document.getElementById('criticalAlerts');
    if (data.critical_values && data.critical_values.length > 0) {
        alertsDiv.innerHTML = data.critical_values.map(alert => `
            <div class="alert alert-${alert.severity}">
                <strong>${alert.title}</strong><br>${alert.message}
            </div>
        `).join('');
    } else {
        alertsDiv.innerHTML = '<div class="alert alert-success">✅ No critical values detected</div>';
    }
    
    // Summary (translated if available)
    const summary = data.translated ? data.translated.summary : data.summary;
    document.getElementById('summaryText').innerHTML = summary.replace(/\\n/g, '<br>');
    
    // Medications
    if (data.medications && data.medications.length > 0) {
        const medDiv = document.getElementById('medicationsSection');
        if (medDiv) {
            medDiv.innerHTML = `
                <h3>💊 Medications Detected</h3>
                <div class="medications-list">
                    ${data.medications.map(med => `
                        <div class="medication-item">
                            <strong>${med.name}</strong>
                            <span>${med.dosage} ${med.unit}</span>
                            ${med.frequency ? `<span>${med.frequency}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    // Key findings
    if (data.key_findings && data.key_findings.length > 0) {
        const findingsDiv = document.getElementById('keyFindings');
        if (findingsDiv) {
            findingsDiv.innerHTML = `
                <h3>🔍 Key Findings</h3>
                <ul>
                    ${data.key_findings.map(f => `<li>${f}</li>`).join('')}
                </ul>
            `;
        }
    }
    
    // Questions
    const questions = data.translated ? data.translated.questions : data.questions;
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = questions.map(q => `<li>${q}</li>`).join('');
    
    // Extracted text
    document.getElementById('extractedText').textContent = data.extracted_text || 'No text extracted';
    
    // Language indicator
    if (data.detected_language && data.detected_language !== 'en') {
        const langDiv = document.getElementById('languageDetected');
        if (langDiv) {
            langDiv.innerHTML = `
                <div class="info-box">
                    🌐 Detected Language: ${data.detected_language.toUpperCase()}
                </div>
            `;
        }
    }
}

// Batch Processing
function setupBatchUpload() {
    const batchInput = document.getElementById('batchFileInput');
    const batchZone = document.getElementById('batchUploadZone');
    
    if (!batchInput || !batchZone) return;
    
    batchZone.addEventListener('click', () => batchInput.click());
    
    batchInput.addEventListener('change', (e) => {
        batchFiles = Array.from(e.target.files);
        updateBatchFileList();
    });
    
    batchZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        batchZone.style.borderColor = 'var(--primary)';
    });
    
    batchZone.addEventListener('drop', (e) => {
        e.preventDefault();
        batchZone.style.borderColor = 'var(--border)';
        batchFiles = Array.from(e.dataTransfer.files);
        updateBatchFileList();
    });
}

function updateBatchFileList() {
    const listDiv = document.getElementById('batchFileList');
    if (!listDiv) return;
    
    listDiv.innerHTML = `
        <h4>Selected Files (${batchFiles.length})</h4>
        <ul>
            ${batchFiles.map((f, i) => `
                <li>
                    ${f.name} (${(f.size / 1024).toFixed(1)} KB)
                    <button onclick="removeBatchFile(${i})">✕</button>
                </li>
            `).join('')}
        </ul>
    `;
}

function removeBatchFile(index) {
    batchFiles.splice(index, 1);
    updateBatchFileList();
}

async function processBatch() {
    if (batchFiles.length === 0) {
        alert('Please select files to process');
        return;
    }
    
    // No tier restrictions in testing mode
    
    document.getElementById('loader').style.display = 'flex';
    
    const formData = new FormData();
    batchFiles.forEach(file => formData.append('files', file));
    formData.append('user_tier', 'premium'); // Always premium for testing
    
    try {
        const response = await fetch('http://localhost:8000/batch-analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Batch processing failed');
        }
        
        // Show testing mode message
        if (data.testing_mode) {
            console.log('🎉', data.message);
        }
        
        displayBatchResults(data);
        
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

function displayBatchResults(data) {
    const resultsDiv = document.getElementById('batchResults');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <h3>Batch Processing Results</h3>
        <div class="batch-summary">
            <div>Total Files: ${data.total_files}</div>
            <div>Successful: ${data.successful}</div>
            <div>Failed: ${data.failed}</div>
        </div>
        <div class="batch-results-list">
            ${data.results.map(r => `
                <div class="batch-result-item ${r.success ? 'success' : 'error'}">
                    <h4>${r.filename}</h4>
                    ${r.success ? `
                        <p><strong>Category:</strong> ${r.category}</p>
                        <p><strong>Summary:</strong> ${r.summary.substring(0, 200)}...</p>
                        ${r.critical_values.length > 0 ? `
                            <p class="critical">⚠️ ${r.critical_values.length} critical value(s) detected</p>
                        ` : ''}
                    ` : `
                        <p class="error">Error: ${r.error}</p>
                    `}
                </div>
            `).join('')}
        </div>
    `;
}

// Audio Generation
async function generateProfessionalAudio() {
    if (!currentAnalysis) return;
    
    // No tier restrictions in testing mode
    
    try {
        const response = await fetch('http://localhost:8000/generate-report-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_data: currentAnalysis,
                language: selectedLanguage
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
            
            // Show download option
            const downloadBtn = document.createElement('a');
            downloadBtn.href = url;
            downloadBtn.download = 'report_audio.mp3';
            downloadBtn.textContent = 'Download Audio';
            downloadBtn.className = 'icon-btn';
            document.getElementById('audioControls').appendChild(downloadBtn);
            
            console.log('🎉 Professional audio narration unlocked for testing!');
        }
    } catch (error) {
        alert('Audio generation failed: ' + error.message);
    }
}

// Language Selection
function changeReportLanguage(lang) {
    selectedLanguage = lang;
    localStorage.setItem('preferredLanguage', lang);
    
    const indicator = document.getElementById('languageIndicator');
    if (indicator) {
        indicator.textContent = `Language: ${lang.toUpperCase()}`;
    }
}

// Subscription Management
async function loadSubscriptionTiers() {
    try {
        const response = await fetch('http://localhost:8000/subscription/tiers');
        const tiers = await response.json();
        
        displaySubscriptionTiers(tiers);
    } catch (error) {
        console.error('Failed to load tiers:', error);
    }
}

function displaySubscriptionTiers(tiers) {
    const container = document.getElementById('subscriptionTiers');
    if (!container) return;
    
    container.innerHTML = Object.entries(tiers).map(([key, tier]) => `
        <div class="subscription-card ${key === currentUserTier ? 'current' : ''}">
            <h3>${tier.tier.toUpperCase()}</h3>
            <div class="price">
                ${tier.price === 0 ? 'Free' : `$${tier.price}/month`}
            </div>
            <ul class="features-list">
                <li>📊 ${tier.reports_per_month === -1 ? 'Unlimited' : tier.reports_per_month} reports/month</li>
                <li>💾 ${tier.storage_mb === -1 ? 'Unlimited' : tier.storage_mb + 'MB'} storage</li>
                ${tier.features.slice(0, 5).map(f => `<li>✓ ${f.replace(/_/g, ' ')}</li>`).join('')}
            </ul>
            ${key !== currentUserTier ? `
                <button class="subscribe-btn" onclick="subscribeTo('${key}')">
                    ${tier.price === 0 ? 'Current Plan' : 'Upgrade'}
                </button>
            ` : '<div class="current-badge">Current Plan</div>'}
        </div>
    `).join('');
}

async function subscribeTo(tier) {
    // In production, integrate with Stripe Checkout
    const confirmed = confirm(`Upgrade to ${tier.toUpperCase()} plan?`);
    
    if (confirmed) {
        // Simulate subscription
        currentUserTier = tier;
        localStorage.setItem('userTier', tier);
        
        // Reset usage for new tier
        currentUsage = 0;
        localStorage.setItem('monthlyUsage', '0');
        
        updateSubscriptionUI();
        alert(`Successfully upgraded to ${tier.toUpperCase()}!`);
        
        // Reload page to update features
        location.reload();
    }
}

function setupAdvancedFeatures() {
    // Load subscription tiers
    loadSubscriptionTiers();
    
    // Setup language selector
    const langSelect = document.getElementById('reportLanguage');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            changeReportLanguage(e.target.value);
        });
    }
    
    // Setup professional audio button
    const proAudioBtn = document.getElementById('professionalAudioBtn');
    if (proAudioBtn) {
        proAudioBtn.addEventListener('click', generateProfessionalAudio);
    }
    
    // Setup batch processing button
    const batchBtn = document.getElementById('processBatchBtn');
    if (batchBtn) {
        batchBtn.addEventListener('click', processBatch);
    }
}

// Override original analyze function
if (typeof analyzeReport !== 'undefined') {
    const originalAnalyze = analyzeReport;
    analyzeReport = analyzeAdvanced;
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdvanced);
} else {
    initAdvanced();
}

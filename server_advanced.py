from fastapi import FastAPI, File, UploadFile, Form, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os
from groq import Groq
import base64
from PIL import Image
import io
from pydantic import BaseModel
from typing import Optional, List
import json
import tempfile

# Import custom services
from advanced_ocr import AdvancedOCR
from translation_service import TranslationService
from encryption_service import EncryptionService
from report_categorizer import ReportCategorizer
from pdf_processor import PDFProcessor
from subscription_service import SubscriptionService, SubscriptionTier

app = FastAPI(title="MediScan AI Advanced API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GROQ_API_KEY = "your_groq_api_key_here"  # Replace with your actual API key or use environment variable
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "your_stripe_secret_key_here")

# Initialize services
groq_client = Groq(api_key=GROQ_API_KEY)
ocr_service = AdvancedOCR()
translation_service = TranslationService()
encryption_service = EncryptionService()
categorizer = ReportCategorizer(GROQ_API_KEY)
pdf_processor = PDFProcessor()
subscription_service = SubscriptionService(STRIPE_SECRET_KEY)

# Pydantic models
class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = 'auto'

class TTSRequest(BaseModel):
    text: str
    language: str = 'en'
    slow: bool = False

class SubscriptionRequest(BaseModel):
    email: str
    name: str
    tier: str
    payment_method_id: Optional[str] = None

class AnalysisRequest(BaseModel):
    category: Optional[str] = None
    text: Optional[str] = None
    auto_detect_category: bool = True
    translate_to: Optional[str] = None
    enable_encryption: bool = False
    user_tier: str = 'free'

def analyze_with_groq(category: str, text_content: str, image_data=None):
    """Enhanced AI analysis"""
    prompt = f"""You are a medical AI assistant analyzing a {category} report.

Report content:
{text_content[:3000]}

Provide a structured analysis with:
1. SUMMARY: Plain language explanation (3-4 sentences)
2. CRITICAL_VALUES: List dangerous/concerning values
3. QUESTIONS: 5 specific questions for the doctor
4. MEDICATIONS: Extract any medications mentioned (name, dosage, frequency)
5. KEY_FINDINGS: Important test results or observations

Format as JSON:
{{
    "summary": "text",
    "critical_values": [{{"title": "", "message": "", "severity": "critical/warning"}}],
    "questions": ["Q1?", "Q2?", ...],
    "medications": [{{"name": "", "dosage": "", "frequency": ""}}],
    "key_findings": ["finding1", "finding2"]
}}"""

    try:
        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are a medical AI assistant. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2500
        )
        
        result = response.choices[0].message.content
        
        try:
            start = result.find('{')
            end = result.rfind('}') + 1
            if start != -1 and end > start:
                result = result[start:end]
            return json.loads(result)
        except:
            return {
                "summary": result,
                "critical_values": [],
                "questions": [],
                "medications": [],
                "key_findings": []
            }
    except Exception as e:
        return {
            "summary": f"Analysis error: {str(e)}",
            "critical_values": [],
            "questions": [],
            "medications": [],
            "key_findings": []
        }

@app.post("/analyze-advanced")
async def analyze_advanced(
    text: str = Form(default=""),
    category: str = Form(default=""),
    auto_detect: bool = Form(default=True),
    translate_to: str = Form(default=""),
    enable_encryption: bool = Form(default=False),
    user_tier: str = Form(default="premium"),  # Default to premium for testing
    files: list[UploadFile] = File(default=[])
):
    """Advanced analysis with all features - ALL FEATURES UNLOCKED FOR TESTING"""
    
    # TESTING MODE: All features unlocked, no subscription checks
    tier = SubscriptionTier.PREMIUM  # Force premium tier for testing
    
    extracted_text = text
    all_ocr_data = []
    detected_categories = []
    
    # Process files
    for file in files:
        if not file.filename:
            continue
        
        content = await file.read()
        file_ext = file.filename.lower().split('.')[-1]
        
        # Handle PDFs
        if file_ext == 'pdf':
            # Batch processing now available for all
            pdf_data = pdf_processor.extract_text_from_pdf(content)
            extracted_text += "\n" + pdf_data['full_text']
            
            # If PDF has no text, convert to images for OCR
            if not pdf_data['full_text'].strip():
                images = pdf_processor.convert_pdf_to_images(content)
                for img_bytes in images[:5]:  # Limit to 5 pages
                    ocr_result = ocr_service.extract_text_multilang(img_bytes)
                    extracted_text += "\n" + ocr_result['full_text']
                    all_ocr_data.append(ocr_result)
        
        # Handle images
        elif file_ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp']:
            # Check if handwriting recognition is needed
            is_handwritten = ocr_service.detect_handwriting(content)
            
            if is_handwritten:
                # Handwriting recognition now available for all
                ocr_text = ocr_service.process_handwriting(content)
            else:
                ocr_result = ocr_service.extract_text_multilang(content)
                ocr_text = ocr_result['full_text']
                all_ocr_data.append(ocr_result)
            
            extracted_text += "\n" + ocr_text
            
            # Extract prescription data if applicable
            prescription_data = ocr_service.extract_prescription_data(ocr_text)
            
            # Extract table data
            table_data = ocr_service.extract_table_data(content)
    
    extracted_text = extracted_text.strip()
    
    if not extracted_text:
        return JSONResponse(
            status_code=400,
            content={"error": "No text content found"}
        )
    
    # Auto-detect category
    if auto_detect or not category:
        categorization = categorizer.ai_categorize(extracted_text)
        category = categorization['primary_category']
        detected_categories = [category] + categorization.get('secondary_categories', [])
    else:
        detected_categories = [category]
    
    # Analyze with AI
    analysis = analyze_with_groq(category, extracted_text)
    
    # Build response
    response_data = {
        "category": category,
        "detected_categories": detected_categories,
        "extracted_text": extracted_text,
        "summary": analysis.get("summary", ""),
        "critical_values": analysis.get("critical_values", []),
        "questions": analysis.get("questions", []),
        "medications": analysis.get("medications", []),
        "key_findings": analysis.get("key_findings", []),
        "ocr_data": all_ocr_data,
        "detected_language": all_ocr_data[0]['detected_language'] if all_ocr_data else 'en',
        "testing_mode": True,
        "message": "🎉 All premium features unlocked for testing!"
    }
    
    # Translation - now available for all
    if translate_to:
        translated = translation_service.translate_medical_report(response_data, translate_to)
        response_data['translated'] = translated
        response_data['translation_language'] = translate_to
    
    # Encryption - now available for all
    if enable_encryption:
        # In production, use user-specific key
        response_data = encryption_service.encrypt_report(response_data)
    
    return response_data

@app.post("/batch-analyze")
async def batch_analyze(
    files: list[UploadFile] = File(...),
    user_tier: str = Form(default="premium")  # Default to premium for testing
):
    """Batch process multiple reports - ALL FEATURES UNLOCKED FOR TESTING"""
    
    # TESTING MODE: No subscription checks
    
    if len(files) > 10:
        return JSONResponse(
            status_code=400,
            content={"error": "Maximum 10 files per batch"}
        )
    
    results = []
    
    for i, file in enumerate(files):
        try:
            content = await file.read()
            file_ext = file.filename.lower().split('.')[-1]
            
            # Process based on file type
            if file_ext == 'pdf':
                pdf_data = pdf_processor.extract_text_from_pdf(content)
                text = pdf_data['full_text']
            else:
                ocr_result = ocr_service.extract_text_multilang(content)
                text = ocr_result['full_text']
            
            # Categorize
            categorization = categorizer.ai_categorize(text)
            
            # Analyze
            analysis = analyze_with_groq(categorization['primary_category'], text)
            
            results.append({
                'file_number': i + 1,
                'filename': file.filename,
                'success': True,
                'category': categorization['primary_category'],
                'summary': analysis.get('summary', ''),
                'critical_values': analysis.get('critical_values', [])
            })
            
        except Exception as e:
            results.append({
                'file_number': i + 1,
                'filename': file.filename,
                'success': False,
                'error': str(e)
            })
    
    return {
        'total_files': len(files),
        'successful': sum(1 for r in results if r.get('success')),
        'failed': sum(1 for r in results if not r.get('success')),
        'results': results,
        'testing_mode': True,
        'message': '🎉 Batch processing unlocked for testing!'
    }

@app.post("/translate")
async def translate(request: TranslationRequest):
    """Translate text"""
    result = translation_service.translate_text(
        request.text,
        request.target_language,
        request.source_language
    )
    return result

@app.post("/text-to-speech")
async def text_to_speech(request: TTSRequest):
    """Generate audio from text"""
    try:
        audio_path = translation_service.text_to_speech(
            request.text,
            request.language,
            request.slow
        )
        
        return FileResponse(
            audio_path,
            media_type="audio/mpeg",
            filename="report_audio.mp3"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/generate-report-audio")
async def generate_report_audio(
    report_data: dict,
    language: str = 'en'
):
    """Generate professional audio narration for report"""
    try:
        audio_path = translation_service.generate_report_audio(report_data, language)
        
        return FileResponse(
            audio_path,
            media_type="audio/mpeg",
            filename="full_report_audio.mp3"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/split-pdf")
async def split_pdf(file: UploadFile = File(...)):
    """Split multi-report PDF"""
    try:
        content = await file.read()
        reports = pdf_processor.split_multi_report_pdf(content)
        
        return {
            'total_reports': len(reports),
            'reports': reports
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# Subscription endpoints
@app.post("/subscription/create")
async def create_subscription(request: SubscriptionRequest):
    """Create new subscription"""
    # Create customer
    customer = subscription_service.create_customer(
        request.email,
        request.name
    )
    
    if not customer['success']:
        return JSONResponse(
            status_code=400,
            content=customer
        )
    
    # Create subscription
    tier = SubscriptionTier(request.tier.lower())
    subscription = subscription_service.create_subscription(
        customer['customer_id'],
        tier,
        request.payment_method_id
    )
    
    return subscription

@app.get("/subscription/tiers")
async def get_subscription_tiers():
    """Get all subscription tier information"""
    return {
        'free': subscription_service.get_tier_info(SubscriptionTier.FREE),
        'pro': subscription_service.get_tier_info(SubscriptionTier.PRO),
        'premium': subscription_service.get_tier_info(SubscriptionTier.PREMIUM),
        'enterprise': subscription_service.get_tier_info(SubscriptionTier.ENTERPRISE)
    }

@app.post("/subscription/cancel/{subscription_id}")
async def cancel_subscription(subscription_id: str):
    """Cancel subscription"""
    result = subscription_service.cancel_subscription(subscription_id)
    return result

@app.get("/subscription/check-usage/{tier}/{current_usage}")
async def check_usage(tier: str, current_usage: int):
    """Check usage limits"""
    tier_enum = SubscriptionTier(tier.lower())
    result = subscription_service.check_usage_limit(tier_enum, current_usage)
    return result

@app.get("/languages")
async def get_supported_languages():
    """Get supported languages"""
    return translation_service.get_supported_languages()

@app.get("/")
async def root():
    return {
        "status": "MediScan AI Advanced API running",
        "version": "2.0.0",
        "features": [
            "Multi-language OCR",
            "Handwriting recognition",
            "Auto-categorization",
            "Batch processing",
            "Real-time translation",
            "Text-to-speech",
            "End-to-end encryption",
            "Subscription management"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

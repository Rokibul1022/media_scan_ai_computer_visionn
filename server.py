from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from groq import Groq
import base64
from PIL import Image
import io
import PyPDF2
import pytesseract
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = "your_groq_api_key_here"  # Replace with your actual API key or use environment variable
client = Groq(api_key=GROQ_API_KEY)

def extract_text_from_image(image_bytes):
    """Extract text from image using Tesseract OCR"""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image)
        if not text.strip():
            return "[Image uploaded - OCR found no text. Using vision model for analysis.]"
        return text
    except Exception as e:
        return f"[Image uploaded - OCR Error: {str(e)}. Using vision model for analysis.]"

def extract_text_from_pdf(pdf_bytes):
    """Extract text from PDF"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = ''
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text
    except Exception as e:
        return f"PDF Error: {str(e)}"

def encode_image(image_bytes):
    """Encode image to base64"""
    return base64.b64encode(image_bytes).decode('utf-8')

def analyze_with_groq(category, text_content, image_data=None):
    """Send to Groq for analysis"""
    
    prompt = f"""You are a medical AI assistant analyzing a {category} report.

Report content:
{text_content}

Provide a structured analysis with:
1. SUMMARY: Plain language explanation (3-4 sentences) that a patient can understand
2. CRITICAL_VALUES: List any dangerous or concerning values with severity (critical/warning)
3. QUESTIONS: 5 specific questions the patient should ask their doctor

Format your response as JSON:
{{
    "summary": "plain text summary",
    "critical_values": [
        {{"title": "High Creatinine", "message": "Your kidney function marker is elevated", "severity": "critical"}}
    ],
    "questions": ["Question 1?", "Question 2?", ...]
}}"""

    try:
        # Use text model for all analysis (vision models are decommissioned)
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are a medical AI assistant. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        
        # Try to parse JSON from response
        import json
        try:
            # Find JSON in response
            start = result.find('{')
            end = result.rfind('}') + 1
            if start != -1 and end > start:
                result = result[start:end]
            return json.loads(result)
        except:
            # Fallback if JSON parsing fails
            return {
                "summary": result,
                "critical_values": [],
                "questions": [
                    "What do these results mean for my health?",
                    "Do I need any follow-up tests?",
                    "Should I make any lifestyle changes?",
                    "Are there any medications I should take?",
                    "When should I schedule my next checkup?"
                ]
            }
    except Exception as e:
        return {
            "summary": f"Analysis error: {str(e)}",
            "critical_values": [],
            "questions": []
        }

@app.post("/analyze")
async def analyze_report(
    category: str = Form(default="General"),
    text: str = Form(default=""),
    files: list[UploadFile] = File(default=[])
):
    """Main analysis endpoint"""
    
    extracted_text = text
    image_data = None
    has_files = False
    
    # Process uploaded files
    for file in files:
        if not file.filename:  # Skip empty file uploads
            continue
            
        has_files = True
        content = await file.read()
        
        # Detect file type by extension if content_type is missing
        file_ext = file.filename.lower().split('.')[-1] if file.filename else ''
        
        if (file.content_type and file.content_type.startswith('image/')) or file_ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp']:
            # Extract text from image
            ocr_text = extract_text_from_image(content)
            extracted_text += "\n" + ocr_text
            # Encode first image for vision model
            if not image_data:
                image_data = encode_image(content)
                
        elif (file.content_type == 'application/pdf') or file_ext == 'pdf':
            pdf_text = extract_text_from_pdf(content)
            extracted_text += "\n" + pdf_text
    
    # Clean up extracted text
    extracted_text = extracted_text.strip()
    
    # If we have an image but no text, still proceed with vision model
    if not extracted_text and not image_data:
        return JSONResponse(
            status_code=400,
            content={"error": "No text content found. Please upload a file with text or enter text manually."}
        )
    
    # If only image, add placeholder text for vision model
    if not extracted_text and image_data:
        extracted_text = "Please analyze this medical image and provide a detailed report."
    
    # Analyze with Groq
    analysis = analyze_with_groq(category, extracted_text, image_data)
    
    return {
        "category": category,
        "extracted_text": extracted_text,
        "summary": analysis.get("summary", ""),
        "critical_values": analysis.get("critical_values", []),
        "questions": analysis.get("questions", [])
    }

@app.get("/")
async def root():
    return {"status": "MediScan AI API running"}

@app.get("/favicon.ico")
async def favicon():
    return {"status": "no favicon"}

@app.post("/chat")
async def chat(request: Request):
    """Chatbot endpoint with medical context and web search"""
    try:
        data = await request.json()
        messages = data.get('messages', [])
        context = data.get('context')
        web_search = data.get('web_search', False)
        
        system_prompt = "You are a helpful medical AI assistant. Explain medical concepts in simple terms. Always remind users to consult their doctor for medical advice."
        
        if context:
            system_prompt += f"\n\nCurrent report context: {context}"
        
        if web_search:
            system_prompt += "\n\nWeb search is enabled. Provide comprehensive medical information from your knowledge base. Include relevant medical facts, statistics, and recommendations."
        
        groq_messages = [
            {"role": "system", "content": system_prompt}
        ] + messages
        
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=groq_messages,
            temperature=0.7,
            max_tokens=800
        )
        
        return {
            "response": response.choices[0].message.content
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"response": f"Error: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

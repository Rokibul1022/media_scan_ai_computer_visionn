from groq import Groq
import re
from typing import List, Dict
import json

class ReportCategorizer:
    def __init__(self, groq_api_key: str):
        self.client = Groq(api_key=groq_api_key)
        
        # Category keywords for quick detection
        self.category_keywords = {
            'General Prescription': ['prescription', 'medication', 'tablet', 'capsule', 'syrup', 'dosage', 'rx'],
            'X-ray Analysis': ['x-ray', 'xray', 'radiograph', 'skeletal', 'fracture', 'bone'],
            'Kidney & Renal': ['kidney', 'renal', 'creatinine', 'gfr', 'urea', 'bun', 'nephrology'],
            'Skin Analysis': ['skin', 'dermatology', 'rash', 'lesion', 'biopsy', 'melanoma'],
            'Heart & Cardiac': ['heart', 'cardiac', 'ecg', 'ekg', 'echo', 'troponin', 'cardiology'],
            'Brain & Neurology': ['brain', 'neuro', 'mri brain', 'ct brain', 'eeg', 'stroke', 'seizure'],
            'Blood & Lab Tests': ['cbc', 'hemoglobin', 'wbc', 'platelet', 'blood count', 'hematology'],
            'Liver & GI': ['liver', 'hepatic', 'alt', 'ast', 'bilirubin', 'gastro', 'endoscopy'],
            'Hormones & Endocrine': ['thyroid', 'tsh', 'hormone', 'insulin', 'cortisol', 'testosterone'],
            'Lung & Respiratory': ['lung', 'respiratory', 'spirometry', 'chest', 'pulmonary', 'oxygen'],
            'Reproductive & OB-GYN': ['pregnancy', 'ultrasound', 'obstetric', 'gynecology', 'fertility'],
            'Oncology': ['cancer', 'tumor', 'oncology', 'malignant', 'chemotherapy', 'biopsy']
        }
    
    def quick_categorize(self, text: str) -> List[str]:
        """Quick keyword-based categorization"""
        text_lower = text.lower()
        detected_categories = []
        
        for category, keywords in self.category_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    if category not in detected_categories:
                        detected_categories.append(category)
                    break
        
        return detected_categories if detected_categories else ['General Prescription']
    
    def ai_categorize(self, text: str, image_context: str = None) -> Dict:
        """AI-powered categorization using Groq"""
        try:
            prompt = f"""Analyze this medical report and determine its category/categories.

Report text:
{text[:2000]}  # Limit text for API

Available categories:
1. General Prescription
2. X-ray Analysis
3. Kidney & Renal
4. Skin Analysis
5. Heart & Cardiac
6. Brain & Neurology
7. Blood & Lab Tests
8. Liver & GI
9. Hormones & Endocrine
10. Lung & Respiratory
11. Reproductive & OB-GYN
12. Oncology

Respond with JSON:
{{
    "primary_category": "category name",
    "secondary_categories": ["category2", "category3"],
    "confidence": 0.95,
    "reasoning": "brief explanation"
}}"""

            response = self.client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {"role": "system", "content": "You are a medical document classifier. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content
            
            # Parse JSON
            try:
                start = result_text.find('{')
                end = result_text.rfind('}') + 1
                if start != -1 and end > start:
                    result_text = result_text[start:end]
                result = json.loads(result_text)
                return result
            except:
                # Fallback to quick categorization
                quick_cats = self.quick_categorize(text)
                return {
                    'primary_category': quick_cats[0] if quick_cats else 'General Prescription',
                    'secondary_categories': quick_cats[1:] if len(quick_cats) > 1 else [],
                    'confidence': 0.7,
                    'reasoning': 'Keyword-based detection'
                }
                
        except Exception as e:
            # Fallback
            quick_cats = self.quick_categorize(text)
            return {
                'primary_category': quick_cats[0] if quick_cats else 'General Prescription',
                'secondary_categories': quick_cats[1:] if len(quick_cats) > 1 else [],
                'confidence': 0.6,
                'reasoning': f'AI categorization failed: {str(e)}'
            }
    
    def split_multi_category_report(self, text: str, categories: List[str]) -> Dict[str, str]:
        """Split report into sections by category"""
        sections = {}
        
        # Try to identify section headers
        lines = text.split('\n')
        current_category = categories[0] if categories else 'General'
        current_section = []
        
        for line in lines:
            line_lower = line.lower()
            
            # Check if line is a section header
            matched_category = None
            for category in categories:
                category_keywords = self.category_keywords.get(category, [])
                for keyword in category_keywords:
                    if keyword in line_lower and len(line.split()) < 10:
                        matched_category = category
                        break
                if matched_category:
                    break
            
            if matched_category:
                # Save previous section
                if current_section:
                    sections[current_category] = '\n'.join(current_section)
                current_category = matched_category
                current_section = [line]
            else:
                current_section.append(line)
        
        # Save last section
        if current_section:
            sections[current_category] = '\n'.join(current_section)
        
        # If no sections detected, return full text under primary category
        if not sections:
            sections[categories[0] if categories else 'General'] = text
        
        return sections
    
    def detect_report_type(self, text: str) -> str:
        """Detect specific report type (lab, imaging, prescription, etc.)"""
        text_lower = text.lower()
        
        # Lab report indicators
        if any(word in text_lower for word in ['test name', 'reference range', 'result', 'normal range']):
            return 'lab_report'
        
        # Imaging report indicators
        if any(word in text_lower for word in ['impression', 'findings', 'technique', 'comparison']):
            return 'imaging_report'
        
        # Prescription indicators
        if any(word in text_lower for word in ['sig:', 'disp:', 'refills', 'take', 'times daily']):
            return 'prescription'
        
        # Pathology report
        if any(word in text_lower for word in ['specimen', 'gross description', 'microscopic', 'diagnosis']):
            return 'pathology_report'
        
        return 'general_report'

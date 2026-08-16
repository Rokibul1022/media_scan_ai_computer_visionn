import easyocr
import pytesseract
from PIL import Image
import cv2
import numpy as np
from typing import List, Dict, Tuple
import re
from langdetect import detect

class AdvancedOCR:
    def __init__(self):
        # Initialize EasyOCR with multiple languages
        self.reader = easyocr.Reader([
            'en', 'bn', 'hi', 'ar', 'es', 'fr', 'de', 'pt', 'ru', 'zh_sim'
        ], gpu=False)
        
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """Enhance image quality for better OCR"""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray)
        
        # Increase contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(denoised)
        
        # Binarization
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        return binary
    
    def extract_text_multilang(self, image_bytes: bytes) -> Dict:
        """Extract text with multi-language support"""
        try:
            # Preprocess image
            processed_img = self.preprocess_image(image_bytes)
            
            # Use EasyOCR for multi-language support
            results = self.reader.readtext(processed_img)
            
            # Combine text
            full_text = ' '.join([text for (bbox, text, prob) in results if prob > 0.3])
            
            # Detect language
            try:
                detected_lang = detect(full_text) if full_text else 'en'
            except:
                detected_lang = 'en'
            
            # Extract structured data
            structured_data = {
                'full_text': full_text,
                'detected_language': detected_lang,
                'confidence': np.mean([prob for (_, _, prob) in results]) if results else 0,
                'blocks': [
                    {
                        'text': text,
                        'bbox': bbox,
                        'confidence': prob
                    } for (bbox, text, prob) in results
                ]
            }
            
            return structured_data
            
        except Exception as e:
            return {
                'full_text': f'OCR Error: {str(e)}',
                'detected_language': 'en',
                'confidence': 0,
                'blocks': []
            }
    
    def extract_prescription_data(self, text: str) -> Dict:
        """Extract medication names, dosages, and schedules"""
        medications = []
        
        # Common medication patterns
        med_patterns = [
            r'(?:Tab\.|Tablet|Cap\.|Capsule|Syrup|Injection)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|ml|g)',
            r'([A-Z][a-z]+(?:cin|zole|pril|olol|statin|mycin))\s+(\d+)\s*(mg|ml)',
            r'([A-Z][a-z]+)\s+(\d+(?:\.\d+)?)\s*(mg|ml|g)'
        ]
        
        for pattern in med_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                medications.append({
                    'name': match.group(1).strip(),
                    'dosage': match.group(2),
                    'unit': match.group(3)
                })
        
        # Extract frequency/schedule
        frequency_patterns = [
            r'(\d+)\s*(?:times?|x)\s*(?:per|a|/)\s*day',
            r'(?:once|twice|thrice)\s*(?:daily|a day)',
            r'every\s+(\d+)\s*hours?',
            r'(?:morning|afternoon|evening|night|bedtime)'
        ]
        
        schedules = []
        for pattern in frequency_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            schedules.extend([match.group(0) for match in matches])
        
        return {
            'medications': medications,
            'schedules': schedules,
            'raw_text': text
        }
    
    def extract_table_data(self, image_bytes: bytes) -> List[Dict]:
        """Extract structured data from lab result tables"""
        try:
            processed_img = self.preprocess_image(image_bytes)
            
            # Detect horizontal and vertical lines
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
            
            horizontal_lines = cv2.morphologyEx(processed_img, cv2.MORPH_OPEN, horizontal_kernel)
            vertical_lines = cv2.morphologyEx(processed_img, cv2.MORPH_OPEN, vertical_kernel)
            
            # Combine lines to detect table structure
            table_mask = cv2.add(horizontal_lines, vertical_lines)
            
            # Find contours (cells)
            contours, _ = cv2.findContours(table_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            
            # Extract text from each cell
            cells = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                if w > 50 and h > 20:  # Filter small contours
                    cell_img = processed_img[y:y+h, x:x+w]
                    cell_text = pytesseract.image_to_string(cell_img).strip()
                    if cell_text:
                        cells.append({
                            'text': cell_text,
                            'position': {'x': x, 'y': y, 'width': w, 'height': h}
                        })
            
            # Sort cells by position (top to bottom, left to right)
            cells.sort(key=lambda c: (c['position']['y'], c['position']['x']))
            
            # Group into rows
            rows = []
            current_row = []
            last_y = 0
            
            for cell in cells:
                if abs(cell['position']['y'] - last_y) > 20:
                    if current_row:
                        rows.append(current_row)
                    current_row = [cell['text']]
                    last_y = cell['position']['y']
                else:
                    current_row.append(cell['text'])
            
            if current_row:
                rows.append(current_row)
            
            # Parse as key-value pairs (test name, value, range)
            parsed_data = []
            for row in rows:
                if len(row) >= 2:
                    parsed_data.append({
                        'test_name': row[0],
                        'value': row[1] if len(row) > 1 else '',
                        'reference_range': row[2] if len(row) > 2 else '',
                        'unit': row[3] if len(row) > 3 else ''
                    })
            
            return parsed_data
            
        except Exception as e:
            return [{'error': f'Table extraction failed: {str(e)}'}]
    
    def detect_handwriting(self, image_bytes: bytes) -> bool:
        """Detect if image contains handwriting"""
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            
            # Calculate edge density (handwriting has more irregular edges)
            edges = cv2.Canny(img, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            # Handwriting typically has higher edge density
            return edge_density > 0.15
            
        except:
            return False
    
    def process_handwriting(self, image_bytes: bytes) -> str:
        """Process handwritten text with specialized techniques"""
        try:
            # Use EasyOCR which handles handwriting better
            processed_img = self.preprocess_image(image_bytes)
            results = self.reader.readtext(processed_img, paragraph=True)
            
            text = ' '.join([text for (bbox, text, prob) in results])
            
            if not text.strip():
                return "[Handwritten text detected but could not be read clearly. Please provide a clearer image.]"
            
            return text
            
        except Exception as e:
            return f"[Handwriting recognition error: {str(e)}]"

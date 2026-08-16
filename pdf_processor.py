import PyPDF2
from pdf2image import convert_from_bytes
from typing import List, Dict
import io
from PIL import Image

class PDFProcessor:
    def __init__(self):
        self.max_pages_per_report = 10
    
    def extract_text_from_pdf(self, pdf_bytes: bytes) -> Dict:
        """Extract text from PDF with page information"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            
            pages_data = []
            full_text = ''
            
            for page_num, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                pages_data.append({
                    'page_number': page_num + 1,
                    'text': page_text,
                    'char_count': len(page_text)
                })
                full_text += page_text + '\n\n'
            
            return {
                'full_text': full_text,
                'pages': pages_data,
                'total_pages': len(pdf_reader.pages),
                'success': True
            }
            
        except Exception as e:
            return {
                'full_text': '',
                'pages': [],
                'total_pages': 0,
                'success': False,
                'error': str(e)
            }
    
    def convert_pdf_to_images(self, pdf_bytes: bytes, dpi: int = 200) -> List[bytes]:
        """Convert PDF pages to images for OCR"""
        try:
            images = convert_from_bytes(pdf_bytes, dpi=dpi)
            
            image_bytes_list = []
            for img in images:
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                image_bytes_list.append(img_byte_arr.getvalue())
            
            return image_bytes_list
            
        except Exception as e:
            raise Exception(f'PDF to image conversion failed: {str(e)}')
    
    def split_pdf_by_pages(self, pdf_bytes: bytes, pages_per_split: int = 5) -> List[bytes]:
        """Split large PDF into smaller chunks"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            total_pages = len(pdf_reader.pages)
            
            split_pdfs = []
            
            for start_page in range(0, total_pages, pages_per_split):
                pdf_writer = PyPDF2.PdfWriter()
                
                end_page = min(start_page + pages_per_split, total_pages)
                
                for page_num in range(start_page, end_page):
                    pdf_writer.add_page(pdf_reader.pages[page_num])
                
                # Write to bytes
                output_bytes = io.BytesIO()
                pdf_writer.write(output_bytes)
                split_pdfs.append(output_bytes.getvalue())
            
            return split_pdfs
            
        except Exception as e:
            raise Exception(f'PDF splitting failed: {str(e)}')
    
    def detect_report_boundaries(self, pdf_text: str) -> List[Dict]:
        """Detect where individual reports start/end in multi-report PDF"""
        # Common report boundary indicators
        boundary_patterns = [
            r'Patient Name:',
            r'Patient ID:',
            r'Report Date:',
            r'Medical Record Number:',
            r'Date of Service:',
            r'LABORATORY REPORT',
            r'RADIOLOGY REPORT',
            r'PATHOLOGY REPORT',
            r'Page \d+ of \d+'
        ]
        
        lines = pdf_text.split('\n')
        boundaries = []
        
        for i, line in enumerate(lines):
            for pattern in boundary_patterns:
                import re
                if re.search(pattern, line, re.IGNORECASE):
                    boundaries.append({
                        'line_number': i,
                        'text': line.strip(),
                        'type': 'report_start'
                    })
                    break
        
        return boundaries
    
    def split_multi_report_pdf(self, pdf_bytes: bytes) -> List[Dict]:
        """Split PDF containing multiple reports into individual reports"""
        try:
            # Extract text with page info
            pdf_data = self.extract_text_from_pdf(pdf_bytes)
            
            if not pdf_data['success']:
                return [{'error': pdf_data.get('error', 'PDF extraction failed')}]
            
            # Detect boundaries
            boundaries = self.detect_report_boundaries(pdf_data['full_text'])
            
            if len(boundaries) <= 1:
                # Single report
                return [{
                    'report_number': 1,
                    'text': pdf_data['full_text'],
                    'pages': pdf_data['pages']
                }]
            
            # Split into multiple reports
            reports = []
            lines = pdf_data['full_text'].split('\n')
            
            for i, boundary in enumerate(boundaries):
                start_line = boundary['line_number']
                end_line = boundaries[i + 1]['line_number'] if i + 1 < len(boundaries) else len(lines)
                
                report_text = '\n'.join(lines[start_line:end_line])
                
                reports.append({
                    'report_number': i + 1,
                    'text': report_text,
                    'start_line': start_line,
                    'end_line': end_line
                })
            
            return reports
            
        except Exception as e:
            return [{'error': f'Multi-report splitting failed: {str(e)}'}]
    
    def batch_process_pdfs(self, pdf_files: List[bytes]) -> List[Dict]:
        """Process multiple PDF files in batch"""
        results = []
        
        for i, pdf_bytes in enumerate(pdf_files):
            try:
                # Extract text
                pdf_data = self.extract_text_from_pdf(pdf_bytes)
                
                # Check if multi-report
                reports = self.split_multi_report_pdf(pdf_bytes)
                
                results.append({
                    'file_number': i + 1,
                    'success': True,
                    'total_pages': pdf_data['total_pages'],
                    'reports_found': len(reports),
                    'reports': reports
                })
                
            except Exception as e:
                results.append({
                    'file_number': i + 1,
                    'success': False,
                    'error': str(e)
                })
        
        return results
    
    def merge_pdfs(self, pdf_bytes_list: List[bytes]) -> bytes:
        """Merge multiple PDFs into one"""
        try:
            pdf_writer = PyPDF2.PdfWriter()
            
            for pdf_bytes in pdf_bytes_list:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
                for page in pdf_reader.pages:
                    pdf_writer.add_page(page)
            
            output_bytes = io.BytesIO()
            pdf_writer.write(output_bytes)
            return output_bytes.getvalue()
            
        except Exception as e:
            raise Exception(f'PDF merging failed: {str(e)}')

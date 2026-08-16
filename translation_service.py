from googletrans import Translator
from gtts import gTTS
import os
from typing import Dict
from langdetect import detect
import tempfile

class TranslationService:
    def __init__(self):
        self.translator = Translator()
        
        # Language mappings
        self.language_map = {
            'en': 'English',
            'es': 'Spanish',
            'bn': 'Bengali',
            'hi': 'Hindi',
            'ar': 'Arabic',
            'zh-cn': 'Chinese',
            'fr': 'French',
            'de': 'German',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'it': 'Italian',
            'tr': 'Turkish',
            'vi': 'Vietnamese',
            'th': 'Thai',
            'id': 'Indonesian',
            'ms': 'Malay',
            'ur': 'Urdu',
            'fa': 'Persian'
        }
        
        # TTS supported languages
        self.tts_languages = {
            'en': 'en',
            'es': 'es',
            'bn': 'bn',
            'hi': 'hi',
            'ar': 'ar',
            'zh-cn': 'zh-CN',
            'fr': 'fr',
            'de': 'de',
            'pt': 'pt',
            'ru': 'ru',
            'ja': 'ja',
            'ko': 'ko',
            'it': 'it',
            'tr': 'tr',
            'vi': 'vi',
            'th': 'th',
            'id': 'id'
        }
    
    def detect_language(self, text: str) -> str:
        """Detect the language of input text"""
        try:
            return detect(text)
        except:
            return 'en'
    
    def translate_text(self, text: str, target_lang: str, source_lang: str = 'auto') -> Dict:
        """Translate text to target language"""
        try:
            if not text or not text.strip():
                return {
                    'translated_text': '',
                    'source_language': 'unknown',
                    'target_language': target_lang,
                    'success': False
                }
            
            # Translate
            result = self.translator.translate(text, dest=target_lang, src=source_lang)
            
            return {
                'translated_text': result.text,
                'source_language': result.src,
                'target_language': target_lang,
                'success': True,
                'original_text': text
            }
            
        except Exception as e:
            return {
                'translated_text': text,
                'source_language': source_lang,
                'target_language': target_lang,
                'success': False,
                'error': str(e)
            }
    
    def translate_medical_report(self, report_data: Dict, target_lang: str) -> Dict:
        """Translate entire medical report structure"""
        try:
            translated_report = {}
            
            # Translate summary
            if 'summary' in report_data:
                summary_translation = self.translate_text(report_data['summary'], target_lang)
                translated_report['summary'] = summary_translation['translated_text']
            
            # Translate critical values
            if 'critical_values' in report_data:
                translated_critical = []
                for cv in report_data['critical_values']:
                    translated_critical.append({
                        'title': self.translate_text(cv.get('title', ''), target_lang)['translated_text'],
                        'message': self.translate_text(cv.get('message', ''), target_lang)['translated_text'],
                        'severity': cv.get('severity', 'warning')
                    })
                translated_report['critical_values'] = translated_critical
            
            # Translate questions
            if 'questions' in report_data:
                translated_questions = []
                for q in report_data['questions']:
                    translated_q = self.translate_text(q, target_lang)['translated_text']
                    translated_questions.append(translated_q)
                translated_report['questions'] = translated_questions
            
            # Keep original data
            translated_report['original_language'] = self.detect_language(report_data.get('summary', ''))
            translated_report['target_language'] = target_lang
            translated_report['category'] = report_data.get('category', '')
            translated_report['extracted_text'] = report_data.get('extracted_text', '')
            
            return translated_report
            
        except Exception as e:
            return {
                'error': f'Translation failed: {str(e)}',
                'original_report': report_data
            }
    
    def text_to_speech(self, text: str, language: str = 'en', slow: bool = False) -> str:
        """Convert text to speech and return audio file path"""
        try:
            # Map language code
            tts_lang = self.tts_languages.get(language, 'en')
            
            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
            temp_path = temp_file.name
            temp_file.close()
            
            # Generate speech
            tts = gTTS(text=text, lang=tts_lang, slow=slow)
            tts.save(temp_path)
            
            return temp_path
            
        except Exception as e:
            raise Exception(f'TTS generation failed: {str(e)}')
    
    def generate_report_audio(self, report_data: Dict, language: str = 'en') -> str:
        """Generate audio narration for entire report"""
        try:
            # Compile report text
            audio_text = f"Medical Report Analysis. "
            
            if 'category' in report_data:
                audio_text += f"Category: {report_data['category']}. "
            
            if 'summary' in report_data:
                audio_text += f"Summary: {report_data['summary']}. "
            
            if 'critical_values' in report_data and report_data['critical_values']:
                audio_text += "Critical values detected. "
                for cv in report_data['critical_values']:
                    audio_text += f"{cv.get('title', '')}: {cv.get('message', '')}. "
            
            if 'questions' in report_data:
                audio_text += "Questions to ask your doctor: "
                for i, q in enumerate(report_data['questions'], 1):
                    audio_text += f"{i}. {q}. "
            
            # Generate audio
            return self.text_to_speech(audio_text, language, slow=False)
            
        except Exception as e:
            raise Exception(f'Audio generation failed: {str(e)}')
    
    def get_supported_languages(self) -> Dict:
        """Return list of supported languages"""
        return {
            'translation': self.language_map,
            'tts': {k: self.language_map[k] for k in self.tts_languages.keys() if k in self.language_map}
        }

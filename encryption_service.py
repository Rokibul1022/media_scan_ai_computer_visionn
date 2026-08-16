from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
import base64
import os
from typing import Tuple

class EncryptionService:
    def __init__(self, master_key: str = None):
        """Initialize encryption service with master key"""
        if master_key:
            self.master_key = master_key.encode()
        else:
            # Generate a new master key
            self.master_key = Fernet.generate_key()
    
    def generate_key_from_password(self, password: str, salt: bytes = None) -> Tuple[bytes, bytes]:
        """Generate encryption key from user password"""
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key, salt
    
    def encrypt_data(self, data: str, key: bytes = None) -> str:
        """Encrypt sensitive data"""
        try:
            if key is None:
                key = self.master_key
            
            f = Fernet(key)
            encrypted = f.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
            
        except Exception as e:
            raise Exception(f'Encryption failed: {str(e)}')
    
    def decrypt_data(self, encrypted_data: str, key: bytes = None) -> str:
        """Decrypt sensitive data"""
        try:
            if key is None:
                key = self.master_key
            
            f = Fernet(key)
            decoded = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = f.decrypt(decoded)
            return decrypted.decode()
            
        except Exception as e:
            raise Exception(f'Decryption failed: {str(e)}')
    
    def encrypt_report(self, report_data: dict, user_key: bytes = None) -> dict:
        """Encrypt sensitive fields in medical report"""
        try:
            encrypted_report = report_data.copy()
            
            # Fields to encrypt
            sensitive_fields = ['extracted_text', 'summary', 'patient_name', 'patient_id']
            
            for field in sensitive_fields:
                if field in encrypted_report and encrypted_report[field]:
                    encrypted_report[field] = self.encrypt_data(
                        str(encrypted_report[field]), 
                        user_key
                    )
            
            # Encrypt critical values
            if 'critical_values' in encrypted_report:
                for cv in encrypted_report['critical_values']:
                    if 'message' in cv:
                        cv['message'] = self.encrypt_data(cv['message'], user_key)
            
            # Encrypt questions
            if 'questions' in encrypted_report:
                encrypted_report['questions'] = [
                    self.encrypt_data(q, user_key) for q in encrypted_report['questions']
                ]
            
            encrypted_report['encrypted'] = True
            return encrypted_report
            
        except Exception as e:
            raise Exception(f'Report encryption failed: {str(e)}')
    
    def decrypt_report(self, encrypted_report: dict, user_key: bytes = None) -> dict:
        """Decrypt medical report"""
        try:
            if not encrypted_report.get('encrypted', False):
                return encrypted_report
            
            decrypted_report = encrypted_report.copy()
            
            # Decrypt sensitive fields
            sensitive_fields = ['extracted_text', 'summary', 'patient_name', 'patient_id']
            
            for field in sensitive_fields:
                if field in decrypted_report and decrypted_report[field]:
                    try:
                        decrypted_report[field] = self.decrypt_data(
                            decrypted_report[field], 
                            user_key
                        )
                    except:
                        pass  # Field might not be encrypted
            
            # Decrypt critical values
            if 'critical_values' in decrypted_report:
                for cv in decrypted_report['critical_values']:
                    if 'message' in cv:
                        try:
                            cv['message'] = self.decrypt_data(cv['message'], user_key)
                        except:
                            pass
            
            # Decrypt questions
            if 'questions' in decrypted_report:
                decrypted_questions = []
                for q in decrypted_report['questions']:
                    try:
                        decrypted_questions.append(self.decrypt_data(q, user_key))
                    except:
                        decrypted_questions.append(q)
                decrypted_report['questions'] = decrypted_questions
            
            decrypted_report['encrypted'] = False
            return decrypted_report
            
        except Exception as e:
            raise Exception(f'Report decryption failed: {str(e)}')
    
    def hash_data(self, data: str) -> str:
        """Create one-way hash for data verification"""
        digest = hashes.Hash(hashes.SHA256(), backend=default_backend())
        digest.update(data.encode())
        return base64.urlsafe_b64encode(digest.finalize()).decode()
    
    def generate_secure_token(self, length: int = 32) -> str:
        """Generate secure random token"""
        return base64.urlsafe_b64encode(os.urandom(length)).decode()

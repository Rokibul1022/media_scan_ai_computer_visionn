import stripe
from datetime import datetime, timedelta
from typing import Dict, Optional
from enum import Enum

class SubscriptionTier(Enum):
    FREE = "free"
    PRO = "pro"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

class SubscriptionService:
    def __init__(self, stripe_secret_key: str):
        stripe.api_key = stripe_secret_key
        
        # Subscription limits
        self.tier_limits = {
            SubscriptionTier.FREE: {
                'reports_per_month': 3,
                'storage_mb': 50,
                'features': ['basic_analysis', 'text_extraction'],
                'price': 0,
                'ai_models': ['basic']
            },
            SubscriptionTier.PRO: {
                'reports_per_month': 50,
                'storage_mb': 500,
                'features': [
                    'basic_analysis', 'text_extraction', 'ocr', 
                    'translation', 'tts', 'trend_analysis', 
                    'medication_tracker', 'family_profiles'
                ],
                'price': 9.99,
                'ai_models': ['basic', 'advanced']
            },
            SubscriptionTier.PREMIUM: {
                'reports_per_month': -1,  # Unlimited
                'storage_mb': 5000,
                'features': [
                    'basic_analysis', 'text_extraction', 'ocr',
                    'translation', 'tts', 'trend_analysis',
                    'medication_tracker', 'family_profiles',
                    'ai_coach', 'doctor_consultation', 'priority_support',
                    'multi_model_analysis', 'predictive_analytics',
                    'handwriting_recognition', 'batch_processing'
                ],
                'price': 19.99,
                'ai_models': ['basic', 'advanced', 'specialist']
            },
            SubscriptionTier.ENTERPRISE: {
                'reports_per_month': -1,
                'storage_mb': -1,  # Unlimited
                'features': ['all'],
                'price': 99.99,
                'ai_models': ['all'],
                'custom_branding': True,
                'api_access': True,
                'dedicated_support': True
            }
        }
    
    def create_customer(self, email: str, name: str, metadata: Dict = None) -> Dict:
        """Create Stripe customer"""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {}
            )
            
            return {
                'success': True,
                'customer_id': customer.id,
                'email': customer.email
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_subscription(self, customer_id: str, tier: SubscriptionTier, 
                          payment_method_id: str = None) -> Dict:
        """Create subscription for customer"""
        try:
            # Get price based on tier
            price = self.tier_limits[tier]['price']
            
            if price == 0:
                # Free tier - no Stripe subscription needed
                return {
                    'success': True,
                    'subscription_id': f'free_{customer_id}',
                    'tier': tier.value,
                    'status': 'active',
                    'current_period_end': (datetime.now() + timedelta(days=30)).isoformat()
                }
            
            # Create price object (in production, create these once and reuse)
            price_obj = stripe.Price.create(
                unit_amount=int(price * 100),  # Convert to cents
                currency='usd',
                recurring={'interval': 'month'},
                product_data={'name': f'MediScan AI {tier.value.upper()}'}
            )
            
            # Create subscription
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{'price': price_obj.id}],
                default_payment_method=payment_method_id,
                expand=['latest_invoice.payment_intent']
            )
            
            return {
                'success': True,
                'subscription_id': subscription.id,
                'tier': tier.value,
                'status': subscription.status,
                'current_period_end': datetime.fromtimestamp(
                    subscription.current_period_end
                ).isoformat(),
                'client_secret': subscription.latest_invoice.payment_intent.client_secret
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def cancel_subscription(self, subscription_id: str) -> Dict:
        """Cancel subscription"""
        try:
            if subscription_id.startswith('free_'):
                return {'success': True, 'message': 'Free tier - no cancellation needed'}
            
            subscription = stripe.Subscription.delete(subscription_id)
            
            return {
                'success': True,
                'subscription_id': subscription.id,
                'status': subscription.status
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def upgrade_subscription(self, subscription_id: str, new_tier: SubscriptionTier) -> Dict:
        """Upgrade/downgrade subscription"""
        try:
            if subscription_id.startswith('free_'):
                return {
                    'success': False,
                    'error': 'Cannot upgrade free tier directly. Create new subscription.'
                }
            
            subscription = stripe.Subscription.retrieve(subscription_id)
            
            # Get new price
            new_price = self.tier_limits[new_tier]['price']
            price_obj = stripe.Price.create(
                unit_amount=int(new_price * 100),
                currency='usd',
                recurring={'interval': 'month'},
                product_data={'name': f'MediScan AI {new_tier.value.upper()}'}
            )
            
            # Update subscription
            updated_subscription = stripe.Subscription.modify(
                subscription_id,
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'price': price_obj.id
                }],
                proration_behavior='create_prorations'
            )
            
            return {
                'success': True,
                'subscription_id': updated_subscription.id,
                'new_tier': new_tier.value,
                'status': updated_subscription.status
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def check_feature_access(self, tier: SubscriptionTier, feature: str) -> bool:
        """Check if tier has access to feature"""
        tier_features = self.tier_limits[tier]['features']
        
        if 'all' in tier_features:
            return True
        
        return feature in tier_features
    
    def check_usage_limit(self, tier: SubscriptionTier, current_usage: int) -> Dict:
        """Check if user has exceeded usage limits"""
        limit = self.tier_limits[tier]['reports_per_month']
        
        if limit == -1:  # Unlimited
            return {
                'within_limit': True,
                'current_usage': current_usage,
                'limit': 'unlimited'
            }
        
        return {
            'within_limit': current_usage < limit,
            'current_usage': current_usage,
            'limit': limit,
            'remaining': max(0, limit - current_usage)
        }
    
    def get_tier_info(self, tier: SubscriptionTier) -> Dict:
        """Get information about subscription tier"""
        return {
            'tier': tier.value,
            **self.tier_limits[tier]
        }
    
    def create_payment_intent(self, amount: float, currency: str = 'usd', 
                            customer_id: str = None) -> Dict:
        """Create payment intent for one-time payments"""
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency=currency,
                customer=customer_id,
                automatic_payment_methods={'enabled': True}
            )
            
            return {
                'success': True,
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def process_webhook(self, payload: bytes, signature: str, webhook_secret: str) -> Dict:
        """Process Stripe webhook events"""
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, webhook_secret
            )
            
            event_type = event['type']
            
            if event_type == 'customer.subscription.created':
                return {
                    'event': 'subscription_created',
                    'subscription_id': event['data']['object']['id'],
                    'customer_id': event['data']['object']['customer']
                }
            
            elif event_type == 'customer.subscription.updated':
                return {
                    'event': 'subscription_updated',
                    'subscription_id': event['data']['object']['id'],
                    'status': event['data']['object']['status']
                }
            
            elif event_type == 'customer.subscription.deleted':
                return {
                    'event': 'subscription_cancelled',
                    'subscription_id': event['data']['object']['id']
                }
            
            elif event_type == 'invoice.payment_succeeded':
                return {
                    'event': 'payment_succeeded',
                    'invoice_id': event['data']['object']['id'],
                    'amount': event['data']['object']['amount_paid'] / 100
                }
            
            elif event_type == 'invoice.payment_failed':
                return {
                    'event': 'payment_failed',
                    'invoice_id': event['data']['object']['id']
                }
            
            return {'event': event_type}
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

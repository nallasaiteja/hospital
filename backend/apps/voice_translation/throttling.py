"""
Custom rate throttles for Voice Translation API.
"""

from rest_framework.throttling import UserRateThrottle


class TranslationRateThrottle(UserRateThrottle):
    """
    Limits the number of translation requests per user to avoid abuse,
    excessive Gemini API costs, and provider rate limits.
    """
    scope = 'translation'

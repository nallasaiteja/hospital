"""
URL Routing for HMS Voice Language Translation.
"""

from django.urls import path
from .views import VoiceTranslationView, SupportedLanguagesView, TextToSpeechView

urlpatterns = [
    path('translate/', VoiceTranslationView.as_view(), name='translate'),
    path('languages/', SupportedLanguagesView.as_view(), name='languages'),
    path('tts/', TextToSpeechView.as_view(), name='tts'),
]

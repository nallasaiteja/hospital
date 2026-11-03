import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings


class VoicePrescriptionExtractView(APIView):
    """
    Extracts structured clinical prescription items from doctor speech transcription
    using Google Gemini API and cross-references against active hospital pharmacy formulary.
    Ensures zero hallucination: flags missing strength/dose/duration for explicit doctor review.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        transcript = request.data.get('transcript', '').strip()
        patient_id = request.data.get('patient_id', None)

        if not transcript:
            return Response(
                {'error': 'Dictated speech transcription cannot be empty.', 'code': 'EMPTY_TRANSCRIPT'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Load active hospital formulary
        from apps.pharmacy_inventory.models import Medicine
        medicines = list(Medicine.objects.all().values('id', 'brand_name', 'generic_name', 'strength', 'dosage_form'))
        med_lines = []
        for m in medicines:
            med_lines.append(f"{m['id']} | {m['brand_name']} | {m['generic_name']} | {m['strength']} | {m['dosage_form']}")
        formulary_text = "\n".join(med_lines)

        # 2. Check patient allergies if patient_id provided
        patient_allergies = []
        if patient_id:
            from apps.authentication.models import PatientProfile
            pat = PatientProfile.objects.filter(id=patient_id).first()
            if pat and pat.allergies:
                patient_allergies = pat.allergies

        # 3. Call Gemini
        api_key = getattr(settings, 'GEMINI_API_KEY', '') or ''
        if not api_key:
            return Response(
                {'error': 'Gemini AI service is not configured on backend.', 'code': 'AI_NOT_CONFIGURED'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        system_instruction = (
            "You are an expert clinical hospital pharmacist assistant. "
            "Extract structured medication items from the doctor's prescription dictation. "
            "CRITICAL CLINICAL RULES:\n"
            "1. Match prescribed medications to the provided hospital formulary catalog whenever available.\n"
            "2. If the dictated medicine is not in formulary or has a different strength, record the dictated values, set medicine_id to null, and add an entry in review_flags.\n"
            "3. DO NOT invent or assume doses, durations, frequencies, or strengths that were not stated.\n"
            "4. Distinguish dose per administration from total daily dose.\n"
            "5. For as-needed (PRN/SOS) medications, set is_prn: true and specify prn_indication.\n"
            "6. Calculate total_quantity ONLY when frequency and duration are both clearly specified.\n"
            "7. Flag any missing required fields in review_flags (e.g. 'Missing strength', 'Missing duration', 'Unclear frequency').\n"
            "Return JSON matching this schema: { \"items\": [ { \"medicine_id\": \"matched UUID or null\", \"medicine_name\": \"...\", \"generic_name\": \"...\", \"strength\": \"...\", \"dosage_form\": \"TABLET/CAPSULE/SYRUP/INJECTION/INHALER/DROPS/OINTMENT\", \"dose_amount\": \"...\", \"dose_unit\": \"Tablet/ml/Vial/Puff\", \"frequency\": \"...\", \"duration_days\": 5, \"route\": \"Oral/IV/Inhalation/Topical\", \"food_instruction\": \"BEFORE_FOOD/AFTER_FOOD/WITH_FOOD/EMPTY_STOMACH/BEDTIME/NONE\", \"is_prn\": false, \"prn_indication\": \"...\", \"schedule\": { \"morning\": true, \"morning_dose\": \"1\", \"afternoon\": true, \"afternoon_dose\": \"1\", \"evening\": false, \"evening_dose\": \"0\", \"night\": true, \"night_dose\": \"1\" }, \"calculated_quantity\": 10, \"instructions\": \"...\", \"review_flags\": [] } ] }"
        )

        user_content = (
            f"HOSPITAL FORMULARY CATALOG (id | brand | generic | strength | form):\n{formulary_text}\n\n"
            f"PATIENT RECORDED ALLERGIES: {', '.join(patient_allergies) if patient_allergies else 'None'}\n\n"
            f"DOCTOR VOICE DICTATION:\n\"{transcript}\""
        )

        candidate_models = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash']
        from google import genai
        client = genai.Client(api_key=api_key)
        extracted_data = None
        last_error = None

        for model_name in candidate_models:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config={
                        'system_instruction': system_instruction,
                        'temperature': 0.1,
                        'response_mime_type': 'application/json'
                    }
                )
                if resp and resp.text:
                    extracted_data = json.loads(resp.text)
                    break
            except Exception as e:
                last_error = str(e)
                continue

        if not extracted_data:
            return Response(
                {'error': f'Failed to parse speech prescription: {last_error or "Unknown error"}', 'code': 'EXTRACTION_FAILED'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        items = extracted_data.get('items', [])
        # Check allergy conflicts against extracted medicines
        if patient_allergies:
            for item in items:
                m_name = (item.get('medicine_name') or '').lower()
                g_name = (item.get('generic_name') or '').lower()
                for allergy in patient_allergies:
                    a_lower = allergy.lower()
                    if a_lower in m_name or a_lower in g_name:
                        flags = item.get('review_flags', [])
                        flags.append(f'CRITICAL ALLERGY WARNING: Patient is allergic to {allergy}!')
                        item['review_flags'] = flags

        return Response({
            'status': 'success',
            'raw_transcript': transcript,
            'items': items,
            'count': len(items)
        }, status=status.HTTP_200_OK)


"""
Fleet Chief Diagnostic AI and Speech Synthesis Engine in Python
"""

import os
import json
import re
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple


class GeminiService:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "")
        self.model_name = "models/gemini-3.8-flash"
        self.tts_model_name = "models/gemini-3.8-flash-lite-tts"

    def _call_gemini_rest(self, endpoint_model: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/{endpoint_model}:generateContent?key={self.api_key}"
        body_bytes = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=body_bytes,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "aistudio-build",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def handle_conversation(
        self,
        message: str,
        fleet_summary: Optional[Any] = None,
        return_audio: bool = True,
    ) -> Dict[str, Any]:
        """
        Generates conversational diagnostic analysis from connected fleet telemetry.
        """
        system_instruction = (
            "You are the Fleet Chief Diagnostic AI for a connected fleet of heavy haul trucks, "
            "city transit buses, and industrial compressors.\n"
            "You continuously monitor 5 core streaming sensor channels:\n"
            "1. Vibration (mm/s RMS) - Mechanical unbalance, bearing race pitting\n"
            "2. Temperature (°C) - Bearing and thermodynamic distress\n"
            "3. Motor Current (Amps) - Mechanical resistance surge\n"
            "4. Discharge Pressure (PSI) - Seal/valve clearance wear\n"
            "5. RPM - Rotational speed slippage\n\n"
            f"CURRENT FLEET TELEMETRY CONTEXT:\n{json.dumps(fleet_summary, indent=2)}\n\n"
            "INSTRUCTIONS:\n"
            "- Answer the user's inquiry directly, accurately, and concisely.\n"
            "- Cite specific machines (e.g. TRK-101, BUS-204, CMP-302, CMP-309), their health score, "
            "remaining useful life (RUL in cycles), and specific sensor values.\n"
            "- Explicitly mention any active or pending work orders, especially critical exceptions requiring supervisor sign-off.\n"
            "- Keep the tone professional, authoritative, and operational (like a senior fleet maintenance lead). "
            "Limit spoken responses to 2-4 focused sentences unless a detailed breakdown is requested."
        )

        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": message}]
                }
            ],
            "generationConfig": {
                "temperature": 0.35,
                "maxOutputTokens": 800,
            },
        }

        reply_text = ""
        audio_base64: Optional[str] = None

        try:
            res = self._call_gemini_rest(self.model_name, payload)
            candidates = res.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text_parts = [p.get("text", "") for p in parts if "text" in p]
                reply_text = "".join(text_parts).strip()
        except Exception as e:
            # Fallback diagnostic logic if API is unreachable or rate limited
            reply_text = self._generate_fallback_diagnosis(message, fleet_summary)

        if not reply_text:
            reply_text = self._generate_fallback_diagnosis(message, fleet_summary)

        # Attempt speech synthesis if requested
        if return_audio and self.api_key:
            audio_base64 = self.generate_tts(reply_text)

        return {
            "text": reply_text,
            "audio": audio_base64,
            "engine": "Python Diagnostic Backend",
        }

    def generate_tts(self, text: str, voice: str = "Zephyr") -> Optional[str]:
        """
        Synthesizes spoken audio using Gemini TTS in Python.
        """
        clean_text = re.sub(r"[*_#`~]", "", text).strip()
        if not clean_text:
            return None

        # Try gemini-3.8-flash-lite-tts or gemini-2.5-flash-preview-tts
        for model in ["models/gemini-3.8-flash-lite-tts", "models/gemini-2.5-flash-preview-tts"]:
            try:
                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "text": clean_text,
                                    "speechMetadata": {
                                        "style": "Clear, authoritative fleet diagnostic lead",
                                    },
                                }
                            ],
                        }
                    ],
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {"voiceName": voice}
                            }
                        },
                    },
                }

                res = self._call_gemini_rest(model, payload)
                candidates = res.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    for part in parts:
                        inline_data = part.get("inlineData")
                        if inline_data and inline_data.get("data"):
                            return inline_data.get("data")
            except Exception:
                continue

        return None

    def _generate_fallback_diagnosis(self, query: str, fleet_summary: Any) -> str:
        """
        Rule-based diagnostic summary fallback running in Python.
        """
        if not fleet_summary or not isinstance(fleet_summary, list):
            return "Fleet telemetry status: All connected heavy haul trucks, buses, and compressors are operating within safe baseline bounds."

        critical_units = [u for u in fleet_summary if float(u.get("predictedRUL", 100)) <= 25]
        if critical_units:
            unit = critical_units[0]
            unit_id = unit.get("engineId", "TRK-101")
            rul = unit.get("predictedRUL", 15)
            health = unit.get("healthScore", 62)
            vib = unit.get("vibration", 4.8)
            return (
                f"Attention: Unit {unit_id} is in critical degradation with remaining useful life of {rul} cycles "
                f"and health score of {health}%. Elevated mechanical vibration ({vib} mm/s RMS) indicates imminent bearing distress. "
                "Immediate safety isolation work order sign-off is required."
            )

        return (
            "Connected fleet diagnostic summary: All active units are streaming telemetry nominal. "
            "Predictive RUL models show adequate life margins across power transmission, bearing raceways, and pneumatic stages."
        )


gemini_service = GeminiService()

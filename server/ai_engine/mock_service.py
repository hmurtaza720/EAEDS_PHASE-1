import asyncio
import random

from .base import AIService

class MockAIService(AIService):
    """
    A Fake AI Brain for development on non-GPU laptops.
    Simulates the behavior of the real Mistral model + Whisper + TTS.
    """
    
    def __init__(self):
        print(" [MockAI] Initialized. Running in LAPTOP MODE (No GPU required).")
        self.system_prompt = "You are an empathetic 911 dispatcher."

    async def process_text(self, text: str):
        """
        Takes input text (simulating what Whisper would output)
        and returns a fake AI response based on keyword matching.
        """
        print(f" [MockAI] Thinking about: '{text}'...")
        await asyncio.sleep(1.0) # Added slight delay to simulate LLM inference time
        
        text_lower = text.lower()
        
        if "fire" in text_lower:
            return "I understand there is a fire. Are you in a safe place right now? Fire department is en route."
        elif "hurt" in text_lower or "blood" in text_lower or "medical" in text_lower:
            return "I am sending medical help immediately. Please apply pressure to the wound if possible. Stay on the line."
        elif "gun" in text_lower or "shooter" in text_lower or "police" in text_lower:
             return "Police units are being dispatched to your location. Hide and stay silent. Do not hang up."
        elif "crash" in text_lower or "accident" in text_lower:
             return "I have alerted highway patrol. Is anyone injured in the vehicle?"
        elif "hello" in text_lower or "hi" in text_lower:
            return "9-1-1, what is your emergency?"
            
        return "9-1-1, I'm here. I am having trouble understanding. Can you tell me your location?"

    async def detect_emotion(self, text: str):
        """
        Returns an emotion tag based on keywords.
        Used OpenSMILE logic in the real pipeline, but regex here for demo.
        """
        text_lower = text.lower()
        if "fire" in text_lower or "help" in text_lower or "blood" in text_lower or "gun" in text_lower:
            return "Panic"
        if "hurt" in text_lower or "crash" in text_lower:
            return "Fear"
        if "calm" in text_lower:
            return "Calm"
            
        emotions = ["Neutral", "Panic", "Fear", "Calm"]
        return random.choice(emotions)

    async def detect_location(self, text: str):
        """
        Extracts location coordinates.
        For Mock, we map specific keywords to distinct demo locations to show map capabilities.
        """
        text_lower = text.lower()
        
        # Hardcoded San Francisco locations for the demo
        if "fire" in text_lower:
             return [37.7908, -122.4008] # Financial District (High density)
        if "gun" in text_lower or "shooter" in text_lower:
             return [37.7694, -122.4862] # Golden Gate Park
        if "crash" in text_lower:
             return [37.8080, -122.4177] # Fisherman's Wharf (Traffic)
        if "medical" in text_lower or "hurt" in text_lower:
             return [37.7749, -122.4194] # Mission District
             
        return None

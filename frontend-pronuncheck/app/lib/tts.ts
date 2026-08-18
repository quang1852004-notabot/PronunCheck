/**
 * Utility functions for German Text-to-Speech (TTS)
 */

export function getGoogleTtsUrl(text: string): string {
  const cleanText = text.trim();
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=de&q=${encodeURIComponent(cleanText)}`;
}

export function playGermanSpeech(text: string, rate: number = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    const cleanText = text.trim();
    if (!cleanText) {
      resolve();
      return;
    }

    // Try Web Speech API first
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any previous speech
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'de-DE';
      utterance.rate = rate;

      // Look for a German voice if available
      const voices = window.speechSynthesis.getVoices();
      const germanVoice = voices.find(v => v.lang.startsWith('de') || v.lang.includes('DE'));
      if (germanVoice) {
        utterance.voice = germanVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => {
        // Fallback to Google TTS Audio Element
        playGoogleTtsAudio(cleanText, rate).then(resolve);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback
      playGoogleTtsAudio(cleanText, rate).then(resolve);
    }
  });
}

function playGoogleTtsAudio(text: string, rate: number = 1.0): Promise<void> {
  return new Promise((resolve) => {
    try {
      const url = getGoogleTtsUrl(text);
      const audio = new Audio(url);
      audio.playbackRate = rate;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    } catch {
      resolve();
    }
  });
}

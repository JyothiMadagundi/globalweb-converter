package com.translator.service;

import java.util.List;

public interface TranslationService {
    
    /**
     * Translate a single text from source language to target language
     * @param text The text to translate
     * @param sourceLanguage Source language code (e.g., "ar", "es", "fr") or "auto" for auto-detection
     * @param targetLanguage Target language code (e.g., "en")
     * @return Translated text
     */
    String translateText(String text, String sourceLanguage, String targetLanguage);
    
    /**
     * Translate multiple texts in batch
     * @param texts List of texts to translate
     * @param sourceLanguage Source language code or "auto"
     * @param targetLanguage Target language code
     * @return List of translated texts
     */
    List<String> translateTexts(List<String> texts, String sourceLanguage, String targetLanguage);
    
    /**
     * Detect the language of a given text
     * @param text The text to analyze
     * @return Language code
     */
    String detectLanguage(String text);
    
    /**
     * Check if the translation service is available
     * @return true if service is available
     */
    boolean isServiceAvailable();
}
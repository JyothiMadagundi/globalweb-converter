package com.translator.service;

import com.translator.model.TranslationResult;

public interface HtmlTranslationService {
    
    /**
     * Translate HTML content from source language to target language
     * @param htmlContent The HTML content to translate
     * @param sourceLanguage Source language code or "auto"
     * @param targetLanguage Target language code
     * @return TranslationResult containing translated HTML and metadata
     */
    TranslationResult translateHtml(String htmlContent, String sourceLanguage, String targetLanguage);
    
    /**
     * Extract text content from HTML for preview
     * @param htmlContent The HTML content
     * @return Extracted text content
     */
    String extractTextContent(String htmlContent);
    
    /**
     * Validate HTML content
     * @param htmlContent The HTML content to validate
     * @return true if valid HTML
     */
    boolean isValidHtml(String htmlContent);
}
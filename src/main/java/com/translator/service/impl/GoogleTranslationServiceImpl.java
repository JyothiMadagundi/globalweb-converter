package com.translator.service.impl;

import com.google.cloud.translate.Translate;
import com.google.cloud.translate.TranslateOptions;
import com.google.cloud.translate.Translation;
import com.google.cloud.translate.Detection;
import com.translator.config.TranslationConfig;
import com.translator.service.TranslationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

// DISABLED - Replaced by GoogleTranslateRestServiceImpl  
// @Service
// @ConditionalOnProperty(name = "translation.provider", havingValue = "google", matchIfMissing = false)
public class GoogleTranslationServiceImpl implements TranslationService {

    private static final Logger log = LoggerFactory.getLogger(GoogleTranslationServiceImpl.class);
    
    private final TranslationConfig config;
    private Translate translate;

    @Autowired
    public GoogleTranslationServiceImpl(TranslationConfig config) {
        this.config = config;
        initializeTranslateService();
    }

    private void initializeTranslateService() {
        try {
            if (config.getGoogleCredentialsPath() != null && !config.getGoogleCredentialsPath().isEmpty()) {
                // Use service account credentials
                translate = TranslateOptions.newBuilder()
                        .setCredentials(com.google.auth.oauth2.ServiceAccountCredentials
                                .fromStream(new java.io.FileInputStream(config.getGoogleCredentialsPath())))
                        .build()
                        .getService();
            } else {
                // Use default credentials or API key
                translate = TranslateOptions.getDefaultInstance().getService();
            }
            log.info("Google Translate service initialized successfully");
        } catch (Exception e) {
            log.error("Failed to initialize Google Translate service: {}", e.getMessage());
            translate = null;
        }
    }

    @Override
    public String translateText(String text, String sourceLanguage, String targetLanguage) {
        if (!isServiceAvailable()) {
            log.warn("Google Translate service not available, returning original text");
            return text;
        }

        if (text == null || text.trim().isEmpty()) {
            return text;
        }

        try {
            Translate.TranslateOption sourceOption = sourceLanguage.equals("auto") 
                    ? null 
                    : Translate.TranslateOption.sourceLanguage(sourceLanguage);
            
            Translation translation = sourceOption != null 
                    ? translate.translate(text, sourceOption, Translate.TranslateOption.targetLanguage(targetLanguage))
                    : translate.translate(text, Translate.TranslateOption.targetLanguage(targetLanguage));
            
            return translation.getTranslatedText();
        } catch (Exception e) {
            log.error("Translation failed for text: {} - Error: {}", text.substring(0, Math.min(50, text.length())), e.getMessage());
            return text; // Return original text if translation fails
        }
    }

    @Override
    public List<String> translateTexts(List<String> texts, String sourceLanguage, String targetLanguage) {
        return texts.stream()
                .map(text -> translateText(text, sourceLanguage, targetLanguage))
                .collect(Collectors.toList());
    }

    @Override
    public String detectLanguage(String text) {
        if (!isServiceAvailable() || text == null || text.trim().isEmpty()) {
            return "unknown";
        }

        try {
            Detection detection = translate.detect(text);
            return detection.getLanguage();
        } catch (Exception e) {
            log.error("Language detection failed: {}", e.getMessage());
            return "unknown";
        }
    }

    @Override
    public boolean isServiceAvailable() {
        return translate != null;
    }
}
package com.translator.service.impl;

import com.translator.config.TranslationConfig;
import com.translator.service.TranslationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "translation.provider", havingValue = "google", matchIfMissing = false)
public class GoogleTranslateRestServiceImpl implements TranslationService {

    private static final Logger log = LoggerFactory.getLogger(GoogleTranslateRestServiceImpl.class);
    
    private static final String GOOGLE_TRANSLATE_API_URL = "https://translation.googleapis.com/language/translate/v2";
    private static final String GOOGLE_DETECTION_API_URL = "https://translation.googleapis.com/language/translate/v2/detect";
    
    private final TranslationConfig config;
    private final RestTemplate restTemplate;
    private boolean serviceAvailable = false;

    @Autowired
    public GoogleTranslateRestServiceImpl(TranslationConfig config) {
        this.config = config;
        this.restTemplate = new RestTemplate();
        initializeService();
    }

    private void initializeService() {
        if (config.getGoogleApiKey() != null && !config.getGoogleApiKey().trim().isEmpty()) {
            serviceAvailable = true;
            log.info("Google Translate REST API service initialized with API key");
        } else {
            log.warn("Google Translate API key not provided. Set GOOGLE_TRANSLATE_API_KEY environment variable to use Google Translate");
            log.info("Example: export GOOGLE_TRANSLATE_API_KEY=your-api-key-here");
            serviceAvailable = false;
        }
    }

    @Override
    public String translateText(String text, String sourceLanguage, String targetLanguage) {
        if (!isServiceAvailable()) {
            log.debug("Google Translate service not available, returning original text");
            return text;
        }

        if (text == null || text.trim().isEmpty()) {
            return text;
        }

        try {
            String url = GOOGLE_TRANSLATE_API_URL + "?key=" + config.getGoogleApiKey();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            StringBuilder body = new StringBuilder();
            body.append("q=").append(URLEncoder.encode(text, StandardCharsets.UTF_8));
            body.append("&target=").append(targetLanguage);
            
            if (!sourceLanguage.equals("auto")) {
                body.append("&source=").append(sourceLanguage);
            }
            
            HttpEntity<String> request = new HttpEntity<>(body.toString(), headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            
            if (response.getStatusCode() == HttpStatus.OK) {
                String responseBody = response.getBody();
                // Parse the JSON response to extract the translated text
                return parseTranslationResponse(responseBody);
            } else {
                log.error("Google Translate API returned status: {}", response.getStatusCode());
                return text;
            }
            
        } catch (Exception e) {
            log.error("Translation failed for text: {} - Error: {}", 
                    text.length() > 50 ? text.substring(0, 50) + "..." : text, 
                    e.getMessage());
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
            String url = GOOGLE_DETECTION_API_URL + "?key=" + config.getGoogleApiKey();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            String body = "q=" + URLEncoder.encode(text, StandardCharsets.UTF_8);
            
            HttpEntity<String> request = new HttpEntity<>(body, headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            
            if (response.getStatusCode() == HttpStatus.OK) {
                String responseBody = response.getBody();
                // Parse the JSON response to extract the detected language
                return parseDetectionResponse(responseBody);
            } else {
                log.error("Google Translate Detection API returned status: {}", response.getStatusCode());
                return "unknown";
            }
            
        } catch (Exception e) {
            log.error("Language detection failed: {}", e.getMessage());
            return "unknown";
        }
    }

    @Override
    public boolean isServiceAvailable() {
        return serviceAvailable;
    }

    private String parseTranslationResponse(String jsonResponse) {
        try {
            // Simple JSON parsing - look for "translatedText" field
            int start = jsonResponse.indexOf("\"translatedText\":");
            if (start == -1) return jsonResponse;
            
            start = jsonResponse.indexOf("\"", start + 17);
            if (start == -1) return jsonResponse;
            
            int end = jsonResponse.indexOf("\"", start + 1);
            if (end == -1) return jsonResponse;
            
            return jsonResponse.substring(start + 1, end)
                    .replace("\\\"", "\"")
                    .replace("\\n", "\n")
                    .replace("\\t", "\t");
                    
        } catch (Exception e) {
            log.error("Failed to parse translation response: {}", e.getMessage());
            return jsonResponse;
        }
    }

    private String parseDetectionResponse(String jsonResponse) {
        try {
            // Simple JSON parsing - look for "language" field
            int start = jsonResponse.indexOf("\"language\":");
            if (start == -1) return "unknown";
            
            start = jsonResponse.indexOf("\"", start + 11);
            if (start == -1) return "unknown";
            
            int end = jsonResponse.indexOf("\"", start + 1);
            if (end == -1) return "unknown";
            
            return jsonResponse.substring(start + 1, end);
            
        } catch (Exception e) {
            log.error("Failed to parse detection response: {}", e.getMessage());
            return "unknown";
        }
    }
}
package com.translator.service.impl;

import com.translator.service.HtmlTranslationService;
import com.translator.model.TranslationResult;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

// DISABLED - Replaced by HtmlTranslationServiceImpl for actual content translation
// @Service  
public class SimpleGoogleTranslateInjectorImpl implements HtmlTranslationService {

    private static final Logger log = LoggerFactory.getLogger(SimpleGoogleTranslateInjectorImpl.class);
    
    // Language detection patterns based on Unicode ranges
    private static final Map<String, Pattern> LANGUAGE_PATTERNS = new HashMap<>();
    
    static {
        // Initialize language detection patterns
        LANGUAGE_PATTERNS.put("zh", Pattern.compile("[\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF]")); // Chinese
        LANGUAGE_PATTERNS.put("ja", Pattern.compile("[\\u3040-\\u309F\\u30A0-\\u30FF]")); // Japanese (hiragana/katakana)
        LANGUAGE_PATTERNS.put("ko", Pattern.compile("[\\uAC00-\\uD7AF\\u1100-\\u11FF\\u3130-\\u318F]")); // Korean
        LANGUAGE_PATTERNS.put("ar", Pattern.compile("[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]")); // Arabic
        LANGUAGE_PATTERNS.put("th", Pattern.compile("[\\u0E00-\\u0E7F]")); // Thai
        LANGUAGE_PATTERNS.put("hi", Pattern.compile("[\\u0900-\\u097F]")); // Hindi/Devanagari
        LANGUAGE_PATTERNS.put("he", Pattern.compile("[\\u0590-\\u05FF]")); // Hebrew
        LANGUAGE_PATTERNS.put("ru", Pattern.compile("[\\u0400-\\u04FF]")); // Cyrillic/Russian
        LANGUAGE_PATTERNS.put("el", Pattern.compile("[\\u0370-\\u03FF]")); // Greek
        LANGUAGE_PATTERNS.put("tr", Pattern.compile("[çÇğĞıİöÖşŞüÜ]")); // Turkish specific chars
        LANGUAGE_PATTERNS.put("vi", Pattern.compile("[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồố]")); // Vietnamese
        LANGUAGE_PATTERNS.put("fr", Pattern.compile("[àâäéèêëïîôùûüÿç]")); // French accents
        LANGUAGE_PATTERNS.put("de", Pattern.compile("[äöüÄÖÜß]")); // German specific chars
        LANGUAGE_PATTERNS.put("es", Pattern.compile("[ñáéíóúü¿¡]")); // Spanish specific chars
        LANGUAGE_PATTERNS.put("pt", Pattern.compile("[ãõáéíóúâêîôûàèç]")); // Portuguese accents
        LANGUAGE_PATTERNS.put("it", Pattern.compile("[àèéìíîòóù]")); // Italian accents
    }

    @Override
    public String extractTextContent(String htmlContent) {
        try {
            Document doc = Jsoup.parse(htmlContent);
            return doc.text();
        } catch (Exception e) {
            log.error("Failed to extract text content: {}", e.getMessage());
            return "";
        }
    }

    @Override
    public boolean isValidHtml(String htmlContent) {
        if (htmlContent == null || htmlContent.trim().isEmpty()) {
            return false;
        }
        try {
            Jsoup.parse(htmlContent);
            return true;
        } catch (Exception e) {
            log.error("Invalid HTML content: {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * Detect the language of the HTML content based on text analysis
     */
    private String detectLanguageFromContent(String htmlContent) {
        try {
            // Extract text content from HTML
            Document doc = Jsoup.parse(htmlContent);
            String textContent = doc.text();
            
            if (textContent == null || textContent.trim().isEmpty()) {
                log.debug("No text content found, defaulting to auto detection");
                return "auto";
            }
            
            // Check for language patterns in the text
            Map<String, Integer> languageScores = new HashMap<>();
            
            for (Map.Entry<String, Pattern> entry : LANGUAGE_PATTERNS.entrySet()) {
                String lang = entry.getKey();
                Pattern pattern = entry.getValue();
                
                // Count characters that match this language pattern
                long matches = textContent.chars()
                        .mapToObj(c -> String.valueOf((char) c))
                        .filter(s -> pattern.matcher(s).find())
                        .count();
                
                if (matches > 0) {
                    languageScores.put(lang, (int) matches);
                }
            }
            
            // Special handling for Chinese vs Japanese
            if (languageScores.containsKey("zh") && languageScores.containsKey("ja")) {
                if (containsChineseSpecificPatterns(textContent)) {
                    languageScores.put("zh", languageScores.get("zh") + 100); // Boost Chinese
                } else if (containsJapaneseSpecificPatterns(textContent)) {
                    languageScores.put("ja", languageScores.get("ja") + 100); // Boost Japanese
                }
            }
            
            // Return the language with the highest score
            if (!languageScores.isEmpty()) {
                String detectedLang = languageScores.entrySet().stream()
                        .max(Map.Entry.comparingByValue())
                        .get()
                        .getKey();
                
                log.info("Detected language: {} (scores: {})", detectedLang, languageScores);
                return detectedLang;
            }
            
            // If no specific patterns found, check for common English patterns
            if (textContent.matches(".*\\b(the|and|or|but|in|on|at|to|for|of|with|by)\\b.*")) {
                log.info("Detected language: en (common English words found)");
                return "en";
            }
            
            log.debug("No specific language detected, using auto");
            return "auto";
            
        } catch (Exception e) {
            log.error("Language detection failed: {}", e.getMessage());
            return "auto";
        }
    }
    
    private boolean containsChineseSpecificPatterns(String text) {
        // Traditional and Simplified Chinese specific patterns
        String[] chinesePatterns = {
            "网络", "網路", "银行", "銀行", "时间", "時間", "输入", "輸入", 
            "请", "請", "统编", "統編", "账户", "賬戶", "台北", "臺北"
        };
        
        for (String pattern : chinesePatterns) {
            if (text.contains(pattern)) {
                return true;
            }
        }
        return false;
    }
    
    private boolean containsJapaneseSpecificPatterns(String text) {
        // Japanese specific patterns (hiragana, katakana, specific usage)
        return text.matches(".*[\\u3040-\\u309F\\u30A0-\\u30FF].*") || 
               text.contains("ログイン") || text.contains("パスワード") || 
               text.contains("ユーザー") || text.contains("する") || text.contains("です") ||
               text.contains("した") || text.contains("します");
    }

    @Override
    public TranslationResult translateHtml(String htmlContent, String sourceLanguage, String targetLanguage) {
        log.info("Injecting Google Translate widget into HTML content");
        
        long startTime = System.currentTimeMillis();
        
        try {
            // Parse the HTML content
            Document doc = Jsoup.parse(htmlContent);
            
            // Find the body tag
            Element body = doc.body();
            if (body == null) {
                // If no body tag exists, create one
                body = doc.appendElement("body");
            }
            
            // Detect the actual language from content if sourceLanguage is "auto"
            String detectedLanguage;
            if (sourceLanguage.equals("auto")) {
                detectedLanguage = detectLanguageFromContent(htmlContent);
                log.info("Auto-detected language: {}", detectedLanguage);
            } else {
                detectedLanguage = sourceLanguage;
                log.info("Using provided source language: {}", detectedLanguage);
            }
            
            // Create the Google Translate widget HTML with detected language
            String googleTranslateWidget = 
                "<div id=\"google_translate_element\" style=\"margin: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px; text-align: center;\"></div>\n" +
                "<script type=\"text/javascript\">\n" +
                "  function googleTranslateElementInit() {\n" +
                "    new google.translate.TranslateElement(\n" +
                "      {pageLanguage: '" + detectedLanguage + "'},\n" +
                "      'google_translate_element'\n" +
                "    );\n" +
                "  }\n" +
                "</script>\n" +
                "<script type=\"text/javascript\"\n" +
                "  src=\"https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit\">\n" +
                "</script>";
            
            // Add the Google Translate widget at the beginning of the body
            body.prepend(googleTranslateWidget);
            
            // Get the modified HTML
            String translatedHtml = doc.outerHtml();
            
            long processingTime = System.currentTimeMillis() - startTime;
            
            log.info("Google Translate widget injected successfully in {}ms", processingTime);
            
            // Build and return the result
            return TranslationResult.builder()
                    .originalHtml(htmlContent)
                    .translatedHtml(translatedHtml)
                    .sourceLanguage(sourceLanguage)
                    .targetLanguage(targetLanguage)
                    .detectedLanguage(detectedLanguage)
                    .totalTextElements(1)
                    .translatedElements(1)
                    .translationTime(LocalDateTime.now())
                    .processingTimeMs(processingTime)
                    .build();
                    
        } catch (Exception e) {
            log.error("Failed to inject Google Translate widget: {}", e.getMessage());
            
            // Return error result
            return TranslationResult.builder()
                    .originalHtml(htmlContent)
                    .translatedHtml(htmlContent) // Return original on error
                    .sourceLanguage(sourceLanguage)
                    .targetLanguage(targetLanguage)
                    .detectedLanguage("unknown")
                    .totalTextElements(0)
                    .translatedElements(0)
                    .translationTime(LocalDateTime.now())
                    .processingTimeMs(0)
                    .build();
        }
    }
}
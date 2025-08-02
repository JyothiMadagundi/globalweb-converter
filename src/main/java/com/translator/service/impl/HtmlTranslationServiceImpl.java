package com.translator.service.impl;

import com.translator.config.TranslationConfig;
import com.translator.model.TranslationResult;
import com.translator.service.HtmlTranslationService;
import com.translator.service.TranslationService;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// DISABLED - Replaced by SimpleGoogleTranslateInjectorImpl
// @Service
public class HtmlTranslationServiceImpl implements HtmlTranslationService {

    private static final Logger log = LoggerFactory.getLogger(HtmlTranslationServiceImpl.class);
    
    private final TranslationService translationService;
    private final TranslationConfig config;
    
    public HtmlTranslationServiceImpl(TranslationService translationService, TranslationConfig config) {
        this.translationService = translationService;
        this.config = config;
    }

    // HTML elements that should not be translated
    private static final Set<String> SKIP_ELEMENTS = Set.of(
            "script", "style", "code", "pre", "noscript", "svg", "math"
    );

    // Attributes that may contain translatable text
    private static final Set<String> TRANSLATABLE_ATTRIBUTES = Set.of(
            "title", "alt", "placeholder", "aria-label", "aria-describedby"
    );

    @Override
    public TranslationResult translateHtml(String htmlContent, String sourceLanguage, String targetLanguage) {
        long startTime = System.currentTimeMillis();
        List<String> errors = new ArrayList<>();
        
        TranslationResult.TranslationResultBuilder resultBuilder = TranslationResult.builder()
                .originalHtml(htmlContent)
                .sourceLanguage(sourceLanguage)
                .targetLanguage(targetLanguage)
                .translationTime(LocalDateTime.now())
                .errors(errors);

        try {
            if (!isValidHtml(htmlContent)) {
                errors.add("Invalid HTML content provided");
                return resultBuilder.build();
            }

            Document doc = Jsoup.parse(htmlContent);
            String detectedLanguage = sourceLanguage.equals("auto") ? 
                    detectLanguageFromDocument(doc) : sourceLanguage;
            
            resultBuilder.detectedLanguage(detectedLanguage);

            int[] counters = {0, 0}; // [totalElements, translatedElements]
            
            // Translate text nodes
            translateTextNodes(doc, detectedLanguage, targetLanguage, counters, errors);
            
            // Translate attributes
            translateAttributes(doc, detectedLanguage, targetLanguage, counters, errors);

            resultBuilder
                    .translatedHtml(doc.outerHtml())
                    .totalTextElements(counters[0])
                    .translatedElements(counters[1])
                    .processingTimeMs(System.currentTimeMillis() - startTime);

            log.info("HTML translation completed. Elements: {}/{}, Time: {}ms", 
                    counters[1], counters[0], System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.error("Error during HTML translation", e);
            errors.add("Translation failed: " + e.getMessage());
            resultBuilder.translatedHtml(htmlContent); // Return original on error
        }

        return resultBuilder.build();
    }

    private void translateTextNodes(Document doc, String sourceLanguage, String targetLanguage, 
                                   int[] counters, List<String> errors) {
        List<TextNode> textNodes = new ArrayList<>();
        collectTextNodes(doc.body() != null ? doc.body() : doc, textNodes);

        for (TextNode textNode : textNodes) {
            String originalText = textNode.text().trim();
            if (originalText.isEmpty() || isNonTranslatableText(originalText)) {
                continue;
            }

            counters[0]++; // Increment total elements

            try {
                String translatedText = translationService.translateText(
                        originalText, sourceLanguage, targetLanguage);
                
                if (!translatedText.equals(originalText)) {
                    textNode.text(translatedText);
                    counters[1]++; // Increment translated elements
                }
            } catch (Exception e) {
                log.warn("Failed to translate text: {} - Error: {}", 
                        originalText.substring(0, Math.min(50, originalText.length())), e.getMessage());
                errors.add("Failed to translate: " + originalText.substring(0, Math.min(50, originalText.length())));
            }
        }
    }

    private void translateAttributes(Document doc, String sourceLanguage, String targetLanguage,
                                   int[] counters, List<String> errors) {
        for (Element element : doc.getAllElements()) {
            for (String attrName : TRANSLATABLE_ATTRIBUTES) {
                if (element.hasAttr(attrName)) {
                    String originalValue = element.attr(attrName).trim();
                    if (!originalValue.isEmpty() && !isNonTranslatableText(originalValue)) {
                        counters[0]++;
                        
                        try {
                            String translatedValue = translationService.translateText(
                                    originalValue, sourceLanguage, targetLanguage);
                            
                            if (!translatedValue.equals(originalValue)) {
                                element.attr(attrName, translatedValue);
                                counters[1]++;
                            }
                        } catch (Exception e) {
                            log.warn("Failed to translate attribute {}: {} - Error: {}", 
                                    attrName, originalValue.substring(0, Math.min(30, originalValue.length())), e.getMessage());
                            errors.add("Failed to translate attribute " + attrName + ": " + 
                                    originalValue.substring(0, Math.min(30, originalValue.length())));
                        }
                    }
                }
            }
        }
    }

    private void collectTextNodes(Element element, List<TextNode> textNodes) {
        if (SKIP_ELEMENTS.contains(element.tagName().toLowerCase())) {
            return;
        }

        for (Node child : element.childNodes()) {
            if (child instanceof TextNode) {
                TextNode textNode = (TextNode) child;
                if (!textNode.text().trim().isEmpty()) {
                    textNodes.add(textNode);
                }
            } else if (child instanceof Element) {
                collectTextNodes((Element) child, textNodes);
            }
        }
    }

    private String detectLanguageFromDocument(Document doc) {
        // Try to get language from HTML lang attribute
        String htmlLang = doc.select("html").attr("lang");
        if (!htmlLang.isEmpty()) {
            return htmlLang.split("-")[0]; // Get main language code
        }

        // Extract some text for language detection
        String sampleText = extractTextContent(doc.outerHtml());
        if (sampleText.length() > 100) {
            sampleText = sampleText.substring(0, 100);
        }

        return translationService.detectLanguage(sampleText);
    }

    private boolean isNonTranslatableText(String text) {
        // Skip text that looks like:
        // - URLs
        // - Email addresses  
        // - Numbers only
        // - Very short text (< 3 characters)
        // - CSS/JavaScript code patterns
        
        if (text.length() < 3) return true;
        
        String lowerText = text.toLowerCase().trim();
        
        return lowerText.matches("^[0-9\\s\\-+().,]+$") || // Numbers and punctuation only
               lowerText.matches("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$") || // Email
               lowerText.startsWith("http") || // URL
               lowerText.startsWith("www.") || // URL
               lowerText.contains("function(") || // JavaScript
               lowerText.contains("var ") || // JavaScript
               lowerText.contains("{") && lowerText.contains("}"); // CSS/JS
    }

    @Override
    public String extractTextContent(String htmlContent) {
        try {
            Document doc = Jsoup.parse(htmlContent);
            return doc.text();
        } catch (Exception e) {
            log.error("Error extracting text content", e);
            return "";
        }
    }

    @Override
    public boolean isValidHtml(String htmlContent) {
        if (htmlContent == null || htmlContent.trim().isEmpty()) {
            return false;
        }

        try {
            Document doc = Jsoup.parse(htmlContent);
            return doc != null;
        } catch (Exception e) {
            log.warn("Invalid HTML content: {}", e.getMessage());
            return false;
        }
    }
}
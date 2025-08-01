package com.translator.model;

import java.time.LocalDateTime;
import java.util.List;

public class TranslationResult {
    
    private String originalHtml;
    private String translatedHtml;
    private String sourceLanguage;
    private String targetLanguage;
    private String detectedLanguage;
    private int totalTextElements;
    private int translatedElements;
    private List<String> errors;
    private LocalDateTime translationTime;
    private long processingTimeMs;
    
    public TranslationResult() {}
    
    public TranslationResult(String originalHtml, String translatedHtml, String sourceLanguage, 
                           String targetLanguage, String detectedLanguage, int totalTextElements, 
                           int translatedElements, List<String> errors, LocalDateTime translationTime, 
                           long processingTimeMs) {
        this.originalHtml = originalHtml;
        this.translatedHtml = translatedHtml;
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.detectedLanguage = detectedLanguage;
        this.totalTextElements = totalTextElements;
        this.translatedElements = translatedElements;
        this.errors = errors;
        this.translationTime = translationTime;
        this.processingTimeMs = processingTimeMs;
    }
    
    public static TranslationResultBuilder builder() {
        return new TranslationResultBuilder();
    }
    
    // Getters and Setters
    public String getOriginalHtml() { return originalHtml; }
    public void setOriginalHtml(String originalHtml) { this.originalHtml = originalHtml; }
    
    public String getTranslatedHtml() { return translatedHtml; }
    public void setTranslatedHtml(String translatedHtml) { this.translatedHtml = translatedHtml; }
    
    public String getSourceLanguage() { return sourceLanguage; }
    public void setSourceLanguage(String sourceLanguage) { this.sourceLanguage = sourceLanguage; }
    
    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }
    
    public String getDetectedLanguage() { return detectedLanguage; }
    public void setDetectedLanguage(String detectedLanguage) { this.detectedLanguage = detectedLanguage; }
    
    public int getTotalTextElements() { return totalTextElements; }
    public void setTotalTextElements(int totalTextElements) { this.totalTextElements = totalTextElements; }
    
    public int getTranslatedElements() { return translatedElements; }
    public void setTranslatedElements(int translatedElements) { this.translatedElements = translatedElements; }
    
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
    
    public LocalDateTime getTranslationTime() { return translationTime; }
    public void setTranslationTime(LocalDateTime translationTime) { this.translationTime = translationTime; }
    
    public long getProcessingTimeMs() { return processingTimeMs; }
    public void setProcessingTimeMs(long processingTimeMs) { this.processingTimeMs = processingTimeMs; }
    
    public boolean hasErrors() {
        return errors != null && !errors.isEmpty();
    }
    
    public double getTranslationCompleteness() {
        if (totalTextElements == 0) return 0.0;
        return ((double) translatedElements / totalTextElements) * 100.0;
    }
    
    public static class TranslationResultBuilder {
        private String originalHtml;
        private String translatedHtml;
        private String sourceLanguage;
        private String targetLanguage;
        private String detectedLanguage;
        private int totalTextElements;
        private int translatedElements;
        private List<String> errors;
        private LocalDateTime translationTime;
        private long processingTimeMs;
        
        public TranslationResultBuilder originalHtml(String originalHtml) {
            this.originalHtml = originalHtml;
            return this;
        }
        
        public TranslationResultBuilder translatedHtml(String translatedHtml) {
            this.translatedHtml = translatedHtml;
            return this;
        }
        
        public TranslationResultBuilder sourceLanguage(String sourceLanguage) {
            this.sourceLanguage = sourceLanguage;
            return this;
        }
        
        public TranslationResultBuilder targetLanguage(String targetLanguage) {
            this.targetLanguage = targetLanguage;
            return this;
        }
        
        public TranslationResultBuilder detectedLanguage(String detectedLanguage) {
            this.detectedLanguage = detectedLanguage;
            return this;
        }
        
        public TranslationResultBuilder totalTextElements(int totalTextElements) {
            this.totalTextElements = totalTextElements;
            return this;
        }
        
        public TranslationResultBuilder translatedElements(int translatedElements) {
            this.translatedElements = translatedElements;
            return this;
        }
        
        public TranslationResultBuilder errors(List<String> errors) {
            this.errors = errors;
            return this;
        }
        
        public TranslationResultBuilder translationTime(LocalDateTime translationTime) {
            this.translationTime = translationTime;
            return this;
        }
        
        public TranslationResultBuilder processingTimeMs(long processingTimeMs) {
            this.processingTimeMs = processingTimeMs;
            return this;
        }
        
        public TranslationResult build() {
            return new TranslationResult(originalHtml, translatedHtml, sourceLanguage, targetLanguage,
                                       detectedLanguage, totalTextElements, translatedElements, errors,
                                       translationTime, processingTimeMs);
        }
    }
}
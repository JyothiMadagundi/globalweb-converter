package com.translator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "translation")
public class TranslationConfig {
    
    private String provider = "mock"; // Default to mock for development
    private String googleApiKey;
    private String googleCredentialsPath;
    private String googleProjectId;
    private int batchSize = 100; // Maximum texts to translate in one batch
    private int maxTextLength = 5000; // Maximum length of text to translate
        private String defaultSourceLanguage = "auto";
    private String defaultTargetLanguage = "en";
    private boolean mockFallback = true; // Enable intelligent fallback

    public TranslationConfig() {}
    
    // Getters and Setters
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    
    public String getGoogleApiKey() { return googleApiKey; }
    public void setGoogleApiKey(String googleApiKey) { this.googleApiKey = googleApiKey; }
    
    public String getGoogleCredentialsPath() { return googleCredentialsPath; }
    public void setGoogleCredentialsPath(String googleCredentialsPath) { this.googleCredentialsPath = googleCredentialsPath; }
    
    public String getGoogleProjectId() { return googleProjectId; }
    public void setGoogleProjectId(String googleProjectId) { this.googleProjectId = googleProjectId; }
    
    public int getBatchSize() { return batchSize; }
    public void setBatchSize(int batchSize) { this.batchSize = batchSize; }
    
    public int getMaxTextLength() { return maxTextLength; }
    public void setMaxTextLength(int maxTextLength) { this.maxTextLength = maxTextLength; }
    
    public String getDefaultSourceLanguage() { return defaultSourceLanguage; }
    public void setDefaultSourceLanguage(String defaultSourceLanguage) { this.defaultSourceLanguage = defaultSourceLanguage; }
    
    public String getDefaultTargetLanguage() { return defaultTargetLanguage; }
    public void setDefaultTargetLanguage(String defaultTargetLanguage) { this.defaultTargetLanguage = defaultTargetLanguage; }

    public boolean isMockFallback() { return mockFallback; }
    public void setMockFallback(boolean mockFallback) { this.mockFallback = mockFallback; }
}
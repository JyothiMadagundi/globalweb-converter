package com.translator.dto;

import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TranslationRequest {
    
    @NotBlank(message = "HTML content cannot be empty")
    @Size(max = 1000000, message = "HTML content is too large (max 1MB)")
    private String htmlContent;
    
    private String sourceLanguage = "auto";
    
    @NotBlank(message = "Target language is required")
    private String targetLanguage = "en";
    
    private MultipartFile htmlFile;
    
    private boolean downloadAsFile = true;
    
    private String fileName = "translated.html";
    
    public TranslationRequest() {}
    
    // Getters and Setters
    public String getHtmlContent() { return htmlContent; }
    public void setHtmlContent(String htmlContent) { this.htmlContent = htmlContent; }
    
    public String getSourceLanguage() { return sourceLanguage; }
    public void setSourceLanguage(String sourceLanguage) { this.sourceLanguage = sourceLanguage; }
    
    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }
    
    public MultipartFile getHtmlFile() { return htmlFile; }
    public void setHtmlFile(MultipartFile htmlFile) { this.htmlFile = htmlFile; }
    
    public boolean isDownloadAsFile() { return downloadAsFile; }
    public void setDownloadAsFile(boolean downloadAsFile) { this.downloadAsFile = downloadAsFile; }
    
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
}
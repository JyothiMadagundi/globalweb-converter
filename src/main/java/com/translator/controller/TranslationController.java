package com.translator.controller;

import com.translator.dto.TranslationRequest;
import com.translator.model.TranslationResult;
import com.translator.service.HtmlTranslationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import jakarta.validation.Valid;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Controller
@RequestMapping("/")
public class TranslationController {

    private static final Logger log = LoggerFactory.getLogger(TranslationController.class);
    
    private final HtmlTranslationService htmlTranslationService;
    
    public TranslationController(HtmlTranslationService htmlTranslationService) {
        this.htmlTranslationService = htmlTranslationService;
    }

    @GetMapping
    public String index(Model model) {
        model.addAttribute("translationRequest", new TranslationRequest());
        return "index_classic";
    }

    @PostMapping("/translate")
    public String translateHtml(@Valid @ModelAttribute TranslationRequest request,
                               BindingResult bindingResult,
                               Model model,
                               RedirectAttributes redirectAttributes,
                               @RequestParam(value = "download", required = false) String download) {
        
        if (bindingResult.hasErrors()) {
            model.addAttribute("translationRequest", request);
            return "index_classic";
        }

        try {
            String htmlContent = getHtmlContentFromRequest(request);
            
            if (htmlContent == null || htmlContent.trim().isEmpty()) {
                model.addAttribute("error", "Please provide HTML content either by text input or file upload");
                model.addAttribute("translationRequest", request);
                return "index_classic";
            }

            TranslationResult result = htmlTranslationService.translateHtml(
                    htmlContent, 
                    request.getSourceLanguage(), 
                    request.getTargetLanguage()
            );

            // If download is requested, return file directly
            if ("true".equals(download)) {
                try {
                    byte[] translatedBytes = result.getTranslatedHtml().getBytes(StandardCharsets.UTF_8);
                    String filename = generateFileName(request, result);
                    
                    // Use RedirectAttributes to pass data for download
                    redirectAttributes.addFlashAttribute("downloadContent", translatedBytes);
                    redirectAttributes.addFlashAttribute("downloadFilename", filename);
                    redirectAttributes.addFlashAttribute("contentType", MediaType.TEXT_HTML_VALUE);
                    
                    return "redirect:/download";
                } catch (Exception e) {
                    log.error("Download preparation failed", e);
                    model.addAttribute("error", "Download failed: " + e.getMessage());
                }
            }

            model.addAttribute("result", result);
            model.addAttribute("translationRequest", request);
            
            if (result.hasErrors()) {
                model.addAttribute("warning", "Translation completed with some errors. Check the details below.");
            } else {
                model.addAttribute("success", "Transformation completed successfully! Your HTML content is now ready for multi-language translation.");
            }

            return "result_classic";

        } catch (Exception e) {
            log.error("Translation failed", e);
            model.addAttribute("error", "Translation failed: " + e.getMessage());
            model.addAttribute("translationRequest", request);
            return "index_classic";
        }
    }

    @PostMapping("/translate/download")
    public ResponseEntity<Resource> downloadTranslatedHtml(@Valid @ModelAttribute TranslationRequest request,
                                                          BindingResult bindingResult) {
        
        if (bindingResult.hasErrors()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            String htmlContent = getHtmlContentFromRequest(request);
            
            if (htmlContent == null || htmlContent.trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            TranslationResult result = htmlTranslationService.translateHtml(
                    htmlContent, 
                    request.getSourceLanguage(), 
                    request.getTargetLanguage()
            );

            byte[] translatedBytes = result.getTranslatedHtml().getBytes(StandardCharsets.UTF_8);
            ByteArrayResource resource = new ByteArrayResource(translatedBytes);

            String filename = generateFileName(request, result);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.TEXT_HTML)
                    .contentLength(translatedBytes.length)
                    .body(resource);

        } catch (Exception e) {
            log.error("Download failed", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/api/translate")
    @ResponseBody
    public ResponseEntity<TranslationResult> translateApi(@RequestParam String htmlContent,
                                                         @RequestParam(defaultValue = "auto") String sourceLanguage,
                                                         @RequestParam(defaultValue = "en") String targetLanguage) {
        try {
            TranslationResult result = htmlTranslationService.translateHtml(htmlContent, sourceLanguage, targetLanguage);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("API translation failed", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/api/translate")
    @ResponseBody
    public ResponseEntity<TranslationResult> translateApiPost(@RequestBody TranslationRequest request) {
        try {
            TranslationResult result = htmlTranslationService.translateHtml(
                    request.getHtmlContent(), 
                    request.getSourceLanguage(), 
                    request.getTargetLanguage()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("API translation failed", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/sample")
    public String samplePage(Model model) {
        // Load the sample Arabic content provided by the user
        String sampleHtml = getSampleArabicHtml();
        TranslationRequest request = new TranslationRequest();
        request.setHtmlContent(sampleHtml);
        request.setSourceLanguage("auto");
        request.setTargetLanguage("en");
        
        model.addAttribute("translationRequest", request);
        model.addAttribute("isSample", true);
        return "index_classic";
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> handleDownload(RedirectAttributes redirectAttributes, Model model) {
        try {
            byte[] content = (byte[]) redirectAttributes.getFlashAttributes().get("downloadContent");
            String filename = (String) redirectAttributes.getFlashAttributes().get("downloadFilename");
            String contentType = (String) redirectAttributes.getFlashAttributes().get("contentType");
            
            if (content == null || filename == null) {
                return ResponseEntity.notFound().build();
            }
            
            ByteArrayResource resource = new ByteArrayResource(content);
            
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType(contentType != null ? contentType : MediaType.TEXT_HTML_VALUE))
                    .contentLength(content.length)
                    .body(resource);
                    
        } catch (Exception e) {
            log.error("Download failed", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private String getHtmlContentFromRequest(TranslationRequest request) throws IOException {
        if (request.getHtmlFile() != null && !request.getHtmlFile().isEmpty()) {
            return new String(request.getHtmlFile().getBytes(), StandardCharsets.UTF_8);
        }
        return request.getHtmlContent();
    }

    private String generateFileName(TranslationRequest request, TranslationResult result) {
        String baseFileName = request.getFileName();
        if (baseFileName == null || baseFileName.trim().isEmpty()) {
            baseFileName = "translated.html";
        }
        
        if (!baseFileName.toLowerCase().endsWith(".html")) {
            baseFileName += ".html";
        }

        String timestamp = result.getTranslationTime().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String langCode = result.getTargetLanguage().toUpperCase();
        
        return String.format("%s_%s_%s", 
                baseFileName.substring(0, baseFileName.lastIndexOf('.')), 
                langCode, 
                timestamp) + ".html";
    }

    private String getSampleArabicHtml() {
        // This is a simplified version of the Arabic content provided
        return """
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>البنك الإسلامي الأردني - الخدمات المصرفية عبر الإنترنت</title>
                <meta name="description" content="Jordan Islamic Bank-Internet banking service">
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>البنك الإسلامي الأردني</h1>
                        <p class="lead">دخول المستخدم</p>
                    </div>
                    <div class="login-form">
                        <div class="form-group">
                            <label for="username">اسم المستخدم</label>
                            <input id="username" type="text" placeholder="اسم المستخدم" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="password">كلمة المرور</label>
                            <input id="password" type="password" placeholder="كلمة المرور" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>الرجاء ادخال الرقم العشوائي</label>
                            <input type="text" class="form-control">
                            <button type="button">إظهار رمز آخر</button>
                        </div>
                        <button type="submit" class="btn btn-primary">تسجيل الدخـــول</button>
                    </div>
                    <div class="links">
                        <a href="#" title="هل نسيت كلمة المرور/اسم المستخدم؟">هل نسيت كلمة المرور/اسم المستخدم؟</a>
                        <a href="#" title="تفعيل الحساب">تفعيل الحساب</a>
                        <a href="#" title="إنشاء حساب جديد">إنشاء حساب جديد</a>
                    </div>
                    <div class="footer-buttons">
                        <button title="تعليمات الأمن">تعليمات الأمن</button>
                        <button title="دليل المستخدم">دليل المستخدم</button>
                        <button title="إتصل بنا">إتصل بنا</button>
                        <button title="سياسة الخصوصية">سياسة الخصوصية</button>
                        <button title="الشروط والأحكام">الشروط والأحكام</button>
                    </div>
                    <div class="notice">
                        <p>عزيزنا المتعامل، من أجل راحتكم قمنا بتوحيد اسم المستخدم وكلمة المرور الخاصة بالخدمات المصرفية عبر الموبايل والإنترنت.</p>
                    </div>
                    <div class="contact-info">
                        <p>مركز الاتصال السريع: +962 6 5200400</p>
                        <p>البريد الالكتروني: info@islamicbank.com.jo</p>
                        <p>الموقع: www.jordanislamicbank.com.jo</p>
                    </div>
                </div>
            </body>
            </html>
            """;
    }
}
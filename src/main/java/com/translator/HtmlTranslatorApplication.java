package com.translator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class HtmlTranslatorApplication {

    public static void main(String[] args) {
        System.out.println("🚀 Starting GlobalWeb Converter...");
        System.out.println("🌍 Port: " + System.getenv("PORT"));
        System.out.println("🔧 Profile: " + System.getProperty("spring.profiles.active"));
        
        SpringApplication app = new SpringApplication(HtmlTranslatorApplication.class);
        app.run(args);
        
        System.out.println("✅ GlobalWeb Converter started successfully!");
    }
}
package com.translator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootApplication
public class HtmlTranslatorApplication {

    @Autowired
    private Environment environment;

    public static void main(String[] args) {
        System.out.println("🚀 Starting GlobalWeb Converter...");
        System.out.println("🌍 PORT env: " + System.getenv("PORT"));
        System.out.println("🔧 Profile: " + System.getProperty("spring.profiles.active"));
        System.out.println("🏠 Server address: " + System.getProperty("server.address"));
        System.out.println("📍 Server port: " + System.getProperty("server.port"));
        
        try {
            SpringApplication app = new SpringApplication(HtmlTranslatorApplication.class);
            app.run(args);
        } catch (Exception e) {
            System.err.println("❌ Failed to start application: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        String port = environment.getProperty("server.port", "8080");
        String address = environment.getProperty("server.address", "localhost");
        System.out.println("✅ GlobalWeb Converter started successfully!");
        System.out.println("🌐 Application running on: http://" + address + ":" + port);
        System.out.println("🎯 Ready to serve requests!");
    }
}
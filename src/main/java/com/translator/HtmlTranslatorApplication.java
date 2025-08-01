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
        System.out.println("🔧 Profile property: " + System.getProperty("spring.profiles.active"));
        System.out.println("🏠 Server address property: " + System.getProperty("server.address"));
        System.out.println("📍 Server port property: " + System.getProperty("server.port"));
        
        // Force the environment 
        String port = System.getenv("PORT");
        if (port != null) {
            System.setProperty("server.port", port);
            System.out.println("🔧 Forced server.port to: " + port);
        }
        System.setProperty("server.address", "0.0.0.0");
        System.out.println("🔧 Forced server.address to: 0.0.0.0");
        
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
        String address = environment.getProperty("server.address", "0.0.0.0");
        System.out.println("✅ GlobalWeb Converter started successfully!");
        System.out.println("🌐 Application running on: http://" + address + ":" + port);
        System.out.println("🌍 Railway should route external traffic to this app");
        System.out.println("🎯 Ready to serve requests from: https://globalweb-converter-production.up.railway.app/");
    }
}
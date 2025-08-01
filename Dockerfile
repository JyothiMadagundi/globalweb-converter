# Ultra-simple Dockerfile for Railway
FROM openjdk:17-jdk-slim

# Install Maven
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Build the app
RUN mvn clean package -DskipTests

# Simple startup with debugging
CMD echo "🚀 Docker container starting..." && \
    echo "🌍 PORT environment variable: ${PORT:-NOT_SET}" && \
    echo "🔧 Java version: $(java -version 2>&1 | head -1)" && \
    echo "📦 JAR file exists: $(ls -la target/html-translator-0.0.1-SNAPSHOT.jar)" && \
    echo "🎯 Starting Spring Boot application..." && \
    echo "🔧 Forcing railway profile and 0.0.0.0 binding..." && \
    java -Xmx300m -Xms150m \
    -Dserver.port=${PORT:-8080} \
    -Dserver.address=0.0.0.0 \
    -Dspring.profiles.active=railway \
    -DPORT=${PORT:-8080} \
    -Djava.awt.headless=true \
    -Dlogging.level.org.springframework.boot.web.embedded.tomcat=INFO \
    -jar target/html-translator-0.0.1-SNAPSHOT.jar
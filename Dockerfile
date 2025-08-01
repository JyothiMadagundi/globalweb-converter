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
CMD echo "Starting application on port ${PORT:-8080}..." && \
    java -Xmx300m -Xms150m \
    -Dserver.port=${PORT:-8080} \
    -Dspring.profiles.active=railway \
    -Djava.awt.headless=true \
    -jar target/html-translator-0.0.1-SNAPSHOT.jar
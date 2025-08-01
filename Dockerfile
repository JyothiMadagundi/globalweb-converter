# Simple, reliable Dockerfile optimized for Railway
FROM openjdk:17-jdk-slim

# Install Maven and curl
RUN apt-get update && apt-get install -y maven curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Build the application
RUN mvn clean package -DskipTests -B

# Verify build
RUN ls -la target/ && test -f target/html-translator-0.0.1-SNAPSHOT.jar

# Set environment variables for Railway
ENV JAVA_OPTS="-Xmx400m -Xms200m -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE=production
ENV SERVER_PORT=${PORT:-8080}

# Expose port (Railway will override with PORT env var)
EXPOSE ${PORT:-8080}

# Start the application with Railway-optimized settings
CMD java $JAVA_OPTS \
    -Dserver.port=${PORT:-8080} \
    -jar target/html-translator-0.0.1-SNAPSHOT.jar
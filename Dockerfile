# Use a more stable base image for building
FROM eclipse-temurin:17-jdk-alpine AS build

# Install Maven
RUN apk add --no-cache maven

# Set working directory
WORKDIR /app

# Copy pom.xml and download dependencies first (for better caching)
COPY pom.xml .
RUN mvn dependency:resolve -B

# Copy source code
COPY src ./src

# Build the application with explicit settings and error checking
RUN mvn clean package -DskipTests -B \
    -Dmaven.compiler.source=17 \
    -Dmaven.compiler.target=17 \
    -Dproject.build.sourceEncoding=UTF-8

# Debug: List target directory contents
RUN echo "=== TARGET DIRECTORY CONTENTS ===" && ls -la target/

# Verify jar file exists
RUN test -f target/html-translator-0.0.1-SNAPSHOT.jar || (echo "JAR file not found! Contents:" && ls -la target/ && exit 1)

# Runtime stage with minimal image
FROM eclipse-temurin:17-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set working directory
WORKDIR /app

# Copy the jar file from build stage with verification
COPY --from=build /app/target/html-translator-0.0.1-SNAPSHOT.jar app.jar

# Verify the jar file was copied correctly
RUN test -f app.jar || (echo "app.jar not found after copy!" && ls -la && exit 1)

# Change ownership to non-root user
RUN chown appuser:appgroup app.jar

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check with longer timeout for startup
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Set JVM options for better performance and memory usage
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseContainerSupport -XX:MaxRAMPercentage=80.0 -server"
ENV SPRING_PROFILES_ACTIVE=production

# Run the application with better startup options
CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
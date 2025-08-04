// GlobalWeb Converter - Client-side JavaScript Application
// Replicates Spring Boot backend functionality for GitHub Pages hosting

class GlobalWebConverter {
    constructor() {
        this.currentHtmlContent = '';
        this.detectedLanguage = 'auto';
        this.initializeEventListeners();
        this.initializeLanguagePatterns();
    }

    // Initialize language detection patterns (from Java backend)
    initializeLanguagePatterns() {
        this.languagePatterns = {
            'zh': /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, // Chinese
            'ja': /[\u3040-\u309F\u30A0-\u30FF]/g, // Japanese
            'ko': /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g, // Korean
            'ar': /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, // Arabic
            'th': /[\u0E00-\u0E7F]/g, // Thai
            'hi': /[\u0900-\u097F]/g, // Hindi
            'he': /[\u0590-\u05FF]/g, // Hebrew
            'ru': /[\u0400-\u04FF]/g, // Russian/Cyrillic
            'el': /[\u0370-\u03FF]/g, // Greek
            'tr': /[çÇğĞıİöÖşŞüÜ]/g, // Turkish
            'vi': /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồố]/g, // Vietnamese
            'fr': /[àâäéèêëïîôùûüÿç]/g, // French
            'de': /[äöüÄÖÜß]/g, // German
            'es': /[ñáéíóúü¿¡]/g, // Spanish
            'pt': /[ãõáéíóúâêîôûàèç]/g, // Portuguese
            'it': /[àèéìíîòóù]/g // Italian
        };
    }

    // Initialize event listeners
    initializeEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const fileUploadZone = document.getElementById('fileUploadZone');
        const htmlContent = document.getElementById('htmlContent');

        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        fileUploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        fileUploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        fileUploadZone.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Text area input
        htmlContent.addEventListener('input', (e) => this.handleTextInput(e));
    }

    // Handle file selection
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    // Handle drag over
    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }

    // Handle drag leave
    handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }

    // Handle file drop
    handleFileDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    // Handle text input
    handleTextInput(event) {
        this.currentHtmlContent = event.target.value;
    }

    // Process uploaded file
    processFile(file) {
        if (!this.isValidHtmlFile(file)) {
            this.showNotification('Please select a valid HTML file (.html or .htm)', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showNotification('File size must be less than 10MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentHtmlContent = e.target.result;
            document.getElementById('htmlContent').value = this.currentHtmlContent;
            this.showNotification('File loaded successfully!', 'success');
        };
        reader.onerror = () => {
            this.showNotification('Error reading file', 'error');
        };
        reader.readAsText(file);
    }

    // Validate HTML file
    isValidHtmlFile(file) {
        const validExtensions = ['.html', '.htm'];
        const fileName = file.name.toLowerCase();
        return validExtensions.some(ext => fileName.endsWith(ext));
    }

    // Detect language from HTML content
    detectLanguageFromContent(htmlContent) {
        // Extract text content from HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        if (!textContent.trim()) {
            return 'auto';
        }

        const scores = {};
        
        // Score each language based on character matches
        for (const [lang, pattern] of Object.entries(this.languagePatterns)) {
            const matches = textContent.match(pattern);
            if (matches) {
                scores[lang] = matches.length;
            }
        }

        // Handle Chinese vs Japanese distinction
        if (scores.zh && scores.ja) {
            // If we have both Chinese and Japanese characters, prefer the one with more matches
            // Additional heuristic: Japanese often has more hiragana/katakana mixed with kanji
            const hiraganaKatakana = /[\u3040-\u309F\u30A0-\u30FF]/g;
            const hiraganaMatches = textContent.match(hiraganaKatakana);
            
            if (hiraganaMatches && hiraganaMatches.length > scores.zh * 0.1) {
                scores.ja += hiraganaMatches.length * 2; // Boost Japanese score
            }
        }

        // Find the language with the highest score
        let detectedLang = 'auto';
        let maxScore = 0;

        for (const [lang, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedLang = lang;
            }
        }

        console.log('Language detection scores:', scores);
        console.log('Detected language:', detectedLang);

        return detectedLang;
    }

    // Inject Google Translate widget into HTML
    injectGoogleTranslateWidget(htmlContent, detectedLanguage) {
        const startTime = Date.now();
        
        try {
            // Create a DOM parser
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Create the Google Translate widget HTML
            const googleTranslateWidget = `
<div id="google_translate_element" style="margin: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px; text-align: center;"></div>
<script type="text/javascript">
  function googleTranslateElementInit() {
    new google.translate.TranslateElement(
      {pageLanguage: '${detectedLanguage}'},
      'google_translate_element'
    );
  }
</script>
<script type="text/javascript"
  src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit">
</script>`;

            // Find the body element and inject the widget at the beginning
            const body = doc.body;
            if (body) {
                const widgetDiv = document.createElement('div');
                widgetDiv.innerHTML = googleTranslateWidget;
                
                // Insert at the beginning of body
                body.insertBefore(widgetDiv, body.firstChild);
            } else {
                // If no body tag, create one and add the widget
                const newBody = doc.createElement('body');
                newBody.innerHTML = googleTranslateWidget + (doc.documentElement.innerHTML || htmlContent);
                doc.documentElement.appendChild(newBody);
            }

            const processingTime = Date.now() - startTime;
            console.log(`Google Translate widget injected successfully in ${processingTime}ms`);

            return {
                success: true,
                html: doc.documentElement.outerHTML,
                detectedLanguage: detectedLanguage,
                processingTime: processingTime
            };

        } catch (error) {
            console.error('Error injecting Google Translate widget:', error);
            return {
                success: false,
                html: htmlContent,
                error: error.message
            };
        }
    }

    // Process and preview HTML
    processAndPreview() {
        if (!this.validateInput()) return;

        const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
        const result = this.injectGoogleTranslateWidget(this.currentHtmlContent, detectedLanguage);

        if (result.success) {
            this.displayPreview(result.html);
            this.showNotification('HTML transformation completed successfully!', 'success');
        } else {
            this.showNotification('Error processing HTML: ' + result.error, 'error');
        }
    }

    // Process and download HTML
    processAndDownload() {
        if (!this.validateInput()) return;

        const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
        const result = this.injectGoogleTranslateWidget(this.currentHtmlContent, detectedLanguage);

        if (result.success) {
            this.downloadHTML(result.html, detectedLanguage);
            this.showNotification('File download started!', 'success');
        } else {
            this.showNotification('Error processing HTML: ' + result.error, 'error');
        }
    }

    // Validate input
    validateInput() {
        if (!this.currentHtmlContent || this.currentHtmlContent.trim() === '') {
            this.showNotification('Please provide HTML content either by file upload or text input', 'error');
            return false;
        }
        return true;
    }

    // Display preview
    displayPreview(transformedHTML) {
        const previewFrame = document.getElementById('previewFrame');
        const resultContainer = document.getElementById('resultContainer');
        
        // Store the transformed HTML for download
        this.transformedHTML = transformedHTML;

        // Display in iframe
        const blob = new Blob([transformedHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        previewFrame.src = url;

        // Show result container
        resultContainer.style.display = 'block';
        resultContainer.scrollIntoView({ behavior: 'smooth' });

        // Clean up URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Download HTML file
    downloadHTML(htmlContent, detectedLanguage) {
        const filename = this.generateFilename(detectedLanguage);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Generate filename
    generateFilename(detectedLanguage) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        return `translated-${detectedLanguage}-to-multilang-${timestamp}.html`;
    }

    // Download transformed HTML (called from button)
    downloadTransformedHTML() {
        if (this.transformedHTML) {
            const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
            this.downloadHTML(this.transformedHTML, detectedLanguage);
            this.showNotification('File downloaded successfully!', 'success');
        } else {
            this.showNotification('No transformed HTML available', 'error');
        }
    }

    // Reset form
    resetForm() {
        this.currentHtmlContent = '';
        this.transformedHTML = '';
        document.getElementById('htmlContent').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('resultContainer').style.display = 'none';
        this.showNotification('Form reset successfully', 'info');
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)} me-2"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Hide notification after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Get notification icon
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Global functions for HTML onclick handlers
let converter;

function processAndPreview() {
    converter.processAndPreview();
}

function processAndDownload() {
    converter.processAndDownload();
}

function downloadTransformedHTML() {
    converter.downloadTransformedHTML();
}

function resetForm() {
    converter.resetForm();
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    converter = new GlobalWebConverter();
    console.log('GlobalWeb Converter initialized successfully!');
});
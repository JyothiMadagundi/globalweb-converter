// GlobalWeb Converter - Client-side HTML Translation Tool
class GlobalWebConverter {
    constructor() {
        this.currentHtmlContent = '';
        this.transformedHTML = '';
        this.initializeEventListeners();
    }

    // Initialize event listeners
    initializeEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const htmlContent = document.getElementById('htmlContent');
        const fileUploadZone = document.getElementById('fileUploadZone');

        // File input change
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Text area change
        if (htmlContent) {
            htmlContent.addEventListener('input', (e) => {
                this.currentHtmlContent = e.target.value;
            });
        }

        // Drag and drop
        if (fileUploadZone) {
            fileUploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadZone.classList.add('dragover');
            });

            fileUploadZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fileUploadZone.classList.remove('dragover');
            });

            fileUploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadZone.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
        }
    }

    // Handle file selection
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    // Handle file processing
    handleFile(file) {
        // Validate file type
        if (!file.name.toLowerCase().match(/\.(html|htm)$/)) {
            this.showNotification('Please select an HTML file (.html or .htm)', 'error');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showNotification('File size must be less than 10MB', 'error');
            return;
        }

        // Read file
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

    // Detect language from HTML content
    detectLanguageFromContent(htmlContent) {
        // Remove HTML tags for language detection
        const textContent = htmlContent.replace(/<[^>]*>/g, ' ').trim();
        
        // Language detection patterns
        const patterns = {
            'zh': /[\u4e00-\u9fff]/,  // Chinese
            'ja': /[\u3040-\u309f\u30a0-\u30ff]/,  // Japanese
            'ko': /[\uac00-\ud7af]/,  // Korean
            'ar': /[\u0600-\u06ff]/,  // Arabic
            'hi': /[\u0900-\u097f]/,  // Hindi
            'th': /[\u0e00-\u0e7f]/,  // Thai
            'ru': /[\u0400-\u04ff]/,  // Russian
            'he': /[\u0590-\u05ff]/,  // Hebrew
            'de': /\b(der|die|das|und|ist|ein|eine|mit|für)\b/i,  // German
            'fr': /\b(le|la|les|de|du|des|et|un|une|est|avec)\b/i,  // French
            'es': /\b(el|la|los|las|de|del|y|un|una|es|con)\b/i,  // Spanish
            'it': /\b(il|la|lo|gli|le|di|del|e|un|una|è|con)\b/i,  // Italian
            'pt': /\b(o|a|os|as|de|do|da|e|um|uma|é|com)\b/i,  // Portuguese
            'nl': /\b(de|het|een|en|van|is|met|voor|op)\b/i  // Dutch
        };

        // Check for language patterns
        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(textContent)) {
                return lang;
            }
        }

        return 'auto'; // Default to auto-detect
    }

    // Inject Google Translate Widget
    injectGoogleTranslateWidget(htmlContent, detectedLanguage) {
        const startTime = Date.now();
        
        try {
            // Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Create Google Translate elements
            const translateDiv = doc.createElement('div');
            translateDiv.id = 'google_translate_element';
            translateDiv.style.cssText = 'margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;';

            const initScript = doc.createElement('script');
            initScript.type = 'text/javascript';
            initScript.textContent = `
                function googleTranslateElementInit() {
                    new google.translate.TranslateElement(
                        {pageLanguage: ''},
                        'google_translate_element'
                    );
                }
            `;

            const apiScript = doc.createElement('script');
            apiScript.type = 'text/javascript';
            apiScript.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';

            // Insert at the beginning of body
            const body = doc.body;
            if (body) {
                body.insertBefore(translateDiv, body.firstChild);
                body.appendChild(initScript);
                body.appendChild(apiScript);
            } else {
                throw new Error('No body tag found in HTML');
            }

            // Convert back to HTML string
            const transformedHTML = new XMLSerializer().serializeToString(doc);
            const processingTime = Date.now() - startTime;

            return {
                success: true,
                html: transformedHTML,
                detectedLanguage: detectedLanguage,
                processingTime: processingTime
            };

        } catch (error) {
            console.error('Error injecting Google Translate widget:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Process and preview HTML
    processAndPreview() {
        console.log('processAndPreview called');
        
        if (!this.validateInput()) {
            console.log('Input validation failed');
            return;
        }

        console.log('Starting processing...');
        
        // Show loading spinner
        this.showLoading(true);

        // Add small delay for smooth UX
        setTimeout(() => {
            const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
            console.log('Detected language:', detectedLanguage);
            
            const result = this.injectGoogleTranslateWidget(this.currentHtmlContent, detectedLanguage);
            console.log('Injection result:', result);

            this.showLoading(false);

            if (result.success) {
                this.displayPreview(result.html, result.detectedLanguage, result.processingTime);
                this.showNotification('HTML transformation completed successfully!', 'success');
            } else {
                this.showNotification('Error processing HTML: ' + result.error, 'error');
            }
        }, 500);
    }

    // Process and download HTML
    processAndDownload() {
        console.log('processAndDownload called');
        
        if (!this.validateInput()) {
            return;
        }

        // Show loading spinner
        this.showLoading(true);

        // Add small delay for smooth UX
        setTimeout(() => {
            const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
            const result = this.injectGoogleTranslateWidget(this.currentHtmlContent, detectedLanguage);

            this.showLoading(false);

            if (result.success) {
                this.downloadHTML(result.html, result.detectedLanguage);
                this.showNotification('File download started!', 'success');
            } else {
                this.showNotification('Error processing HTML: ' + result.error, 'error');
            }
        }, 300);
    }

    // Validate input
    validateInput() {
        if (!this.currentHtmlContent || this.currentHtmlContent.trim() === '') {
            this.showNotification('Please provide HTML content either by file upload or text input', 'error');
            return false;
        }
        
        // Basic HTML validation
        if (!this.currentHtmlContent.toLowerCase().includes('<html') && 
            !this.currentHtmlContent.toLowerCase().includes('<body') &&
            !this.currentHtmlContent.toLowerCase().includes('<div') &&
            !this.currentHtmlContent.toLowerCase().includes('<p')) {
            this.showNotification('Please provide valid HTML content', 'error');
            return false;
        }
        
        return true;
    }

    // Display preview
    displayPreview(transformedHTML, detectedLanguage, processingTime) {
        console.log('displayPreview called with params:', {
            htmlLength: transformedHTML ? transformedHTML.length : 0,
            detectedLanguage,
            processingTime
        });

        const previewFrame = document.getElementById('previewFrame');
        const resultContainer = document.getElementById('resultContainer');
        const htmlCodeDisplay = document.getElementById('htmlCodeDisplay');
        const detectedLangStat = document.getElementById('detectedLang');
        const processingTimeStat = document.getElementById('processingTime');
        
        // Store the transformed HTML for download
        this.transformedHTML = transformedHTML;

        // Update stats
        if (detectedLangStat) {
            detectedLangStat.textContent = detectedLanguage.toUpperCase();
        }
        if (processingTimeStat) {
            processingTimeStat.textContent = processingTime + 'ms';
        }

        // Display HTML code
        if (htmlCodeDisplay) {
            htmlCodeDisplay.textContent = this.formatHtml(transformedHTML);
            console.log('HTML code displayed in code tab');
        }

        // Display in iframe
        if (previewFrame) {
            const blob = new Blob([transformedHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            previewFrame.src = url;
            console.log('Preview frame updated with blob URL');

            // Clean up URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }

        // Show result container
        if (resultContainer) {
            resultContainer.style.display = 'block';
            setTimeout(() => {
                resultContainer.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            console.log('Result container shown');
        }
    }

    // Format HTML for display
    formatHtml(html) {
        if (!html) return '';
        
        // Simple HTML formatting for better readability
        return html
            .replace(/></g, '>\n<')
            .replace(/\n\s*\n/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    // Download HTML file
    downloadHTML(htmlContent, detectedLanguage) {
        const filename = this.generateFilename(detectedLanguage);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    // Download transformed HTML (from preview)
    downloadTransformedHTML() {
        if (this.transformedHTML) {
            const detectedLanguage = this.detectLanguageFromContent(this.transformedHTML);
            this.downloadHTML(this.transformedHTML, detectedLanguage);
            this.showNotification('File download started!', 'success');
        } else {
            this.showNotification('No transformed HTML available. Please process a file first.', 'error');
        }
    }

    // Generate filename
    generateFilename(detectedLanguage) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        return `globalweb-translated-${detectedLanguage}-${timestamp}.html`;
    }

    // Reset form
    resetForm() {
        this.currentHtmlContent = '';
        this.transformedHTML = '';
        
        document.getElementById('htmlContent').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('resultContainer').style.display = 'none';
        
        this.showNotification('Form reset successfully!', 'info');
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)} me-2"></i>
            ${message}
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show with animation
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
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

    // Show/hide loading spinner
    showLoading(show) {
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'block' : 'none';
        }
    }

    // Copy HTML code to clipboard
    copyHtmlCode() {
        if (this.transformedHTML) {
            navigator.clipboard.writeText(this.transformedHTML).then(() => {
                this.showNotification('HTML code copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback method
                const textArea = document.createElement('textarea');
                textArea.value = this.transformedHTML;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('HTML code copied to clipboard!', 'success');
            });
        } else {
            this.showNotification('No HTML code to copy!', 'error');
        }
    }
}

// Global functions for HTML onclick handlers
let converter;

function processAndPreview() {
    console.log('Global processAndPreview called');
    if (converter) {
        converter.processAndPreview();
    } else {
        console.error('Converter not initialized');
    }
}

function processAndDownload() {
    console.log('Global processAndDownload called');
    if (converter) {
        converter.processAndDownload();
    } else {
        console.error('Converter not initialized');
    }
}

function downloadTransformedHTML() {
    console.log('Global downloadTransformedHTML called');
    if (converter) {
        converter.downloadTransformedHTML();
    } else {
        console.error('Converter not initialized');
    }
}

function resetForm() {
    console.log('Global resetForm called');
    if (converter) {
        converter.resetForm();
    } else {
        console.error('Converter not initialized');
    }
}

function copyHtmlCode() {
    console.log('Global copyHtmlCode called');
    if (converter) {
        converter.copyHtmlCode();
    } else {
        console.error('Converter not initialized');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing GlobalWeb Converter...');
    converter = new GlobalWebConverter();
    console.log('GlobalWeb Converter initialized successfully!');
});
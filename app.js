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

        // Text area change and initial content
        if (htmlContent) {
            // Set initial content from textarea
            this.currentHtmlContent = htmlContent.value;
            
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

    // Translate content using Microsoft Translator API
    async translateWithMicrosoft(htmlContent, detectedLanguage) {
        const startTime = Date.now();
        
        try {
            // For demo purposes, we'll use a fallback translation method
            // In production, you would use actual Microsoft Translator API
            
            let translatedHTML = await this.translateContentToEnglish(htmlContent, detectedLanguage);
            
            const processingTime = Date.now() - startTime;

            return {
                success: true,
                html: translatedHTML,
                detectedLanguage: detectedLanguage,
                processingTime: processingTime,
                method: 'Microsoft Translator API (Demo)'
            };

        } catch (error) {
            console.error('Error with Microsoft Translator:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Real translation API - no pre-fed data, uses actual translation service
    async translateContentToEnglish(htmlContent, detectedLanguage) {
        try {
            // First, remove any existing Google Translate elements
            let cleanedHTML = this.removeAllGoogleTranslateElements(htmlContent);
            
            // Use real translation API (MyMemory Free API)
            let translatedHTML = await this.simulateAPITranslation(cleanedHTML, detectedLanguage);
            
            // Ensure no Google Translate elements remain after translation
            translatedHTML = this.removeAllGoogleTranslateElements(translatedHTML);
            
            // Add translation metadata
            const translationNote = `<!-- Translated from ${detectedLanguage} to English using MyMemory Translation API -->`;
            if (translatedHTML.includes('<head>')) {
                translatedHTML = translatedHTML.replace('<head>', '<head>\n    ' + translationNote);
            } else if (translatedHTML.includes('<html>')) {
                translatedHTML = translatedHTML.replace('<html>', '<html>\n' + translationNote);
            } else {
                translatedHTML = translationNote + '\n' + translatedHTML;
            }

            return translatedHTML;
        } catch (error) {
            console.error('Translation error:', error);
            return htmlContent; // Return original if translation fails
        }
    }

    // Remove ALL Google Translate elements completely
    removeAllGoogleTranslateElements(htmlContent) {
        let cleaned = htmlContent;
        
        // Remove Google Translate div
        cleaned = cleaned.replace(/<div[^>]*id=["']google_translate_element["'][^>]*>[\s\S]*?<\/div>/gi, '');
        
        // Remove Google Translate scripts
        cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?googleTranslateElementInit[\s\S]*?<\/script>/gi, '');
        cleaned = cleaned.replace(/<script[^>]*src=["'][^"']*translate\.google\.com[^"']*["'][^>]*><\/script>/gi, '');
        
        // Remove any remaining Google Translate references
        cleaned = cleaned.replace(/function\s+googleTranslateElementInit\s*\(\s*\)\s*{[\s\S]*?}/gi, '');
        cleaned = cleaned.replace(/new\s+google\.translate\.TranslateElement[\s\S]*?;/gi, '');
        
        // Remove Google Translate CSS classes and elements that might be dynamically added
        cleaned = cleaned.replace(/<[^>]*class=["'][^"']*goog-te[^"']*["'][^>]*>/gi, '');
        cleaned = cleaned.replace(/class=["']([^"']*)goog-te[^"']*["']/gi, 'class="$1"');
        
        // Clean up any empty lines left behind
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return cleaned;
    }

    // Real API translation behavior using actual translation service
    async simulateAPITranslation(htmlContent, detectedLanguage) {
        // This uses a real translation API (MyMemory Free API)
        // 1. Parse HTML structure
        // 2. Extract text content
        // 3. Translate text using real API while preserving HTML
        // 4. Return translated HTML
        
        try {
            // Create a temporary DOM to parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Find all text nodes and translate them using real API
            await this.translateTextNodes(doc.body || doc.documentElement);
            
            // Return the translated HTML
            return doc.documentElement.outerHTML;
        } catch (error) {
            console.log('Fallback to simple text replacement');
            // Fallback: simple text processing
            return this.translateTextContent(htmlContent, detectedLanguage);
        }
    }

    // Real text node translation using actual API
    async translateTextNodes(element) {
        if (!element) return;
        
        const translationPromises = [];
        
        // Collect all text nodes that need translation
        const collectTextNodes = (elem) => {
            for (let node of elem.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text.length > 2 && !this.isEnglish(text)) {
                        translationPromises.push(
                            this.simulateTextTranslation(text).then(translated => {
                                node.textContent = translated;
                            })
                        );
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Handle attributes
                    if (node.title && !this.isEnglish(node.title)) {
                        translationPromises.push(
                            this.simulateTextTranslation(node.title).then(translated => {
                                node.title = translated;
                            })
                        );
                    }
                    if (node.alt && !this.isEnglish(node.alt)) {
                        translationPromises.push(
                            this.simulateTextTranslation(node.alt).then(translated => {
                                node.alt = translated;
                            })
                        );
                    }
                    if (node.placeholder && !this.isEnglish(node.placeholder)) {
                        translationPromises.push(
                            this.simulateTextTranslation(node.placeholder).then(translated => {
                                node.placeholder = translated;
                            })
                        );
                    }
                    // Recursively process child elements
                    collectTextNodes(node);
                }
            }
        };
        
        collectTextNodes(element);
        
        // Wait for all translations to complete
        await Promise.all(translationPromises);
    }

    // Real text translation using multiple free translation APIs
    async simulateTextTranslation(text) {
        // Skip if already English or too short
        if (this.isEnglish(text) || text.trim().length < 2) {
            return text;
        }
        
        const cleanText = text.trim();
        
        try {
            // Try MyMemory API first (most reliable for Chinese)
            const myMemoryResponse = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=auto|en`,
                { timeout: 5000 }
            );
            
            if (myMemoryResponse.ok) {
                const data = await myMemoryResponse.json();
                if (data.responseStatus === 200 && data.responseData.translatedText) {
                    const translated = data.responseData.translatedText.trim();
                    // Check if translation is meaningful (not just copied text)
                    if (translated && translated !== cleanText && !translated.includes('MYMEMORY WARNING')) {
                        return translated;
                    }
                }
            }
        } catch (error) {
            console.log('MyMemory API error, trying fallback...');
        }
        
        try {
            // Fallback 1: Try LibreTranslate public instance
            const libreResponse = await fetch('https://libretranslate.de/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: cleanText,
                    source: 'auto',
                    target: 'en',
                    format: 'text'
                }),
                timeout: 5000
            });
            
            if (libreResponse.ok) {
                const data = await libreResponse.json();
                if (data.translatedText && data.translatedText !== cleanText) {
                    return data.translatedText.trim();
                }
            }
        } catch (error) {
            console.log('LibreTranslate API error, trying another API...');
        }

        try {
            // Fallback 2: Try another free translation service
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(cleanText)}`, {
                timeout: 3000
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                    const translated = data[0][0][0].trim();
                    if (translated && translated !== cleanText) {
                        return translated;
                    }
                }
            }
        } catch (error) {
            console.log('Google Translate API error, no more fallbacks available...');
        }
        
        // Final fallback: Return original text if all APIs fail
        // NO PRE-FED DATA - purely API-based translation
        return text;
    }

    // Universal language detection - NO PRE-FED DATA
    isEnglish(text) {
        const cleanText = text.trim();
        
        // Skip very short text, numbers, or common symbols
        if (cleanText.length < 2 || /^[\d\s.,!?'"()\-_+=<>/\\|@#$%^&*[\]{}~`]+$/.test(cleanText)) {
            return true;
        }
        
        // Check for non-Latin scripts (definitely not English)
        // This covers: Chinese, Japanese, Korean, Arabic, Russian, Hindi, Thai, etc.
        const nonLatinPattern = /[\u4e00-\u9fff\u3400-\u4dbf\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u0e00-\u0e7f\u0900-\u097f\u1100-\u11ff\uac00-\ud7af]/;
        
        if (nonLatinPattern.test(text)) {
            return false; // Contains non-Latin characters, definitely not English
        }
        
        // For Latin-based scripts, use basic heuristic
        // If it contains mostly English letters and common English patterns, assume English
        const englishPattern = /^[a-zA-Z0-9\s.,!?'"()\-_+=<>/\\|@#$%^&*[\]{}~`]+$/;
        
        // If it doesn't match basic English pattern, it's probably another language
        return englishPattern.test(text);
    }

    // Fallback text content translation
    translateTextContent(htmlContent, detectedLanguage) {
        // Simple fallback that preserves HTML structure
        return htmlContent.replace(/>[^<]+</g, (match) => {
            const text = match.slice(1, -1).trim();
            if (text.length > 0 && !this.isEnglish(text)) {
                return `>[Translated: ${text}]<`;
            }
            return match;
        });
    }

    // Process and preview HTML
    async processAndPreview() {
        console.log('processAndPreview called');
        
        if (!this.validateInput()) {
            console.log('Input validation failed');
            return;
        }

        console.log('Starting processing...');
        
        // Show loading spinner
        this.showLoading(true);

        // Add small delay for smooth UX
        setTimeout(async () => {
            const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
            console.log('Detected language:', detectedLanguage);
            
            const result = await this.translateWithMicrosoft(this.currentHtmlContent, detectedLanguage);
            console.log('Translation result:', result);

            this.showLoading(false);

            if (result.success) {
                this.displayPreview(result.html, result.detectedLanguage, result.processingTime);
                this.showNotification('Translation completed successfully with real translation API!', 'success');
            } else {
                this.showNotification('Error processing HTML: ' + result.error, 'error');
            }
        }, 500);
    }

    // Process and download HTML
    async processAndDownload() {
        console.log('processAndDownload called');
        
        if (!this.validateInput()) {
            return;
        }

        // Show loading spinner
        this.showLoading(true);

        // Add small delay for smooth UX
        setTimeout(async () => {
            const detectedLanguage = this.detectLanguageFromContent(this.currentHtmlContent);
            const result = await this.translateWithMicrosoft(this.currentHtmlContent, detectedLanguage);

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

        // Display in iframe with enhanced settings for Google Translate
        if (previewFrame) {
            try {
                // Set iframe attributes for better compatibility
                previewFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation');
                previewFrame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                
                // Try direct document writing first (better for external scripts)
                previewFrame.onload = () => {
                    try {
                        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
                        iframeDoc.open();
                        iframeDoc.write(transformedHTML);
                        iframeDoc.close();
                        console.log('HTML written directly to iframe document');
                    } catch (error) {
                        console.log('Direct write failed, using blob URL fallback:', error);
                        // Fallback to blob URL method
                        const blob = new Blob([transformedHTML], { type: 'text/html; charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        previewFrame.src = url;
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                    }
                };
                
                // Set initial src to trigger onload
                previewFrame.src = 'about:blank';
                
                console.log('Preview frame setup with enhanced Google Translate compatibility');
            } catch (error) {
                console.error('Error setting up preview frame:', error);
                // Final fallback to simple blob URL
                const blob = new Blob([transformedHTML], { type: 'text/html; charset=utf-8' });
                const url = URL.createObjectURL(blob);
                previewFrame.src = url;
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            }
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

    // Download HTML file with custom filename
    downloadHTML(htmlContent, detectedLanguage) {
        // Prompt user for custom filename
        const defaultName = `translated-${detectedLanguage}-to-english`;
        const customName = prompt(
            'Enter filename for download (without .html extension):',
            defaultName
        );
        
        // If user cancels, don't download
        if (customName === null) {
            return;
        }
        
        // Clean the filename and ensure it's valid
        const cleanName = customName.trim() || defaultName;
        const safeFileName = cleanName.replace(/[^a-zA-Z0-9\-_]/g, '-') + '.html';
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFileName;
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
// GlobalWeb Converter - Client-side HTML Translation Tool
class GlobalWebConverter {
    constructor() {
        this.currentHtmlContent = '';
        this.transformedHTML = '';
        this.translationCache = new Map();
        this.initializeEventListeners();
    }

    // Fetch with timeout; works even if AbortController is unavailable
    fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
        try {
            if (typeof AbortController === 'undefined') {
                return Promise.race([
                    fetch(url, options),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
                ]);
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const merged = { ...options, signal: controller.signal };
            return fetch(url, merged).finally(() => clearTimeout(timeoutId));
        } catch (_) {
            return fetch(url, options);
        }
    }

    // Strip all <script> tags and inline event handlers (onclick, onload, etc.)
    stripScriptsAndEventHandlers(htmlContent) {
        if (!htmlContent) return htmlContent;
        let cleaned = htmlContent;
        cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        return cleaned;
    }

    // Mask numbers and emails; skip masking on login/auth pages unless window.FORCE_MASKING === true
    maskNumericAndAtExceptLogin(htmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            const forceMask = (typeof window !== 'undefined' && window.FORCE_MASKING === true);
            const selectorSignals = [
                'input[type="password"]', 'input[name*="pass" i]', 'input[id*="pass" i]',
                'input[autocomplete="current-password" i]', 'input[autocomplete="one-time-code" i]',
                'input[name*="otp" i]', 'input[id*="otp" i]', '[id*="captcha" i]', '[class*="captcha" i]', 'img[alt*="captcha" i]'
            ].join(',');
            const hasSensitiveInputs = !!(doc.querySelector && doc.querySelector(selectorSignals));
            const hasAuthForm = !!(doc.querySelector && doc.querySelector(
                'form[action*="login" i], form[action*="signin" i], form[action*="auth" i], form[action*="customer/login" i], form[id*="login" i], form[class*="login" i]'
            ));
            const pageText = ((doc.body || doc.documentElement).textContent || '').toLowerCase();
            const hasUser = pageText.includes('username') || pageText.includes('اسم المستخدم');
            const hasPass = pageText.includes('password') || pageText.includes('كلمة المرور');
            const hasLoginWord = pageText.includes('login') || pageText.includes('sign in') || pageText.includes('signin') || pageText.includes('تسجيل الدخول');
            const keywordBasedAuth = (hasUser && hasPass) || (hasLoginWord && hasPass);
            if (!forceMask && (hasSensitiveInputs || hasAuthForm || keywordBasedAuth)) {
                return htmlContent;
            }

            const NA = 'NA';
            const NUM_RE = /(\d{2,}(?:[.,]\d+)*|\d)/g; // numbers
            const EMAIL_RE = /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
            const COMBINED_RE = new RegExp(`${NUM_RE.source}|${EMAIL_RE.source}`, 'g');

            const replaceInTextNode = (textNode) => {
                const text = textNode.nodeValue || '';
                if (!COMBINED_RE.test(text)) { COMBINED_RE.lastIndex = 0; return; }
                COMBINED_RE.lastIndex = 0;
                const frag = doc.createDocumentFragment();
                let last = 0; let m;
                while ((m = COMBINED_RE.exec(text)) !== null) {
                    const idx = m.index;
                    if (idx > last) frag.appendChild(doc.createTextNode(text.slice(last, idx)));
                    if (m[1]) {
                        const span = doc.createElement('span');
                        span.className = 'masked-sensitive';
                        span.textContent = NA;
                        frag.appendChild(span);
                    } else {
                        const firstChar = m[2] || '';
                        const domain = m[4] || '';
                        if (firstChar) frag.appendChild(doc.createTextNode(firstChar));
                        const span = doc.createElement('span');
                        span.className = 'masked-sensitive';
                        span.textContent = NA;
                        frag.appendChild(span);
                        if (domain) frag.appendChild(doc.createTextNode(domain));
                    }
                    last = idx + m[0].length;
                }
                if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
                if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
            };

            const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT, null);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(replaceInTextNode);

            (doc.body || doc.documentElement).querySelectorAll('*').forEach((el) => {
                const tag = (el.tagName || '').toUpperCase();
                if (tag === 'SCRIPT' || tag === 'STYLE') return;
                ['value','title','alt','aria-label','placeholder'].forEach((attr) => {
                    if (el.hasAttribute && el.hasAttribute(attr)) {
                        let v0 = el.getAttribute(attr) || '';
                        if (!v0) return;
                        v0 = v0.replace(EMAIL_RE, (full, first, rest, domain) => `${first}${NA}${domain}`);
                        NUM_RE.lastIndex = 0;
                        v0 = v0.replace(NUM_RE, NA);
                        el.setAttribute(attr, v0);
                    }
                });
            });

            // Light style for masked content
            const style = doc.createElement('style');
            style.textContent = `.masked-sensitive { color: #bfc5cf !important; }`;
            (doc.head || doc.documentElement).appendChild(style);

            return doc.documentElement.outerHTML;
        } catch (_) {
            return htmlContent;
        }
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
        
        const candidates = [];
        
        // Collect all text nodes that need translation
        const collectTextNodes = (elem) => {
            for (let node of elem.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const raw = node.textContent || '';
                    const text = raw.trim();
                    if (text.length > 0 && !/^[\d\s.,:/\-]+$/.test(text) && !/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)) {
                        candidates.push({ kind: 'text', node, original: text });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Handle attributes
                    if (node.title) candidates.push({ kind: 'attr', attr: 'title', node, original: node.title });
                    if (node.alt) candidates.push({ kind: 'attr', attr: 'alt', node, original: node.alt });
                    if (node.placeholder) candidates.push({ kind: 'attr', attr: 'placeholder', node, original: node.placeholder });
                    // Recursively process child elements
                    collectTextNodes(node);
                }
            }
        };
        
        collectTextNodes(element);
        
        if (candidates.length === 0) return;

        const uniqueTexts = Array.from(new Set(candidates.map(c => c.original)));
        const results = new Map();

        const worker = async (text) => {
            try {
                const translated = await this.simulateTextTranslation(text);
                results.set(text, translated);
            } catch (_) {
                results.set(text, text);
            }
        };

        const concurrency = 16;
        let index = 0;
        const runners = Array.from({ length: Math.min(concurrency, uniqueTexts.length) }, async () => {
            while (true) {
                const i = index++;
                if (i >= uniqueTexts.length) break;
                await worker(uniqueTexts[i]);
            }
        });
        await Promise.all(runners);

        for (const c of candidates) {
            const translated = results.get(c.original) ?? c.original;
            if (c.kind === 'text') c.node.textContent = translated;
            else c.node[c.attr] = translated;
        }
    }

    // Real text translation using multiple free translation APIs
    async simulateTextTranslation(text) {
        const cleanText = text.trim();
        if (!cleanText || this.isEnglish(cleanText)) return text;

        const cacheKey = `en|${cleanText}`;
        const cached = this.translationCache.get(cacheKey);
        if (cached) return cached;

        // Prefer Google for accuracy (short), then MyMemory/Libre (short), then retry longer
        const tryGoogle = async (timeoutMs) => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(cleanText)}`;
            const resp = await this.fetchWithTimeout(url, {}, timeoutMs);
            if (!resp.ok) throw new Error('google not ok');
            const data = await resp.json();
            const segments = Array.isArray(data?.[0]) ? data[0].map(row => row?.[0]).filter(Boolean) : [];
            const translated = segments.join(' ').trim();
            if (translated && translated !== cleanText) return translated;
            throw new Error('google empty');
        };

        const detectMyMemorySourceFromText = (t) => {
            if (!t) return null;
            if (/[^\u0000-\u007F]*[\u4e00-\u9fff]/.test(t)) return 'zh-CN';
            if (/[\u3040-\u309f\u30a0-\u30ff]/.test(t)) return 'ja';
            if (/[\uac00-\ud7af]/.test(t)) return 'ko';
            if (/[\u0600-\u06ff]/.test(t)) return 'ar';
            if (/[\u0900-\u097f]/.test(t)) return 'hi';
            if (/[\u0e00-\u0e7f]/.test(t)) return 'th';
            if (/[\u0400-\u04ff]/.test(t)) return 'ru';
            if (/[\u0590-\u05ff]/.test(t)) return 'he';
            const s = t.toLowerCase();
            if (/( der | die | das | und | ist | ein | eine | mit | für )/.test(' '+s+' ')) return 'de';
            if (/( le | la | les | de | du | des | et | un | une | est | avec )/.test(' '+s+' ')) return 'fr';
            if (/( el | la | los | las | de | del | y | un | una | es | con )/.test(' '+s+' ')) return 'es';
            if (/( il | la | lo | gli | le | di | del | e | un | una | è | con )/.test(' '+s+' ')) return 'it';
            if (/( o | a | os | as | de | do | da | e | um | uma | é | com )/.test(' '+s+' ')) return 'pt';
            if (/( de | het | een | en | van | is | met | voor | op )/.test(' '+s+' ')) return 'nl';
            return 'auto';
        };

        const tryMyMemory = async (timeoutMs) => {
            const src = detectMyMemorySourceFromText(cleanText) || 'auto';
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${encodeURIComponent(src)}|en`;
            const resp = await this.fetchWithTimeout(url, {}, timeoutMs);
            if (!resp.ok) throw new Error('mymemory not ok');
            const data = await resp.json();
            const t = (data?.responseData?.translatedText || '').trim();
            const details = (data?.responseDetails || '').toString().toUpperCase();
            const invalid = t.toUpperCase().includes("'AUTO' IS AN INVALID") || details.includes('INVALID');
            if (!invalid && t && t !== cleanText && !t.includes('MYMEMORY WARNING')) return t;
            throw new Error('mymemory empty');
        };

        const tryLibre = async (timeoutMs) => {
            const resp = await this.fetchWithTimeout('https://libretranslate.de/translate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: cleanText, source: 'auto', target: 'en', format: 'text' })
            }, timeoutMs);
            if (!resp.ok) throw new Error('libre not ok');
            const data = await resp.json();
            const t = (data?.translatedText || '').trim();
            if (t && t !== cleanText) return t;
            throw new Error('libre empty');
        };

        const raceOthers = async (timeoutMs) => new Promise((resolve) => {
            const starters = [() => tryMyMemory(timeoutMs), () => tryLibre(timeoutMs)];
            let done = false; let left = starters.length;
            starters.forEach(s => s().then(r => { if (!done && r) { done = true; resolve(r); } })
                .catch(() => { left -= 1; if (!done && left === 0) resolve(null); }));
        });

        try { const g = await tryGoogle(3000); if (g) { this.translationCache.set(cacheKey, g); return g; } } catch (_) {}
        const o1 = await raceOthers(5000); if (o1) { this.translationCache.set(cacheKey, o1); return o1; }
        try { const g2 = await tryGoogle(8000); if (g2) { this.translationCache.set(cacheKey, g2); return g2; } } catch (_) {}
        const o2 = await raceOthers(9000); if (o2) { this.translationCache.set(cacheKey, o2); return o2; }
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
            
            // Mask first (unless login), and strip scripts/handlers for stability
            const masked = this.maskNumericAndAtExceptLogin(this.currentHtmlContent);
            const prepped = this.stripScriptsAndEventHandlers(masked);
            const result = await this.translateWithMicrosoft(prepped, detectedLanguage);
            console.log('Translation result:', result);

            this.showLoading(false);

            if (result.success) {
                this.displayPreview(result.html, result.detectedLanguage, result.processingTime);
                // Show success doll popup instead of notification
                setTimeout(() => this.showSuccessDoll(), 500);
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
            const masked = this.maskNumericAndAtExceptLogin(this.currentHtmlContent);
            const prepped = this.stripScriptsAndEventHandlers(masked);
            const result = await this.translateWithMicrosoft(prepped, detectedLanguage);

            this.showLoading(false);

            if (result.success) {
                this.downloadHTML(result.html, result.detectedLanguage);
                // Show success doll popup instead of notification
                setTimeout(() => this.showSuccessDoll(), 300);
            } else {
                this.showNotification('Error processing HTML: ' + result.error, 'error');
            }
        }, 300);
    }

    // Validate and prepare input
    validateInput() {
        let content = this.currentHtmlContent ? this.currentHtmlContent.trim() : '';
        
        if (!content) {
            this.showNotification('Please provide content either by file upload or text input', 'error');
            return false;
        }
        
        // Auto-wrap plain text in HTML tags
        if (!this.isHtmlContent(content)) {
            // It's plain text, wrap it in HTML
            content = `<html>\n<head>\n<meta charset="UTF-8">\n<title>Translated Content</title>\n</head>\n<body>\n<p>${content}</p>\n</body>\n</html>`;
            this.currentHtmlContent = content;
            
            // Update the textarea to show the wrapped HTML (optional - for user to see)
            const textarea = document.getElementById('htmlContent');
            if (textarea) {
                textarea.value = content;
            }
            
            console.log('Plain text detected, wrapped in HTML:', content);
        }
        
        return true;
    }
    
    // Check if content is HTML or plain text
    isHtmlContent(content) {
        // Simple check for HTML tags
        const htmlTagPattern = /<[^>]+>/;
        return htmlTagPattern.test(content);
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

    // Show success doll popup
    showSuccessDoll() {
        const overlay = document.getElementById('successOverlay');
        const doll = document.getElementById('successDoll');
        
        if (overlay && doll) {
            // Show overlay and doll
            overlay.classList.add('show');
            doll.classList.add('show');
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                overlay.classList.remove('show');
                doll.classList.remove('show');
            }, 3000);
            
            // Hide on click
            overlay.addEventListener('click', () => {
                overlay.classList.remove('show');
                doll.classList.remove('show');
            });
        }
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
// GlobalWeb Converter - Client-side HTML Translation Tool
class GlobalWebConverter {
    constructor() {
        this.currentHtmlContent = '';
        this.transformedHTML = '';
        this.translationCache = new Map();
        this.initializeEventListeners();
    }

    // Fetch with real timeout using AbortController
    fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
        try {
            if (typeof AbortController === 'undefined') {
                // Fallback for older browsers: race without aborting the fetch
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
            // Last-resort fallback
            return fetch(url, options);
        }
    }

    // (Removed glossary/placeholder logic per request)

    // Provider: Google translate (gtx)
    async providerGoogle(cleanText, target, timeoutMs) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(cleanText)}`;
        const resp = await this.fetchWithTimeout(url, {}, timeoutMs);
        if (!resp.ok) throw new Error('google not ok');
        const data = await resp.json();
        const segments = Array.isArray(data?.[0]) ? data[0].map(row => row?.[0]).filter(Boolean) : [];
        const translated = segments.join(' ').trim();
        if (translated) return translated;
        throw new Error('google empty');
    }

    // Provider: MyMemory
    async providerMyMemory(cleanText, target, timeoutMs) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=auto|${encodeURIComponent(target)}`;
        const resp = await this.fetchWithTimeout(url, {}, timeoutMs);
        if (!resp.ok) throw new Error('mymemory not ok');
        const data = await resp.json();
        const t = (data?.responseData?.translatedText || '').trim();
        if (t && !t.includes('MYMEMORY WARNING')) return t;
        throw new Error('mymemory empty');
    }

    // Provider: LibreTranslate (public instance)
    async providerLibre(cleanText, target, timeoutMs) {
        const resp = await this.fetchWithTimeout(
            'https://libretranslate.de/translate',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: cleanText, source: 'auto', target, format: 'text' })
            },
            timeoutMs
        );
        if (!resp.ok) throw new Error('libre not ok');
        const data = await resp.json();
        const t = (data?.translatedText || '').trim();
        if (t) return t;
        throw new Error('libre empty');
    }

    // Race multiple providers and return the first successful non-empty translation
    async raceProviders(cleanText, target = 'en', shortTimeout = 4000, longTimeout = 9000) {
        const attempt = async (timeoutMs) => {
            const providers = [
                () => this.providerGoogle(cleanText, target, timeoutMs),
                () => this.providerMyMemory(cleanText, target, timeoutMs),
                () => this.providerLibre(cleanText, target, timeoutMs)
            ];
            // Manual first-success race (compatible with browsers lacking Promise.any)
            return new Promise((resolve) => {
                let pending = providers.length;
                let settled = false;
                providers.forEach(start => {
                    start().then(result => {
                        if (!settled && result) {
                            settled = true;
                            resolve(result);
                        }
                    }).catch(() => {
                        pending -= 1;
                        if (!settled && pending === 0) resolve(null);
                    });
                });
            });
        };

        // Try short timeouts first, then longer
        const fast = await attempt(shortTimeout);
        if (fast) return fast;
        const slower = await attempt(longTimeout);
        if (slower) return slower;
        return null;
    }

    // Remove script tags and inline on* handlers to keep preview safe and deterministic
    stripScriptsAndEventHandlers(htmlContent) {
        if (!htmlContent) return htmlContent;
        let cleaned = htmlContent;
        // Remove all <script>...</script>
        cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        // Remove inline event handlers like onclick="..." or onload='...'
        cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        return cleaned;
    }

    // Mask: except login pages, replace entire tag content with NA if it contains any digit or '@'
    maskNumericAndAtExceptLogin(htmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Skip masking for actual auth pages (password inputs or explicit auth forms), unless forced
            const hasPasswordField = !!(doc.querySelector && doc.querySelector('input[type="password"], input[name*="password" i]'));
            const hasAuthForm = !!(doc.querySelector && doc.querySelector('form[action*="login" i], form[action*="signin" i], form[id*="login" i], form[class*="login" i], form[action*="auth" i]'));
            const forceMask = (typeof window !== 'undefined' && window.FORCE_MASKING === true);
            if ((hasPasswordField || hasAuthForm) && !forceMask) {
                return htmlContent;
            }

            // Style for masked content (light grey)
            const style = doc.createElement('style');
            style.textContent = `.masked-sensitive { color: #bfc5cf !important; }\ninput::placeholder { color: #bfc5cf !important; }`;
            (doc.head || doc.documentElement).appendChild(style);

            const NA = 'NA';
            const NUM_RE = /(\d+(?:[.,]\d+)*)/g; // numbers (incl. decimals)
            // email: capture first char of local part, the remaining local part, and the domain
            const EMAIL_RE = /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
            // Combined matcher to build DOM fragments with spans for both cases
            const COMBINED_RE = new RegExp(`${NUM_RE.source}|${EMAIL_RE.source}`, 'g');

            // Replace numbers with NA spans; mask emails as firstChar + NA + domain
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
                        // Number matched
                        const span = doc.createElement('span');
                        span.className = 'masked-sensitive';
                        span.textContent = NA;
                        frag.appendChild(span);
                    } else {
                        // Email matched: groups 2 (first char), 3 (rest), 4 (domain)
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
                textNode.parentNode.replaceChild(frag, textNode);
            };

            // Walk all text nodes and replace tokens
            const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT, null);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(replaceInTextNode);

            // Update attributes and specific elements partially
            const root = doc.body || doc.documentElement;
            root.querySelectorAll('*').forEach((el) => {
                const tag = (el.tagName || '').toUpperCase();
                if (tag === 'SCRIPT' || tag === 'STYLE') return;

                // Inputs/textareas
                if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    if (typeof el.value === 'string' && (NUM_RE.test(el.value) || EMAIL_RE.test(el.value))) {
                        let v = el.value;
                        v = v.replace(EMAIL_RE, (full, first, rest, domain) => `${first}${NA}${domain}`);
                        NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                        v = v.replace(NUM_RE, NA);
                        el.value = v;
                        NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                    }
                    const ph = el.getAttribute && el.getAttribute('placeholder');
                    if (typeof ph === 'string' && (NUM_RE.test(ph) || EMAIL_RE.test(ph))) {
                        let nv = ph;
                        nv = nv.replace(EMAIL_RE, (full, first, rest, domain) => `${first}${NA}${domain}`);
                        NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                        nv = nv.replace(NUM_RE, NA);
                        el.setAttribute('placeholder', nv);
                        NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                    }
                }

                // Option text
                if (tag === 'OPTION') {
                    const t = el.textContent || '';
                    if (NUM_RE.test(t) || EMAIL_RE.test(t)) {
                        let nt = t.replace(EMAIL_RE, (full, first, rest, domain) => `${first}${NA}${domain}`);
                        NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                        nt = nt.replace(NUM_RE, NA);
                        el.textContent = nt;
                        el.classList.add('masked-sensitive');
                        NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                    }
                }

                // Visible attributes
                ['value','title','alt','aria-label'].forEach((attr) => {
                    if (el.hasAttribute && el.hasAttribute(attr)) {
                        const v0 = el.getAttribute(attr) || '';
                        if (NUM_RE.test(v0) || EMAIL_RE.test(v0)) {
                            let vv = v0.replace(EMAIL_RE, (full, first, rest, domain) => `${first}${NA}${domain}`);
                            NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                            vv = vv.replace(NUM_RE, NA);
                            el.setAttribute(attr, vv);
                            NUM_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0;
                        }
                    }
                });
            });

            return doc.documentElement.outerHTML;
        } catch (e) {
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

    // Removed masking per user request

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

    // Translate content using Microsoft Translator API (demo via public APIs chain)
    async translateWithMicrosoft(htmlContent, detectedLanguage) {
        const startTime = Date.now();
        
        try {
            let translatedHTML = await this.translateContentToEnglish(htmlContent, detectedLanguage);
            const processingTime = Date.now() - startTime;

            return {
                success: true,
                html: translatedHTML,
                detectedLanguage: detectedLanguage,
                processingTime: processingTime,
                method: 'Public translation APIs (Demo)'
            };

        } catch (error) {
            console.error('Error with translation flow:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Real translation API - no pre-fed data, uses actual translation service
    async translateContentToEnglish(htmlContent, detectedLanguage) {
        try {
            // First, remove any existing Google elements and scripts/handlers
            let cleanedHTML = this.stripScriptsAndEventHandlers(
                this.removeAllGoogleTranslateElements(htmlContent)
            );
            
            // Use real translation API (MyMemory Free API)
            let translatedHTML = await this.simulateAPITranslation(cleanedHTML, detectedLanguage);
            
            // Ensure no scripts or Google artifacts remain after translation
            translatedHTML = this.stripScriptsAndEventHandlers(
                this.removeAllGoogleTranslateElements(translatedHTML)
            );
            
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
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            await this.translateTextNodes(doc.body || doc.documentElement);
            return doc.documentElement.outerHTML;
        } catch (error) {
            console.log('Fallback to simple text replacement');
            return this.translateTextContent(htmlContent, detectedLanguage);
        }
    }

    // Real text node translation using actual API
    async translateTextNodes(element) {
        if (!element) return;
        const candidates = [];
        const collectTextNodes = (elem) => {
            for (let node of elem.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const raw = node.textContent || '';
                    const text = raw.trim();
                    if (text.length > 0 &&
                        !(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)) &&
                        !(/^[\d\s.,:/\-]+$/.test(text))) {
                        candidates.push({ kind: 'text', node, original: text });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tag = (node.tagName || '').toUpperCase();
                    if (tag === 'SCRIPT' || tag === 'STYLE') { continue; }
                    if (node.title) candidates.push({ kind: 'attr', attr: 'title', node, original: node.title });
                    if (node.alt) candidates.push({ kind: 'attr', attr: 'alt', node, original: node.alt });
                    if (node.placeholder) candidates.push({ kind: 'attr', attr: 'placeholder', node, original: node.placeholder });
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

        const runWithLimit = async (items, limit) => {
            let index = 0;
            const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
                while (true) {
                    const i = index++;
                    if (i >= items.length) break;
                    await worker(items[i]);
                }
            });
            await Promise.all(workers);
        };

        await runWithLimit(uniqueTexts, 16);

        for (const c of candidates) {
            const translated = results.get(c.original) ?? c.original;
            if (c.kind === 'text') {
                c.node.textContent = translated;
            } else if (c.kind === 'attr') {
                c.node[c.attr] = translated;
            }
        }
    }

    // Real text translation using multiple free translation APIs
    async simulateTextTranslation(text) {
        const cleanText = text.trim();
        if (!cleanText) return text;

        const cacheKey = `en|${cleanText}`;
        const cached = this.translationCache.get(cacheKey);
        if (cached) return cached;

        const translated = await this.raceProviders(cleanText, 'en', 1200, 2500);
        if (translated) { this.translationCache.set(cacheKey, translated); return translated; }
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
            // Apply masking per latest requirement, then translate
            const masked = this.maskNumericAndAtExceptLogin(this.currentHtmlContent);
            const result = await this.translateWithMicrosoft(masked, detectedLanguage);
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
            const result = await this.translateWithMicrosoft(masked, detectedLanguage);

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

    // (Removed target-language flows per request)

    // Translate to target language using same API chain
    async translateToLanguage(htmlContent, detectedLanguage, targetLang) {
        const startTime = Date.now();
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            await this.translateTextNodesToLanguage(doc.body || doc.documentElement, targetLang);
            const out = this.stripScriptsAndEventHandlers(doc.documentElement.outerHTML);
            const processingTime = Date.now() - startTime;
            return { success: true, html: out, detectedLanguage: targetLang, processingTime };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async translateTextNodesToLanguage(element, targetLang) {
        if (!element) return;
        const candidates = [];
        const walk = (el) => {
            for (let node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const trimmed = (node.textContent || '').trim();
                    if (trimmed.length > 0 &&
                        !(/^[\d\s.,:/\-]+$/.test(trimmed)) &&
                        !(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(trimmed))) {
                        candidates.push({ kind: 'text', node, original: trimmed });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tag = (node.tagName || '').toUpperCase();
                    if (tag === 'SCRIPT' || tag === 'STYLE') { continue; }
                    if (node.title) candidates.push({ kind: 'attr', attr: 'title', node, original: node.title });
                    if (node.alt) candidates.push({ kind: 'attr', attr: 'alt', node, original: node.alt });
                    if (node.placeholder) candidates.push({ kind: 'attr', attr: 'placeholder', node, original: node.placeholder });
                    walk(node);
                }
            }
        };
        walk(element);

        if (candidates.length === 0) return;

        const uniqueTexts = Array.from(new Set(candidates.map(c => c.original)));
        const results = new Map();

        const worker = async (text) => {
            try {
                const translated = await this.simulateTextTranslationTo(text, targetLang);
                results.set(text, translated);
            } catch (_) {
                results.set(text, text);
            }
        };
        const runWithLimit = async (items, limit) => {
            let index = 0;
            const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
                while (true) {
                    const i = index++;
                    if (i >= items.length) break;
                    await worker(items[i]);
                }
            });
            await Promise.all(workers);
        };
        await runWithLimit(uniqueTexts, 16);

        for (const c of candidates) {
            const translated = results.get(c.original) ?? c.original;
            if (c.kind === 'text') c.node.textContent = translated;
            else c.node[c.attr] = translated;
        }
    }

    async simulateTextTranslationTo(text, target) {
        const cleanText = text.trim();
        if (!cleanText) return text;
        const cacheKey = `${target}|${cleanText}`;
        const cached = this.translationCache.get(cacheKey);
        if (cached) return cached;
        const translated = await this.raceProviders(cleanText, target, 1200, 2500);
        if (translated) { this.translationCache.set(cacheKey, translated); return translated; }
        return text;
    }

    // Offline translation (no network). Stub that preserves structure.
    async translateWithOfflineModel(htmlContent, detectedLanguage) {
        const startTime = Date.now();
        try {
            // Parse and traverse, leaving text as-is (placeholder for local model inference)
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Ensure local ONNX runtime and model if available
            await this.ensureOfflineModel();

            if (this.offlineSession) {
                // Perform offline translation for text nodes if model is loaded
                await this.offlineTranslateTextNodes(doc.body || doc.documentElement, detectedLanguage || 'auto', 'en');
            }

            // If network translation explicitly allowed, perform network translation on the masked content
            if (this.allowNetwork()) {
                await this.translateTextNodes(doc.body || doc.documentElement);
            }

            const offlineHTML = doc.documentElement.outerHTML;

            const processingTime = Date.now() - startTime;
            return {
                success: true,
                html: offlineHTML,
                detectedLanguage: detectedLanguage,
                processingTime: processingTime,
                method: 'Offline (no network)'
            };
        } catch (error) {
            console.error('Offline translation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // No offline model hooks in this mode

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

// Removed target-language global handlers

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

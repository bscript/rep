export const SECRET_REGEXES = {
    'google_api': '\\bAIza[0-9A-Za-z-_]{35}\\b',
    'docs_file_extension': '^.*\\.(xls|xlsx|doc|docx)$',
    'bitcoin_address': '\\b[13][a-km-zA-HJ-NP-Z0-9]{26,33}\\b',
    'slack_api_key': 'xox.-[0-9]{12}-[0-9]{12}-[0-9a-zA-Z]{24}',
    'us_cn_zipcode': '(^\\d{5}(-\\d{4})?$)|(^[ABCEGHJKLMNPRSTVXY]{1}\\d{1}[A-Z]{1} *\\d{1}[A-Z]{1}\\d{1}$)',
    'google_cloud_platform_auth': '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    'google_cloud_platform_api': '[A-Za-z0-9_]{21}--[A-Za-z0-9_]{8}',
    'amazon_secret_key': '\\b[0-9a-zA-Z/+]{40}\\b',
    'gmail_auth_token': '[0-9a-zA-Z_]{32}\\.apps\\.googleusercontent\\.com',
    'github_auth_token': '\\b[0-9a-fA-F]{40}\\b',
    'instagram_token': '[0-9a-fA-F]{7}\\.[0-9a-fA-F]{32}',
    'twitter_access_token': '[1-9][0-9]+-[0-9a-zA-Z]{40}',
    'firebase': '\\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}\\b',
    'google_captcha': '6L[0-9A-Za-z-_]{38}|^6[0-9a-zA-Z_-]{39}$',
    'google_oauth': 'ya29\\.[0-9A-Za-z\\-_]+',
    'amazon_aws_access_key_id': '\\bA[SK]IA[0-9A-Z]{16}\\b',
    'amazon_mws_auth_token': 'amzn\\.mws\\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    'amazon_aws_url': 's3\\.amazonaws\\.com[/]+|[a-zA-Z0-9_-]*\\.s3\\.amazonaws\\.com',
    'facebook_access_token': '\\bEAACEdEose0cBA[0-9A-Za-z]+\\b',
    'authorization_basic': 'basic\\s+[a-zA-Z0-9=:_\\+\\/-]{20,}',
    'authorization_bearer': 'bearer\\s+[a-zA-Z0-9_\\-\\.=:_\\+\\/]{20,}',
    'authorization_api': '\\bapi[_-]?key\\s*[:=]\\s*[a-zA-Z0-9_\\-]{20,}\\b',
    'mailgun_api_key': '\\bkey-[0-9a-zA-Z]{32}\\b',
    'twilio_api_key': '\\bSK[0-9a-fA-F]{32}\\b',
    'twilio_account_sid': '\\bAC[a-zA-Z0-9_\\-]{32}\\b',
    'twilio_app_sid': '\\bAP[a-zA-Z0-9_\\-]{32}\\b',
    'paypal_braintree_access_token': 'access_token\\$production\\$[0-9a-z]{16}\\$[0-9a-f]{32}',
    'square_oauth_secret': 'sq0csp-[0-9A-Za-z\\-_]{43}|sq0[a-z]{3}-[0-9A-Za-z\\-_]{22,43}',
    'square_access_token': 'sqOatp-[0-9A-Za-z\\-_]{22}|EAAA[a-zA-Z0-9]{60}',
    'stripe_standard_api': '\\bsk_live_[0-9a-zA-Z]{24}\\b',
    'stripe_restricted_api': '\\brk_live_[0-9a-zA-Z]{24}\\b',
    'github_access_token': '[a-zA-Z0-9_-]*:[a-zA-Z0-9_\\-]+@github\\.com*',
    'rsa_private_key': '-----BEGIN RSA PRIVATE KEY-----',
    'ssh_dsa_private_key': '-----BEGIN DSA PRIVATE KEY-----',
    'ssh_dc_private_key': '-----BEGIN EC PRIVATE KEY-----',
    'pgp_private_block': '-----BEGIN PGP PRIVATE KEY BLOCK-----',
    'json_web_token': '\\bey[A-Za-z0-9_-]{10,}\\.ey[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b'
};

// Calculate Shannon Entropy
function getEntropy(str) {
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// Check if string looks like base64-encoded binary data (images, fonts, etc.)
function looksLikeBinaryBase64(str) {
    // Binary data has very high entropy and often contains lots of +/= chars
    const entropy = getEntropy(str);
    const plusSlashCount = (str.match(/[+/]/g) || []).length;
    const plusSlashRatio = plusSlashCount / str.length;

    // Binary base64 typically has:
    // - Very high entropy (>4.5)
    // - High ratio of +/ characters (>10%)
    // - Often ends with = padding
    // - Contains patterns like repeated numbers (77777, 3333)
    if (entropy > 4.5 && plusSlashRatio > 0.1) return true;

    // Check for repeated digit patterns common in base64 encoded binary
    if (/(\d)\1{3,}/.test(str)) return true; // Like 7777, 3333
    if (/[a-z]{5,}/i.test(str) && /\d{3,}/.test(str) && /[+/]/.test(str)) return true;

    // Any +/ characters at all suggest base64 binary data rather than a key
    if (plusSlashCount > 0) return true;

    return false;
}

// Check if string is a SHA-1 hash (40 hex characters)
function isSHA1Hash(str) {
    return /^[a-f0-9]{40}$/i.test(str);
}

// Check if string contains URL encoding patterns
function hasURLEncoding(str) {
    return /\+/.test(str) && /[a-z]{4,}/i.test(str); // Has + and words (like "scheduled+cache+content")
}

// Check if string is a valid Base58 character set (for Bitcoin)
function isValidBase58(str) {
    // Base58 excludes: 0 (zero), O (capital o), I (capital i), l (lowercase L)
    return !/[0OIl]/.test(str);
}

// Check if it's a camelCase or PascalCase identifier
function isCamelOrPascalCase(str) {
    // Matches typical JavaScript identifiers like:
    // - camelCase: starts lowercase, has uppercase
    // - PascalCase: starts uppercase, continues with mixed case
    // - No special chars except possibly trailing numbers
    return /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(str) || // camelCase
        /^[A-Z][a-z]+[A-Z][a-zA-Z0-9]*$/.test(str); // PascalCase
}

// Common JavaScript method patterns to exclude
const JS_METHOD_PATTERNS = [
    /^[a-z]+\.[a-z]+\.[a-z]+$/i,
    /prototype\./i,
    /^this\./i,
    /^Object\./i,
    /^Array\./i,
    /^window\./i,
    /^document\./i,
    /^navigator\./i,
    /addEventListener$/,
    /removeEventListener$/,
    /hasOwnProperty$/,
    /preventDefault$/,
    /stopPropagation$/,
    /_context\./,
    /_wrapperState\./,
    /\.current\./,
    /\.stateNode\./,
    /\.memoizedState/,
    /\.memoizedProps/,
    /\.pendingProps/,
    /\.updateQueue/
];

// Calculate confidence score (0-100)
function calculateConfidence(type, match, entropy) {
    let score = 50; // Base score

    // Entropy check
    if (entropy > 4.5) score += 20;
    else if (entropy > 3.5) score += 10;
    else score -= 10;

    // Type specific checks
    if (type === 'google_api') {
        if (match.startsWith('AIza')) score += 30;
    } else if (type === 'amazon_secret_key') {
        if (match.length === 40) score += 10;
        if (/[+/]/.test(match)) score += 10; // Real keys often have these
    } else if (type === 'json_web_token') {
        if (match.startsWith('ey')) score += 20;
        if (match.split('.').length === 3) score += 20;
    } else if (type === 'bitcoin_address') {
        if (match.startsWith('1') || match.startsWith('3')) score += 20;
    } else if (type.includes('authorization')) {
        score += 10;
    }

    // Length checks
    if (match.length > 20) score += 10;

    return Math.min(100, Math.max(0, score));
}

export async function scanForSecrets(requests, onProgress) {
    const results = [];
    const jsRequests = requests.filter(req => {
        const url = req.request.url.toLowerCase();
        const mime = req.response.content.mimeType.toLowerCase();
        return url.endsWith('.js') || mime.includes('javascript') || mime.includes('ecmascript');
    });

    let processed = 0;
    const total = jsRequests.length;

    for (const req of jsRequests) {
        try {
            const content = await new Promise((resolve) => {
                req.getContent((content, encoding) => {
                    resolve(content);
                });
            });

            if (!content) {
                processed++;
                if (onProgress) onProgress(processed, total);
                continue;
            }

            for (const [name, pattern] of Object.entries(SECRET_REGEXES)) {
                try {
                    const regex = new RegExp(pattern, 'g');
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        const matchedStr = match[0];

                        // Check if this match is part of base64 data by looking at context
                        const contextStart = Math.max(0, match.index - 50);
                        const contextEnd = Math.min(content.length, match.index + matchedStr.length + 50);
                        const context = content.substring(contextStart, contextEnd);

                        // Skip if surrounded by base64 indicators
                        if (/base64,|data:image|;base64|"publicKey"|"data":|iVBOR|AAAA|\/png|\/jpeg|\/jpg/i.test(context)) {
                            continue;
                        }

                        // Enhanced JWT filtering
                        if (name === 'json_web_token') {
                            if (!matchedStr.startsWith('ey')) continue;
                            const parts = matchedStr.split('.');
                            if (parts.length !== 3) continue;
                            if (!parts[1].startsWith('ey')) continue;

                            // Check against common JS patterns
                            let isJSPattern = false;
                            for (const jsPattern of JS_METHOD_PATTERNS) {
                                if (jsPattern.test(matchedStr)) {
                                    isJSPattern = true;
                                    break;
                                }
                            }
                            if (isJSPattern) continue;

                            // Each segment should be at least 10 chars
                            if (parts.some(p => p.length < 10)) continue;

                            // Check entropy of each part
                            if (parts.some(p => getEntropy(p) < 3.5)) continue;
                        }

                        // Enhanced Bitcoin address validation
                        if (name === 'bitcoin_address') {
                            // Must be valid Base58 (no 0, O, I, l)
                            if (!isValidBase58(matchedStr)) continue;

                            // Check entropy - real Bitcoin addresses have good entropy
                            if (getEntropy(matchedStr) < 3.8) continue;

                            // Shouldn't have too many repeated characters
                            if (/([a-zA-Z0-9])\1{3,}/.test(matchedStr)) continue;

                            // Check if it looks like it's part of base64 by checking for mixed case patterns
                            // Real Bitcoin addresses are Base58, base64 image data has different patterns
                            const hasLowerUpper = /[a-z]/.test(matchedStr) && /[A-Z]/.test(matchedStr);
                            const hasDigits = /\d/.test(matchedStr);
                            // If it has all three but looks too random, might be base64 fragment
                            if (hasLowerUpper && hasDigits && getEntropy(matchedStr) > 4.5) continue;
                        }

                        // Enhanced Amazon Secret Key filtering
                        if (name === 'amazon_secret_key') {
                            // 1. Check if it's a SHA-1 hash (common in source maps, cache keys)
                            if (isSHA1Hash(matchedStr)) continue;

                            // 2. Check if it's URL-encoded text
                            if (hasURLEncoding(matchedStr)) continue;

                            // 3. Check if it's a camelCase/PascalCase identifier
                            if (isCamelOrPascalCase(matchedStr)) continue;

                            // 4. Check if it looks like binary base64 data
                            if (looksLikeBinaryBase64(matchedStr)) continue;

                            // 5. Real AWS secret keys are base64 but NOT typical image/binary base64
                            // They should be alphanumeric with occasional +/ but not excessive
                            const upperCount = (matchedStr.match(/[A-Z]/g) || []).length;
                            const lowerCount = (matchedStr.match(/[a-z]/g) || []).length;
                            const digitCount = (matchedStr.match(/\d/g) || []).length;

                            // If it's mostly one type, likely not a real key
                            if (upperCount > 30 || lowerCount > 30 || digitCount > 30) continue;

                            // 6. AWS keys should have balanced character distribution
                            // Too many special chars suggests encoded binary
                            const specialChars = (matchedStr.match(/[+/]/g) || []).length;
                            const specialRatio = specialChars / matchedStr.length;
                            if (specialRatio > 0.15) continue;

                            // 7. Check for patterns typical in minified JS or encoded data
                            if (/([a-zA-Z])\1{3,}/.test(matchedStr)) continue;
                            if (/(\d)\1{3,}/.test(matchedStr)) continue;

                            // 8. Should have reasonable entropy but not too high (binary data)
                            const entropy = getEntropy(matchedStr);
                            if (entropy < 3.5 || entropy > 5.0) continue;
                        }

                        // Enhanced GitHub Auth Token filtering (also 40 chars like SHA-1)
                        if (name === 'github_auth_token') {
                            // GitHub tokens are hex, but so are SHA-1 hashes
                            // Real GitHub tokens are less common in frontend JS
                            // If it's a pure hex string, it's likely a hash
                            if (isSHA1Hash(matchedStr)) continue;
                        }

                        // Filter out low entropy strings for other high-entropy secrets
                        if (['github_auth_token', 'square_access_token', 'google_api', 'google_captcha'].includes(name)) {
                            if (getEntropy(matchedStr) < 4.0) continue;
                        }

                        // Specific check for Square Access Token
                        if (name === 'square_access_token' && matchedStr.startsWith('EAAA')) {
                            if (/^EAAA[A-Z]+$/.test(matchedStr)) continue;
                        }

                        const entropy = getEntropy(matchedStr);
                        const confidence = calculateConfidence(name, matchedStr, entropy);

                        results.push({
                            file: req.request.url,
                            type: name,
                            match: matchedStr,
                            index: match.index,
                            confidence: confidence
                        });
                    }
                } catch (e) {
                    console.warn(`Invalid regex for ${name}:`, e);
                }
            }
        } catch (err) {
            console.error('Error scanning request:', err);
        }

        processed++;
        if (onProgress) onProgress(processed, total);
    }

    return results;
}
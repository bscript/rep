// Attack Mode Engine for rep+ Bulk Replay
// Implements Burp Suite Intruder-style attack modes

/**
 * Generate attack requests based on attack type
 * @param {string} attackType - 'sniper', 'battering-ram', 'pitchfork', or 'cluster-bomb'
 * @param {Array} positionConfigs - Array of position configurations
 * @param {string} template - Request template with § markers
 * @returns {Array} Array of {payloads: Array, requestContent: string}
 */
export function generateAttackRequests(attackType, positionConfigs, template) {
    switch (attackType) {
        case 'sniper':
            return generateSniperRequests(positionConfigs, template);
        case 'battering-ram':
            return generateBatteringRamRequests(positionConfigs, template);
        case 'pitchfork':
            return generatePitchforkRequests(positionConfigs, template);
        case 'cluster-bomb':
            return generateClusterBombRequests(positionConfigs, template);
        default:
            throw new Error(`Unknown attack type: ${attackType}`);
    }
}

/**
 * Sniper Mode: One position at a time
 * For each position, iterate through its payloads while keeping others at original value
 */
function generateSniperRequests(positionConfigs, template) {
    const requests = [];

    positionConfigs.forEach((config, posIndex) => {
        const payloads = generatePayloadsForPosition(config);

        payloads.forEach(payload => {
            const payloadArray = positionConfigs.map((c, i) =>
                i === posIndex ? payload : c.originalValue
            );
            const requestContent = replacePositions(template, payloadArray);
            requests.push({ payloads: payloadArray, requestContent });
        });
    });

    return requests;
}

/**
 * Battering Ram Mode: Same payload for all positions
 * Uses first position's config for payload generation
 */
function generateBatteringRamRequests(positionConfigs, template) {
    const requests = [];

    // Use first position's config (or shared config if implemented)
    const payloads = generatePayloadsForPosition(positionConfigs[0]);

    payloads.forEach(payload => {
        const payloadArray = positionConfigs.map(() => payload);
        const requestContent = replacePositions(template, payloadArray);
        requests.push({ payloads: payloadArray, requestContent });
    });

    return requests;
}

/**
 * Pitchfork Mode: Zip payloads across positions (index-wise)
 * Stops when shortest list ends
 */
function generatePitchforkRequests(positionConfigs, template) {
    const requests = [];

    // Generate payloads for each position
    const allPayloads = positionConfigs.map(config => generatePayloadsForPosition(config));

    // Find shortest length
    const minLength = Math.min(...allPayloads.map(p => p.length));

    // Zip payloads
    for (let i = 0; i < minLength; i++) {
        const payloadArray = allPayloads.map(payloads => payloads[i]);
        const requestContent = replacePositions(template, payloadArray);
        requests.push({ payloads: payloadArray, requestContent });
    }

    return requests;
}

/**
 * Cluster Bomb Mode: Full Cartesian product
 * Generates all combinations of payloads across positions
 */
function generateClusterBombRequests(positionConfigs, template) {
    const requests = [];

    // Generate payloads for each position
    const allPayloads = positionConfigs.map(config => generatePayloadsForPosition(config));

    // Generate Cartesian product
    const cartesian = (...arrays) => {
        return arrays.reduce((acc, array) =>
            acc.flatMap(x => array.map(y => [...x, y])),
            [[]]
        );
    };

    const combinations = cartesian(...allPayloads);

    combinations.forEach(payloadArray => {
        const requestContent = replacePositions(template, payloadArray);
        requests.push({ payloads: payloadArray, requestContent });
    });

    return requests;
}

/**
 * Generate payloads for a single position based on its config
 */
function generatePayloadsForPosition(config) {
    if (config.type === 'simple-list') {
        return config.list.split('\n').filter(line => line.trim() !== '');
    } else if (config.type === 'numbers') {
        const payloads = [];
        const { from, to, step } = config.numbers;
        for (let i = from; i <= to; i += step) {
            payloads.push(i.toString());
        }
        return payloads;
    }
    return [];
}

/**
 * Replace all § markers in template with payloads
 * @param {string} template - Request template with § markers
 * @param {Array} payloads - Array of payload values (one per position)
 * @returns {string} Request content with markers replaced
 */
function replacePositions(template, payloads) {
    let index = 0;
    return template.replace(/§[\s\S]*?§/g, () => {
        return payloads[index++] || '';
    });
}

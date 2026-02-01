const { parentPort, workerData } = require('worker_threads');
const dns = require('dns');
const crypto = require('crypto');


/**
 * Generate random subdomain to avoid DNS caching
 */
function generateRandomSubdomain() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate random base32-encoded payload for Stream Gate testing
 * @param {number} length 
 */
function generateBase32Payload(length) {
    const randomBytes = crypto.randomBytes(length);
    let base32Encoded = base32Encode(randomBytes, 'RFC4648', { padding: false });

    // Add inline dots every 57 characters (Stream Gate format)
    const result = [];
    for (let i = 0; i < base32Encoded.length; i += 57) {
        result.push(base32Encoded.slice(i, i + 57));
    }

    return result.join('.');
}

/**
 * Resolve helper with timeout
 */
async function resolveWithTimeout(resolver, domain, type, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    });

    try {
        const resolvePromise = type === 'A' ? resolver.resolve4(domain) :
            type === 'TXT' ? resolver.resolveTxt(domain) :
                type === 'NS' ? resolver.resolveNs(domain) :
                    resolver.resolveAny(domain);

        const result = await Promise.race([resolvePromise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Test DNSTT Compatibility
 */
async function testDnstt(resolver, server, domain, timeoutMs) {
    const tests = {
        ns_support: false,
        txt_support: false,
        random_subdomain_1: false,
        random_subdomain_2: false
    };
    const details = [];

    // Test 1: NS record support
    try {
        const randSub = generateRandomSubdomain();
        const queryDomain = `${randSub}.${domain}`;
        await resolveWithTimeout(resolver, queryDomain, 'NS', timeoutMs);
        tests.ns_support = true;
        details.push('NS✓');
    } catch (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') {
            // NXDOMAIN is acceptable - means server queried properly
            tests.ns_support = true;
            details.push('NS✓');
        } else {
            details.push('NS✗');
        }
    }

    // Test 2: TXT record support
    try {
        const randSub = generateRandomSubdomain();
        const queryDomain = `${randSub}.${domain}`;
        await resolveWithTimeout(resolver, queryDomain, 'TXT', timeoutMs);
        tests.txt_support = true;
        details.push('TXT✓');
    } catch (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') {
            tests.txt_support = true;
            details.push('TXT✓');
        } else {
            details.push('TXT✗');
        }
    }

    // Test 3: Random Subdomain 1
    try {
        const randSub = generateRandomSubdomain();
        const queryDomain = `${randSub}.${generateRandomSubdomain()}.${domain}`;
        await resolveWithTimeout(resolver, queryDomain, 'A', timeoutMs);
        tests.random_subdomain_1 = true;
        details.push('RND1✓');
    } catch (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') {
            tests.random_subdomain_1 = true;
            details.push('RND1✓');
        } else {
            details.push('RND1✗');
        }
    }

    // Test 4: Random Subdomain 2
    try {
        const randSub = generateRandomSubdomain();
        const queryDomain = `${randSub}.${generateRandomSubdomain()}.${domain}`;
        await resolveWithTimeout(resolver, queryDomain, 'A', timeoutMs);
        tests.random_subdomain_2 = true;
        details.push('RND2✓');
    } catch (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') {
            tests.random_subdomain_2 = true;
            details.push('RND2✓');
        } else {
            details.push('RND2✗');
        }
    }

    const score = Object.values(tests).filter(Boolean).length;
    // Strict requirement: 4/4
    const isCompatible = score === 4;

    return {
        score,
        maxScore: 4,
        isCompatible,
        details: details.join(' ')
    };
}

/**
 * Test Stream Gate Compatibility
 */
async function testStreamGate(resolver, server, domain, timeoutMs) {
    let successful = 0;
    const responseTimes = [];
    const totalQueries = 15;

    for (let i = 0; i < totalQueries; i++) {
        const payloadSize = 20 + (i * 5);
        const base32Sub = generateBase32Payload(payloadSize);
        const queryDomain = `${base32Sub}.${domain}`;

        const start = process.hrtime();
        try {
            await resolveWithTimeout(resolver, queryDomain, 'TXT', timeoutMs);
            const diff = process.hrtime(start);
            const elapsed = (diff[0] * 1000) + (diff[1] / 1e6);
            successful++;
            responseTimes.push(elapsed);
        } catch (err) {
            const diff = process.hrtime(start);
            const elapsed = (diff[0] * 1000) + (diff[1] / 1e6);
            if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN' || err.code === 'ENODATA' || err.code === 'EREFUSED') {
                // NXDOMAIN, ENODATA (NoAnswer), EREFUSED are valid "responses" from the server
                // We count them as success because the server IS responding.
                successful++;
                responseTimes.push(elapsed);
            } else {
                // specific timeout or other network error
            }
        }
    }

    if (responseTimes.length === 0) {
        return {
            score: 0,
            maxScore: 3,
            isCompatible: false,
            details: 'FAIL'
        };
    }

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxTime = Math.max(...responseTimes);

    // Calculate StdDev
    let stdDev = 0;
    if (responseTimes.length > 1) {
        const variance = responseTimes.reduce((a, b) => a + Math.pow(b - avgTime, 2), 0) / (responseTimes.length - 1);
        stdDev = Math.sqrt(variance);
    }

    // STRICT criteria
    const passesAll = (
        successful >= 13 && // 90%+ (13.5)
        avgTime < 1000 &&
        maxTime < 3000 &&
        stdDev < 500
    );

    const score = passesAll ? 3 : 0;
    const details = passesAll
        ? `OK(${successful}/15) ${Math.round(avgTime)}ms σ${Math.round(stdDev)}`
        : `FAIL(${successful}/15)`;

    return {
        score,
        maxScore: 3,
        isCompatible: passesAll,
        details,
        stats: { avgTime, maxTime, stdDev } // Return raw stats for sorting
    };
}

// Global reference for the module
let base32Encode;

/**
 * Main Worker Logic
 */
parentPort.on('message', async (task) => {
    // Dynamic import for ESM module support in Worker
    if (!base32Encode) {
        try {
            const mod = await import('base32-encode');
            base32Encode = mod.default || mod;
        } catch (error) {
            parentPort.postMessage({
                server: task.server,
                success: false,
                elapsed: 0,
                message: `Failed to load base32-encode: ${error.message}`
            });
            return;
        }
    }

    const { server, domain, mode, timeout } = task;
    const start = process.hrtime();

    try {
        const resolver = new dns.promises.Resolver();
        resolver.setServers([server]);

        const timeoutMs = (timeout || 3) * 1000;
        let resultData;

        // Basic sanity check ("ping" equivalent via DNS)
        try {
            const randSub = generateRandomSubdomain();
            await resolveWithTimeout(resolver, `${randSub}.${domain}`, 'A', timeoutMs);
        } catch (err) {
            // Need to distinguish between "server not reachable" and "domain empty"
            if (err.message === 'TIMEOUT' || err.code === 'ETIMEOUT') {
                const diff = process.hrtime(start);
                const elapsed = (diff[0] * 1000) + (diff[1] / 1e6);
                parentPort.postMessage({
                    server,
                    success: false,
                    elapsed,
                    message: `${server} timeout`
                });
                return;
            }
        }

        if (mode === 'dnstt') {
            resultData = await testDnstt(resolver, server, domain, timeoutMs);
        } else {
            resultData = await testStreamGate(resolver, server, domain, timeoutMs);
        }

        const diff = process.hrtime(start);
        const elapsed = (diff[0] * 1000) + (diff[1] / 1e6);

        parentPort.postMessage({
            server,
            success: true, // Completed the test logic without crashing
            elapsed: resultData.stats?.avgTime || elapsed, // Use avgTime for ranking if available
            data: resultData
        });

    } catch (error) {
        const diff = process.hrtime(start);
        const elapsed = (diff[0] * 1000) + (diff[1] / 1e6);
        parentPort.postMessage({
            server,
            success: false,
            elapsed,
            message: error.message
        });
    }
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');

const ProjectScanner = require('./scanner');
const { addToWaitlist, getWaitlistCount, saveScanResult, getScanResult, getRecentScans } = require('./db');

const app = express();
const PORT = process.env.PORT || 3847;

// Rate limiting (simple in-memory)
const rateLimiter = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Rate limiting middleware
function rateLimit(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 10;

    if (!rateLimiter.has(clientIP)) {
        rateLimiter.set(clientIP, []);
    }

    const requests = rateLimiter.get(clientIP);
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({
            error: 'Rate limit exceeded. Try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }

    recentRequests.push(now);
    rateLimiter.set(clientIP, recentRequests);
    next();
}

// Helper function to validate GitHub URL
function isValidGitHubUrl(url) {
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
    return githubRegex.test(url);
}

// Helper function to clone repository
function cloneRepository(repoUrl, tempDir) {
    try {
        console.log(`Cloning ${repoUrl} to ${tempDir}`);
        
        // Clone with depth 1 for faster cloning
        execSync(`git clone --depth 1 "${repoUrl}" "${tempDir}"`, {
            stdio: 'pipe',
            timeout: 30000 // 30 second timeout
        });
        
        // Check repository size
        const stats = fs.statSync(tempDir);
        const sizeLimit = 100 * 1024 * 1024; // 100MB limit
        
        // Get directory size
        const getDirSize = (dir) => {
            let size = 0;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    size += getDirSize(filePath);
                } else {
                    size += stat.size;
                }
                // Early exit if too large
                if (size > sizeLimit) {
                    throw new Error('Repository too large');
                }
            }
            return size;
        };

        getDirSize(tempDir);
        return true;
        
    } catch (error) {
        console.error('Clone error:', error.message);
        throw new Error(`Failed to clone repository: ${error.message}`);
    }
}

// Helper function to clean up temp directory
function cleanupTempDir(tempDir) {
    try {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`Cleaned up temp directory: ${tempDir}`);
        }
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        waitlistCount: getWaitlistCount()
    });
});

// Get scan result by ID
app.get('/api/scan/:id', (req, res) => {
    try {
        const { id } = req.params;
        const result = getScanResult(id);
        
        if (!result) {
            return res.status(404).json({ error: 'Scan result not found' });
        }

        res.json({
            success: true,
            data: {
                id: result.id,
                repoUrl: result.repo_url,
                shipScore: result.ship_score,
                stackDetection: result.stack_detection,
                categories: result.categories,
                createdAt: result.created_at,
                scanDuration: result.scan_duration_ms
            }
        });
        
    } catch (error) {
        console.error('Error retrieving scan result:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recent scans
app.get('/api/scans/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const scans = getRecentScans(limit);
        
        res.json({
            success: true,
            data: scans.map(scan => ({
                id: scan.id,
                repoUrl: scan.repo_url,
                shipScore: scan.ship_score,
                createdAt: scan.created_at,
                scanDuration: scan.scan_duration_ms
            }))
        });
        
    } catch (error) {
        console.error('Error retrieving recent scans:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Scan repository
app.post('/api/scan', rateLimit, async (req, res) => {
    const scanStartTime = Date.now();
    let tempDir = null;

    try {
        const { repoUrl } = req.body;

        // Validate input
        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        if (!isValidGitHubUrl(repoUrl)) {
            return res.status(400).json({ error: 'Invalid GitHub URL format' });
        }

        // Generate unique scan ID
        const scanId = crypto.randomBytes(16).toString('hex');
        
        // Create temp directory
        tempDir = path.join(os.tmpdir(), `shovel-scan-${scanId}`);
        
        console.log(`Starting scan ${scanId} for ${repoUrl}`);

        // Clone repository
        cloneRepository(repoUrl, tempDir);

        // Run scanner with timeout
        const scanner = new ProjectScanner(tempDir);
        
        const scanPromise = scanner.scan();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Scan timeout')), 60000)
        );

        const scanResult = await Promise.race([scanPromise, timeoutPromise]);
        
        const scanDuration = Date.now() - scanStartTime;

        // Save to database
        saveScanResult(
            scanId, 
            repoUrl, 
            scanResult.shipScore, 
            scanResult.stackDetection, 
            scanResult.categories,
            scanDuration
        );

        console.log(`Scan ${scanId} completed in ${scanDuration}ms with score ${scanResult.shipScore}`);

        res.json({
            success: true,
            data: {
                id: scanId,
                repoUrl,
                shipScore: scanResult.shipScore,
                stackDetection: scanResult.stackDetection,
                categories: scanResult.categories,
                scanDuration
            }
        });

    } catch (error) {
        console.error('Scan error:', error);
        
        let statusCode = 500;
        let errorMessage = 'Internal server error';

        if (error.message.includes('Failed to clone')) {
            statusCode = 400;
            errorMessage = 'Could not access repository. It may be private, deleted, or the URL is incorrect.';
        } else if (error.message.includes('too large')) {
            statusCode = 400;
            errorMessage = 'Repository is too large (>100MB). Please try a smaller repository.';
        } else if (error.message.includes('timeout')) {
            statusCode = 408;
            errorMessage = 'Scan took too long to complete. Please try again or choose a smaller repository.';
        }

        res.status(statusCode).json({ error: errorMessage });
        
    } finally {
        // Always cleanup temp directory
        if (tempDir) {
            cleanupTempDir(tempDir);
        }
    }
});

// Add to waitlist
app.post('/api/waitlist', (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Add to waitlist
        addToWaitlist(email);
        
        const waitlistCount = getWaitlistCount();

        console.log(`Added ${email} to waitlist (total: ${waitlistCount})`);

        res.json({
            success: true,
            message: 'Successfully added to waitlist',
            waitlistCount
        });

    } catch (error) {
        console.error('Waitlist error:', error);
        
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already on waitlist' });
        }

        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve app page
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'index.html'));
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🪓 Shovel API server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/app`);
    console.log(`🏠 Landing page: http://localhost:${PORT}`);
    console.log(`💾 Waitlist count: ${getWaitlistCount()}`);
});
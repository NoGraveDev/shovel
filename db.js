const Database = require('better-sqlite3');
const path = require('path');

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'shovel.db'));

// Initialize tables
function initDatabase() {
    // Waitlist table
    db.exec(`
        CREATE TABLE IF NOT EXISTS waitlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Scan results table
    db.exec(`
        CREATE TABLE IF NOT EXISTS scan_results (
            id TEXT PRIMARY KEY,
            repo_url TEXT NOT NULL,
            ship_score INTEGER NOT NULL,
            stack_detection TEXT NOT NULL,
            categories TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            scan_duration_ms INTEGER
        )
    `);

    console.log('Database initialized successfully');
}

// Waitlist functions
function addToWaitlist(email) {
    const stmt = db.prepare('INSERT INTO waitlist (email) VALUES (?)');
    return stmt.run(email);
}

function getWaitlistCount() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM waitlist');
    return stmt.get().count;
}

// Scan result functions
function saveScanResult(scanId, repoUrl, shipScore, stackDetection, categories, scanDuration) {
    const stmt = db.prepare(`
        INSERT INTO scan_results 
        (id, repo_url, ship_score, stack_detection, categories, scan_duration_ms) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
        scanId, 
        repoUrl, 
        shipScore, 
        JSON.stringify(stackDetection), 
        JSON.stringify(categories),
        scanDuration
    );
}

function getScanResult(scanId) {
    const stmt = db.prepare('SELECT * FROM scan_results WHERE id = ?');
    const result = stmt.get(scanId);
    
    if (result) {
        return {
            ...result,
            stack_detection: JSON.parse(result.stack_detection),
            categories: JSON.parse(result.categories)
        };
    }
    return null;
}

function getRecentScans(limit = 10) {
    const stmt = db.prepare('SELECT * FROM scan_results ORDER BY created_at DESC LIMIT ?');
    const results = stmt.all(limit);
    
    return results.map(result => ({
        ...result,
        stack_detection: JSON.parse(result.stack_detection),
        categories: JSON.parse(result.categories)
    }));
}

// Initialize database on require
initDatabase();

module.exports = {
    addToWaitlist,
    getWaitlistCount,
    saveScanResult,
    getScanResult,
    getRecentScans
};
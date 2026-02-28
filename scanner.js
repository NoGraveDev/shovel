const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProjectScanner {
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.stackDetection = {};
        this.categories = [];
    }

    // Main scanning method
    async scan() {
        try {
            // Detect stack
            this.detectStack();
            
            // Score all categories
            this.scoreFrontend();
            this.scoreBackend();
            this.scoreAuthentication();
            this.scoreDatabase();
            this.scorePayments();
            this.scoreSecurity();
            this.scoreDeploymentReady();

            // Calculate overall Ship Score (weighted average)
            const shipScore = this.calculateShipScore();

            return {
                shipScore,
                stackDetection: this.stackDetection,
                categories: this.categories
            };
        } catch (error) {
            throw new Error(`Scan failed: ${error.message}`);
        }
    }

    // Stack detection
    detectStack() {
        const detectedTech = [];

        // Check for Node.js
        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            detectedTech.push('Node.js');

            if (packageJson.dependencies) {
                const deps = Object.keys(packageJson.dependencies);
                const devDeps = Object.keys(packageJson.devDependencies || {});
                const allDeps = [...deps, ...devDeps];

                // Framework detection
                if (allDeps.includes('next')) detectedTech.push('Next.js');
                if (allDeps.includes('react')) detectedTech.push('React');
                if (allDeps.includes('vue')) detectedTech.push('Vue.js');
                if (allDeps.includes('svelte')) detectedTech.push('Svelte');
                if (allDeps.includes('express')) detectedTech.push('Express');
                if (allDeps.includes('fastify')) detectedTech.push('Fastify');

                // Build tools
                if (allDeps.includes('vite')) detectedTech.push('Vite');
                if (allDeps.includes('webpack')) detectedTech.push('Webpack');

                // Styling
                if (allDeps.includes('tailwindcss')) detectedTech.push('Tailwind CSS');

                // TypeScript
                if (allDeps.includes('typescript') || this.fileExists('tsconfig.json')) {
                    detectedTech.push('TypeScript');
                }
            }
        }

        // Check for Python
        if (this.fileExists('requirements.txt') || this.fileExists('pyproject.toml')) {
            detectedTech.push('Python');
            
            const requirementsContent = this.fileExists('requirements.txt') 
                ? this.readFile('requirements.txt') 
                : '';
            
            if (requirementsContent.includes('django')) detectedTech.push('Django');
            if (requirementsContent.includes('flask')) detectedTech.push('Flask');
            if (requirementsContent.includes('fastapi')) detectedTech.push('FastAPI');
        }

        // Check for Docker
        if (this.fileExists('Dockerfile') || this.fileExists('docker-compose.yml')) {
            detectedTech.push('Docker');
        }

        // Check for static sites
        if (this.fileExists('index.html') && !detectedTech.includes('React') && !detectedTech.includes('Vue.js')) {
            detectedTech.push('Static HTML');
        }

        this.stackDetection = {
            technologies: detectedTech,
            hasPackageJson: this.fileExists('package.json'),
            hasDockerfile: this.fileExists('Dockerfile'),
            hasTypeScript: this.fileExists('tsconfig.json') || this.searchInFiles(['.ts', '.tsx']).length > 0,
            framework: this.detectFramework(),
            buildTool: this.detectBuildTool()
        };
    }

    detectFramework() {
        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            const deps = Object.keys(packageJson.dependencies || {});
            
            if (deps.includes('next')) return 'Next.js';
            if (deps.includes('react')) return 'React';
            if (deps.includes('vue')) return 'Vue.js';
            if (deps.includes('svelte')) return 'Svelte';
        }
        return 'None';
    }

    detectBuildTool() {
        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            const deps = Object.keys({...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})});
            
            if (deps.includes('vite')) return 'Vite';
            if (deps.includes('webpack')) return 'Webpack';
            if (packageJson.scripts && packageJson.scripts.build) return 'npm scripts';
        }
        return 'None';
    }

    // Category scoring methods
    scoreFrontend() {
        let score = 0;
        const findings = [];
        let status = 'critical';

        // Check for frontend framework
        if (this.stackDetection.framework !== 'None') {
            score += 40;
            findings.push(`${this.stackDetection.framework} framework detected`);
        } else if (this.fileExists('index.html')) {
            score += 20;
            findings.push('Static HTML frontend detected');
        } else {
            findings.push('No frontend files detected');
        }

        // Check for build configuration
        if (this.stackDetection.buildTool !== 'None') {
            score += 30;
            findings.push(`Build tool configured: ${this.stackDetection.buildTool}`);
        }

        // Check for styling
        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            const allDeps = Object.keys({...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})});
            
            if (allDeps.includes('tailwindcss') || this.searchInFiles(['.css']).length > 0) {
                score += 20;
                findings.push('Styling framework/CSS detected');
            }
        }

        // Check for responsive design patterns
        if (this.searchInContent('viewport') || this.searchInContent('responsive') || this.searchInContent('@media')) {
            score += 10;
            findings.push('Responsive design patterns found');
        }

        if (score >= 70) status = 'pass';
        else if (score >= 40) status = 'warning';

        this.categories.push({
            name: 'Frontend',
            score: Math.min(score, 100),
            status,
            findings,
            suggestion: score < 70 ? 'Add a modern frontend framework like React or Vue.js with proper build configuration' : 'Frontend looks good',
            fixAvailable: score < 70
        });
    }

    scoreBackend() {
        let score = 0;
        const findings = [];
        let status = 'critical';

        // Check for backend files
        const backendFiles = this.searchInFiles(['.js', '.ts', '.py'], ['server', 'app', 'main', 'index']);
        if (backendFiles.length > 0) {
            score += 30;
            findings.push('Backend entry points detected');
        }

        // Check for Express/Fastify/Flask patterns
        if (this.searchInContent('express()') || this.searchInContent('app.listen') || this.searchInContent('fastify()')) {
            score += 40;
            findings.push('Node.js server framework detected');
        } else if (this.searchInContent('Flask') || this.searchInContent('Django') || this.searchInContent('FastAPI')) {
            score += 40;
            findings.push('Python web framework detected');
        }

        // Check for API routes
        if (this.searchInContent('/api/') || this.searchInContent('app.get') || this.searchInContent('app.post') || this.searchInContent('@app.route')) {
            score += 30;
            findings.push('API routes detected');
        } else {
            findings.push('No API routes found');
        }

        if (score === 0) {
            findings.push('No backend detected');
        }

        if (score >= 70) status = 'pass';
        else if (score >= 30) status = 'warning';

        this.categories.push({
            name: 'Backend',
            score: Math.min(score, 100),
            status,
            findings,
            suggestion: score < 70 ? 'Add a backend server with API endpoints using Express.js or similar' : 'Backend implementation looks good',
            fixAvailable: score < 70
        });
    }

    scoreAuthentication() {
        let score = 0;
        const findings = [];
        let status = 'critical';

        // Check for auth libraries
        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            const allDeps = Object.keys({...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})});
            
            const authLibs = ['@clerk/nextjs', '@clerk/react', '@auth0/auth0-react', 'next-auth', 'firebase', '@supabase/auth-helpers', 'passport', 'jsonwebtoken', 'bcrypt'];
            const detectedAuth = authLibs.filter(lib => allDeps.includes(lib));
            
            if (detectedAuth.length > 0) {
                score += 60;
                findings.push(`Authentication library detected: ${detectedAuth.join(', ')}`);
            }
        }

        // Check for auth patterns in code
        if (this.searchInContent('login') && this.searchInContent('password')) {
            score += 20;
            findings.push('Login functionality detected');
        }

        if (this.searchInContent('jwt') || this.searchInContent('token') || this.searchInContent('session')) {
            score += 20;
            findings.push('Token/session management detected');
        }

        if (score === 0) {
            findings.push('No authentication system detected');
        }

        if (score >= 70) status = 'pass';
        else if (score >= 40) status = 'warning';

        this.categories.push({
            name: 'Authentication',
            score: Math.min(score, 100),
            status,
            findings,
            suggestion: score < 70 ? 'Add authentication with Clerk, Auth0, or NextAuth.js' : 'Authentication system in place',
            fixAvailable: score < 70
        });
    }

    scoreDatabase() {
        let score = 0;
        const findings = [];
        let status = 'critical';

        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            const allDeps = Object.keys({...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})});
            
            // Check for ORMs
            const orms = ['prisma', '@prisma/client', 'drizzle-orm', 'mongoose', 'typeorm', 'sequelize'];
            const detectedOrm = orms.filter(orm => allDeps.includes(orm));
            
            if (detectedOrm.length > 0) {
                score += 50;
                findings.push(`ORM detected: ${detectedOrm.join(', ')}`);
            }

            // Check for database clients
            const dbClients = ['@supabase/supabase-js', 'firebase', 'mongodb', 'mysql2', 'pg', 'sqlite3', 'better-sqlite3'];
            const detectedDb = dbClients.filter(client => allDeps.includes(client));
            
            if (detectedDb.length > 0) {
                score += 30;
                findings.push(`Database client detected: ${detectedDb.join(', ')}`);
            }
        }

        // Check for database files
        if (this.fileExists('prisma/schema.prisma') || this.fileExists('drizzle.config.js') || this.searchInFiles(['.sql']).length > 0) {
            score += 20;
            findings.push('Database schema files detected');
        }

        if (score === 0) {
            findings.push('No database integration detected');
        }

        if (score >= 70) status = 'pass';
        else if (score >= 30) status = 'warning';

        this.categories.push({
            name: 'Database',
            score: Math.min(score, 100),
            status,
            findings,
            suggestion: score < 70 ? 'Add database integration with Prisma, Supabase, or similar' : 'Database integration looks good',
            fixAvailable: score < 70
        });
    }

    scorePayments() {
        let score = 0;
        const findings = [];
        let status = 'critical';

        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            const allDeps = Object.keys({...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})});
            
            if (allDeps.includes('stripe') || allDeps.includes('@stripe/stripe-js')) {
                score = 100;
                findings.push('Stripe payment integration detected');
            } else if (allDeps.includes('@paddle/paddle-js')) {
                score = 100;
                findings.push('Paddle payment integration detected');
            } else if (allDeps.includes('@lemon-squeezy/lemon-squeezy-js')) {
                score = 100;
                findings.push('Lemon Squeezy payment integration detected');
            }
        }

        if (score === 0) {
            findings.push('No payment system detected');
            status = 'warning'; // Payments are optional for many projects
        } else {
            status = 'pass';
        }

        this.categories.push({
            name: 'Payments',
            score,
            status,
            findings,
            suggestion: score === 0 ? 'Consider adding payment processing with Stripe for monetization' : 'Payment system integrated',
            fixAvailable: score === 0
        });
    }

    scoreSecurity() {
        let score = 100; // Start with perfect score, deduct for issues
        const findings = [];
        let status = 'pass';

        // Check for committed .env files (CRITICAL)
        if (this.fileExists('.env') || this.fileExists('.env.local') || this.fileExists('.env.production')) {
            score -= 50;
            findings.push('CRITICAL: .env file committed to repository');
            status = 'critical';
        }

        // Check for hardcoded API keys
        const apiKeyPatterns = [
            /sk_[a-zA-Z0-9]{24,}/g,  // Stripe secret keys
            /pk_[a-zA-Z0-9]{24,}/g,  // Stripe publishable keys
            /ghp_[a-zA-Z0-9]{36}/g,  // GitHub personal access tokens
            /AKIA[A-Z0-9]{16}/g,     // AWS access keys
            /[a-zA-Z0-9]{32,}/g      // Generic long strings (potential API keys)
        ];

        const allFiles = this.getAllFiles(['.js', '.ts', '.jsx', '.tsx', '.py', '.env.example']);
        for (const file of allFiles) {
            const content = this.readFile(file);
            for (const pattern of apiKeyPatterns) {
                if (pattern.test(content) && !file.includes('.env.example')) {
                    score -= 30;
                    findings.push(`Potential hardcoded API key found in ${file}`);
                    status = 'critical';
                }
            }
        }

        // Check for .gitignore
        if (!this.fileExists('.gitignore')) {
            score -= 20;
            findings.push('No .gitignore file found');
            status = status === 'pass' ? 'warning' : status;
        } else {
            const gitignoreContent = this.readFile('.gitignore');
            if (!gitignoreContent.includes('.env') && !gitignoreContent.includes('*.env')) {
                score -= 15;
                findings.push('.env files not ignored in .gitignore');
                status = status === 'pass' ? 'warning' : status;
            }
        }

        // Check for security headers/CORS
        if (this.searchInContent('cors') || this.searchInContent('helmet')) {
            score += 0; // Good, but don't add points since we started at 100
            findings.push('Security middleware (CORS/Helmet) detected');
        }

        score = Math.max(0, score); // Don't go below 0

        if (score >= 80 && status !== 'critical') status = 'pass';
        else if (score >= 50 && status !== 'critical') status = 'warning';

        this.categories.push({
            name: 'Security',
            score,
            status,
            findings,
            suggestion: score < 80 ? 'Review security practices: avoid committing secrets, add .gitignore, use environment variables' : 'Security practices look good',
            fixAvailable: score < 80
        });
    }

    scoreDeploymentReady() {
        let score = 0;
        const findings = [];
        let status = 'critical';

        // Check for build script
        if (this.fileExists('package.json')) {
            const packageJson = this.readJsonFile('package.json');
            
            if (packageJson.scripts && packageJson.scripts.build) {
                score += 25;
                findings.push('Build script configured');
            }

            if (packageJson.scripts && packageJson.scripts.start) {
                score += 25;
                findings.push('Start script configured');
            }

            // Check for PORT environment variable handling
            if (this.searchInContent('process.env.PORT')) {
                score += 20;
                findings.push('PORT environment variable handling detected');
            }
        }

        // Check for Docker
        if (this.fileExists('Dockerfile')) {
            score += 30;
            findings.push('Dockerfile present');
        }

        // Check for deployment configs
        if (this.fileExists('vercel.json') || this.fileExists('netlify.toml') || this.fileExists('.railway.json')) {
            score += 0; // Don't add extra points, but note it
            findings.push('Deployment configuration file detected');
        }

        if (score === 0) {
            findings.push('No deployment configuration detected');
        }

        if (score >= 70) status = 'pass';
        else if (score >= 40) status = 'warning';

        this.categories.push({
            name: 'Deployment Ready',
            score: Math.min(score, 100),
            status,
            findings,
            suggestion: score < 70 ? 'Add build/start scripts and environment variable handling for deployment' : 'Ready for deployment',
            fixAvailable: score < 70
        });
    }

    // Calculate weighted Ship Score
    calculateShipScore() {
        const weights = {
            'Frontend': 0.20,
            'Backend': 0.15,
            'Authentication': 0.15,
            'Database': 0.15,
            'Payments': 0.10,
            'Security': 0.10,
            'Deployment Ready': 0.15
        };

        let totalScore = 0;
        for (const category of this.categories) {
            totalScore += category.score * (weights[category.name] || 0);
        }

        return Math.round(totalScore);
    }

    // Helper methods
    fileExists(relativePath) {
        try {
            return fs.existsSync(path.join(this.projectPath, relativePath));
        } catch {
            return false;
        }
    }

    readFile(relativePath) {
        try {
            return fs.readFileSync(path.join(this.projectPath, relativePath), 'utf-8');
        } catch {
            return '';
        }
    }

    readJsonFile(relativePath) {
        try {
            const content = this.readFile(relativePath);
            return JSON.parse(content);
        } catch {
            return {};
        }
    }

    searchInFiles(extensions, namePatterns = []) {
        const files = [];
        
        const searchDir = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(this.projectPath, fullPath);
                    
                    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        searchDir(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (extensions.includes(ext)) {
                            if (namePatterns.length === 0 || namePatterns.some(pattern => entry.name.includes(pattern))) {
                                files.push(relativePath);
                            }
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };

        searchDir(this.projectPath);
        return files;
    }

    getAllFiles(extensions) {
        return this.searchInFiles(extensions);
    }

    searchInContent(searchTerm) {
        try {
            const files = this.getAllFiles(['.js', '.ts', '.jsx', '.tsx', '.py', '.html', '.json']);
            for (const file of files.slice(0, 50)) { // Limit to prevent timeout
                const content = this.readFile(file);
                if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }
}

module.exports = ProjectScanner;
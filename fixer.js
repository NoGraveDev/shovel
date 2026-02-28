// Added by Shovel 🪓
const fs = require('fs');
const path = require('path');

class ProjectFixer {
    constructor(projectPath, scanResult) {
        this.projectPath = projectPath;
        this.scanResult = scanResult;
        this.filesModified = [];
        this.filesCreated = [];
        this.isTypeScript = this.detectTypeScript();
    }

    // Detect if project uses TypeScript
    detectTypeScript() {
        const tsConfigPath = path.join(this.projectPath, 'tsconfig.json');
        return fs.existsSync(tsConfigPath);
    }

    // Apply all requested fixes
    async applyFixes(fixes) {
        const results = { modified: [], created: [], errors: [] };

        try {
            for (const fix of fixes) {
                switch (fix) {
                    case 'security':
                        await this.applySecurity();
                        break;
                    case 'auth':
                        await this.applyAuth();
                        break;
                    case 'payments':
                        await this.applyPayments();
                        break;
                    case 'deployment':
                        await this.applyDeployment();
                        break;
                    default:
                        results.errors.push(`Unknown fix type: ${fix}`);
                }
            }

            results.modified = [...this.filesModified];
            results.created = [...this.filesCreated];
        } catch (error) {
            results.errors.push(error.message);
        }

        return results;
    }

    // Security fixes - gitignore, env vars
    async applySecurity() {
        await this.fixGitignore();
        await this.fixEnvVars();
    }

    // Fix gitignore and remove .env if committed
    async fixGitignore() {
        const gitignorePath = path.join(this.projectPath, '.gitignore');
        const envPath = path.join(this.projectPath, '.env');
        
        // Check if .env exists and is committed
        if (fs.existsSync(envPath)) {
            // Move .env to .env.example if it's not too large and contains secrets
            const envContent = fs.readFileSync(envPath, 'utf8');
            if (envContent.length < 10000 && this.containsSecrets(envContent)) {
                const exampleContent = this.createEnvExample(envContent);
                fs.writeFileSync(path.join(this.projectPath, '.env.example'), exampleContent);
                fs.unlinkSync(envPath);
                this.filesModified.push('.env.example');
            }
        }

        // Create/update gitignore
        let gitignoreContent = '';
        if (fs.existsSync(gitignorePath)) {
            gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        }

        const stack = this.scanResult.stackDetection;
        const gitignoreTemplate = this.generateGitignoreTemplate(stack);
        
        // Only add if not already present
        const linesToAdd = gitignoreTemplate.split('\n').filter(line => 
            line.trim() && !gitignoreContent.includes(line.trim())
        );

        if (linesToAdd.length > 0) {
            if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
                gitignoreContent += '\n';
            }
            gitignoreContent += '\n# Added by Shovel 🪓\n' + linesToAdd.join('\n') + '\n';
            fs.writeFileSync(gitignorePath, gitignoreContent);
            
            if (!fs.existsSync(gitignorePath)) {
                this.filesCreated.push('.gitignore');
            } else {
                this.filesModified.push('.gitignore');
            }
        }
    }

    // Check if content contains secrets
    containsSecrets(content) {
        const secretPatterns = [
            /api[_-]?key/i,
            /secret/i,
            /password/i,
            /token/i,
            /private[_-]?key/i
        ];
        return secretPatterns.some(pattern => pattern.test(content));
    }

    // Create .env.example from .env
    createEnvExample(envContent) {
        return '# Added by Shovel 🪓\n' + 
               envContent
                   .split('\n')
                   .map(line => {
                       if (line.trim() && !line.startsWith('#')) {
                           const [key] = line.split('=');
                           return `${key}=your_${key.toLowerCase().replace(/[^a-z0-9]/g, '_')}_here`;
                       }
                       return line;
                   })
                   .join('\n');
    }

    // Generate gitignore template based on stack
    generateGitignoreTemplate(stack) {
        const common = [
            '.env',
            '.env.local',
            '.env.production',
            'node_modules/',
            '*.log',
            '.DS_Store'
        ];

        if (stack.frontend?.framework === 'Next.js') {
            return [...common, '.next/', 'out/', '.vercel/'].join('\n');
        }

        if (stack.frontend?.bundler === 'Vite') {
            return [...common, 'dist/', '.vite/'].join('\n');
        }

        if (stack.backend?.language === 'Python') {
            return [...common, '__pycache__/', '*.pyc', '.pytest_cache/', 'venv/', '.venv/'].join('\n');
        }

        return common.join('\n');
    }

    // Fix environment variables
    async fixEnvVars() {
        const files = this.findFilesWithHardcodedKeys();
        for (const file of files) {
            this.replaceHardcodedKeys(file);
        }
    }

    // Find files with hardcoded API keys
    findFilesWithHardcodedKeys() {
        const files = [];
        const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py'];
        
        const searchDir = (dir) => {
            if (path.basename(dir) === 'node_modules' || path.basename(dir) === '.git') return;
            
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    searchDir(itemPath);
                } else if (extensions.some(ext => item.endsWith(ext))) {
                    const content = fs.readFileSync(itemPath, 'utf8');
                    if (this.hasHardcodedKeys(content)) {
                        files.push(itemPath);
                    }
                }
            }
        };

        searchDir(this.projectPath);
        return files;
    }

    // Check if file has hardcoded keys
    hasHardcodedKeys(content) {
        const patterns = [
            /["']sk_[a-z]+_[A-Za-z0-9]{20,}["']/,  // Stripe keys
            /["']pk_[a-z]+_[A-Za-z0-9]{20,}["']/,  // Stripe public keys
            /["'][A-Za-z0-9]{32,}["']/             // Generic long keys
        ];
        return patterns.some(pattern => pattern.test(content));
    }

    // Replace hardcoded keys with env vars
    replaceHardcodedKeys(filePath) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Replace Stripe keys
        content = content.replace(/["'](sk_[a-z]+_[A-Za-z0-9]+)["']/g, (match, key) => {
            modified = true;
            return 'process.env.STRIPE_SECRET_KEY';
        });

        content = content.replace(/["'](pk_[a-z]+_[A-Za-z0-9]+)["']/g, (match, key) => {
            modified = true;
            return 'process.env.STRIPE_PUBLISHABLE_KEY';
        });

        if (modified) {
            fs.writeFileSync(filePath, content);
            this.filesModified.push(path.relative(this.projectPath, filePath));
        }
    }

    // Apply authentication fixes
    async applyAuth() {
        const stack = this.scanResult.stackDetection;
        
        if (stack.frontend?.framework === 'Next.js') {
            await this.applyNextJSAuth();
        } else if (stack.frontend?.bundler === 'Vite' || stack.frontend?.bundler === 'Create React App') {
            await this.applyReactAuth();
        }
    }

    // Apply Next.js authentication with Clerk
    async applyNextJSAuth() {
        // Check if already has auth
        if (this.hasClerkAuth()) return;

        const isAppRouter = this.isNextJSAppRouter();
        
        // Update package.json
        this.addDependencies({ '@clerk/nextjs': '^4.29.1' });

        if (isAppRouter) {
            await this.createAppRouterAuth();
        } else {
            await this.createPagesRouterAuth();
        }

        // Create environment variables
        this.addEnvVars({
            'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': 'your_clerk_publishable_key_here',
            'CLERK_SECRET_KEY': 'your_clerk_secret_key_here',
            'NEXT_PUBLIC_CLERK_SIGN_IN_URL': '/sign-in',
            'NEXT_PUBLIC_CLERK_SIGN_UP_URL': '/sign-up'
        });
    }

    // Check if Clerk is already installed
    hasClerkAuth() {
        const packageJson = this.getPackageJson();
        return packageJson.dependencies && (
            packageJson.dependencies['@clerk/nextjs'] || 
            packageJson.dependencies['@clerk/clerk-react']
        );
    }

    // Check if Next.js uses App Router
    isNextJSAppRouter() {
        return fs.existsSync(path.join(this.projectPath, 'app'));
    }

    // Create App Router auth files
    async createAppRouterAuth() {
        // Create middleware.ts
        const middlewareContent = this.isTypeScript ? `// Added by Shovel 🪓
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)'
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
` : `// Added by Shovel 🪓
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)'
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
`;

        fs.writeFileSync(
            path.join(this.projectPath, `middleware.${this.isTypeScript ? 'ts' : 'js'}`),
            middlewareContent
        );
        this.filesCreated.push(`middleware.${this.isTypeScript ? 'ts' : 'js'}`);

        // Update layout
        await this.wrapWithClerkProvider('app/layout');

        // Create sign-in page
        const signInDir = path.join(this.projectPath, 'app/sign-in/[[...sign-in]]');
        fs.mkdirSync(signInDir, { recursive: true });
        
        const signInContent = this.isTypeScript ? `// Added by Shovel 🪓
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
` : `// Added by Shovel 🪓
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
`;

        fs.writeFileSync(
            path.join(signInDir, `page.${this.isTypeScript ? 'tsx' : 'jsx'}`),
            signInContent
        );
        this.filesCreated.push(`app/sign-in/[[...sign-in]]/page.${this.isTypeScript ? 'tsx' : 'jsx'}`);

        // Create sign-up page
        const signUpDir = path.join(this.projectPath, 'app/sign-up/[[...sign-up]]');
        fs.mkdirSync(signUpDir, { recursive: true });
        
        const signUpContent = signInContent.replace(/SignIn/g, 'SignUp').replace(/sign-in/g, 'sign-up');
        fs.writeFileSync(
            path.join(signUpDir, `page.${this.isTypeScript ? 'tsx' : 'jsx'}`),
            signUpContent
        );
        this.filesCreated.push(`app/sign-up/[[...sign-up]]/page.${this.isTypeScript ? 'tsx' : 'jsx'}`);
    }

    // Create Pages Router auth files
    async createPagesRouterAuth() {
        // Update _app
        await this.wrapWithClerkProvider('pages/_app');

        // Create sign-in page
        const signInDir = path.join(this.projectPath, 'pages/sign-in');
        fs.mkdirSync(signInDir, { recursive: true });
        
        const signInContent = this.isTypeScript ? `// Added by Shovel 🪓
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
` : `// Added by Shovel 🪓
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
`;

        fs.writeFileSync(
            path.join(signInDir, `[[...index]].${this.isTypeScript ? 'tsx' : 'jsx'}`),
            signInContent
        );
        this.filesCreated.push(`pages/sign-in/[[...index]].${this.isTypeScript ? 'tsx' : 'jsx'}`);

        // Create sign-up page
        const signUpDir = path.join(this.projectPath, 'pages/sign-up');
        fs.mkdirSync(signUpDir, { recursive: true });
        
        const signUpContent = signInContent.replace(/SignIn/g, 'SignUp').replace(/sign-in/g, 'sign-up');
        fs.writeFileSync(
            path.join(signUpDir, `[[...index]].${this.isTypeScript ? 'tsx' : 'jsx'}`),
            signUpContent
        );
        this.filesCreated.push(`pages/sign-up/[[...index]].${this.isTypeScript ? 'tsx' : 'jsx'}`);
    }

    // Apply React/Vite authentication
    async applyReactAuth() {
        if (this.hasClerkAuth()) return;

        // Update package.json
        this.addDependencies({ '@clerk/clerk-react': '^4.29.1' });

        // Wrap main app component
        await this.wrapWithClerkProvider('src/App');

        // Create Auth component
        const authDir = path.join(this.projectPath, 'src/components');
        fs.mkdirSync(authDir, { recursive: true });

        const authContent = `// Added by Shovel 🪓
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';
import { useState } from 'react';

export default function Auth() {
  const { isSignedIn } = useAuth();
  const [mode, setMode] = useState('sign-in');

  if (isSignedIn) {
    return null; // User is signed in
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        {mode === 'sign-in' ? <SignIn /> : <SignUp />}
        <div className="mt-4 text-center">
          <button 
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="text-blue-600 hover:underline"
          >
            {mode === 'sign-in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

        fs.writeFileSync(path.join(authDir, 'Auth.jsx'), authContent);
        this.filesCreated.push('src/components/Auth.jsx');

        // Add environment variable
        this.addEnvVars({
            'VITE_CLERK_PUBLISHABLE_KEY': 'your_clerk_publishable_key_here'
        });
    }

    // Wrap component with ClerkProvider
    async wrapWithClerkProvider(filePath) {
        const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js'];
        let actualFilePath = null;
        
        for (const ext of possibleExtensions) {
            const testPath = path.join(this.projectPath, filePath + ext);
            if (fs.existsSync(testPath)) {
                actualFilePath = testPath;
                break;
            }
        }

        if (!actualFilePath) return;

        let content = fs.readFileSync(actualFilePath, 'utf8');
        
        // Check if already wrapped
        if (content.includes('ClerkProvider')) return;

        // Add import
        const importLine = 'import { ClerkProvider } from \'@clerk/nextjs\';';
        if (!content.includes(importLine)) {
            content = importLine + '\n' + content;
        }

        // Wrap the default export
        content = content.replace(
            /export default function (\w+)\s*\([^)]*\)\s*\{/,
            (match, funcName) => {
                return `export default function ${funcName}({ children, ...props }) {
  return (
    <ClerkProvider>`;
            }
        );

        // Close ClerkProvider
        content = content.replace(/}\s*$/, '    </ClerkProvider>\n  );\n}');

        fs.writeFileSync(actualFilePath, content);
        this.filesModified.push(path.relative(this.projectPath, actualFilePath));
    }

    // Apply payments fixes
    async applyPayments() {
        const stack = this.scanResult.stackDetection;
        
        if (stack.frontend?.framework === 'Next.js') {
            await this.applyNextJSPayments();
        } else if (stack.frontend?.bundler === 'Vite' || stack.frontend?.bundler === 'Create React App') {
            await this.applyReactPayments();
        }
    }

    // Apply Next.js Stripe payments
    async applyNextJSPayments() {
        // Check if already has Stripe
        const packageJson = this.getPackageJson();
        if (packageJson.dependencies && packageJson.dependencies['stripe']) return;

        // Add dependencies
        this.addDependencies({
            'stripe': '^14.9.0',
            '@stripe/stripe-js': '^2.4.0'
        });

        const isAppRouter = this.isNextJSAppRouter();

        // Create Stripe lib
        await this.createStripeLib();

        // Create API routes
        if (isAppRouter) {
            await this.createAppRouterStripeAPI();
        } else {
            await this.createPagesRouterStripeAPI();
        }

        // Create pricing page
        await this.createPricingPage();

        // Add environment variables
        this.addEnvVars({
            'STRIPE_SECRET_KEY': 'sk_test_your_stripe_secret_key_here',
            'STRIPE_PUBLISHABLE_KEY': 'pk_test_your_stripe_publishable_key_here',
            'STRIPE_WEBHOOK_SECRET': 'whsec_your_stripe_webhook_secret_here'
        });
    }

    // Create Stripe library
    async createStripeLib() {
        const libDir = path.join(this.projectPath, 'src/lib');
        fs.mkdirSync(libDir, { recursive: true });

        const stripeLibContent = this.isTypeScript ? `// Added by Shovel 🪓
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const getStripe = () => {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Missing Stripe publishable key');
  }
  
  return import('@stripe/stripe-js').then(({ loadStripe }) => 
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  );
};
` : `// Added by Shovel 🪓
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const getStripe = () => {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Missing Stripe publishable key');
  }
  
  return import('@stripe/stripe-js').then(({ loadStripe }) => 
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  );
};
`;

        fs.writeFileSync(
            path.join(libDir, `stripe.${this.isTypeScript ? 'ts' : 'js'}`),
            stripeLibContent
        );
        this.filesCreated.push(`src/lib/stripe.${this.isTypeScript ? 'ts' : 'js'}`);
    }

    // Create App Router Stripe API routes
    async createAppRouterStripeAPI() {
        // Create checkout API route
        const checkoutDir = path.join(this.projectPath, 'app/api/checkout');
        fs.mkdirSync(checkoutDir, { recursive: true });

        const checkoutContent = this.isTypeScript ? `// Added by Shovel 🪓
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/src/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: \`\${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: \`\${req.headers.get('origin')}/pricing\`,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
` : `// Added by Shovel 🪓
import { NextResponse } from 'next/server';
import { stripe } from '@/src/lib/stripe';

export async function POST(req) {
  try {
    const { priceId } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: \`\${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: \`\${req.headers.get('origin')}/pricing\`,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
`;

        fs.writeFileSync(
            path.join(checkoutDir, `route.${this.isTypeScript ? 'ts' : 'js'}`),
            checkoutContent
        );
        this.filesCreated.push(`app/api/checkout/route.${this.isTypeScript ? 'ts' : 'js'}`);

        // Create webhook API route
        const webhookDir = path.join(this.projectPath, 'app/api/webhooks/stripe');
        fs.mkdirSync(webhookDir, { recursive: true });

        const webhookContent = `// Added by Shovel 🪓
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/src/lib/stripe';

export async function POST(req${this.isTypeScript ? ': NextRequest' : ''}) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')${this.isTypeScript ? '!' : ''};

  let event${this.isTypeScript ? ': any' : ''};

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET${this.isTypeScript ? '!' : ''}
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment successful:', session);
      // Handle successful payment
      break;
    case 'customer.subscription.created':
      console.log('Subscription created:', event.data.object);
      break;
    case 'customer.subscription.updated':
      console.log('Subscription updated:', event.data.object);
      break;
    case 'customer.subscription.deleted':
      console.log('Subscription canceled:', event.data.object);
      break;
    default:
      console.log(\`Unhandled event type \${event.type}\`);
  }

  return NextResponse.json({ received: true });
}
`;

        fs.writeFileSync(
            path.join(webhookDir, `route.${this.isTypeScript ? 'ts' : 'js'}`),
            webhookContent
        );
        this.filesCreated.push(`app/api/webhooks/stripe/route.${this.isTypeScript ? 'ts' : 'js'}`);
    }

    // Create Pages Router Stripe API routes
    async createPagesRouterStripeAPI() {
        const apiDir = path.join(this.projectPath, 'pages/api');
        fs.mkdirSync(apiDir, { recursive: true });

        // Checkout API
        const checkoutContent = `// Added by Shovel 🪓
import { stripe } from '@/src/lib/stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: \`\${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: \`\${req.headers.origin}/pricing\`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
`;

        fs.writeFileSync(
            path.join(apiDir, `checkout.${this.isTypeScript ? 'ts' : 'js'}`),
            checkoutContent
        );
        this.filesCreated.push(`pages/api/checkout.${this.isTypeScript ? 'ts' : 'js'}`);

        // Webhook API
        const webhookContent = `// Added by Shovel 🪓
import { stripe } from '@/src/lib/stripe';
import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment successful:', session);
      break;
    default:
      console.log(\`Unhandled event type \${event.type}\`);
  }

  res.json({ received: true });
}
`;

        fs.writeFileSync(
            path.join(apiDir, `webhooks.${this.isTypeScript ? 'ts' : 'js'}`),
            webhookContent
        );
        this.filesCreated.push(`pages/api/webhooks.${this.isTypeScript ? 'ts' : 'js'}`);
    }

    // Create pricing page component
    async createPricingPage() {
        const componentsDir = path.join(this.projectPath, 'src/components');
        fs.mkdirSync(componentsDir, { recursive: true });

        const pricingContent = this.isTypeScript ? `// Added by Shovel 🪓
'use client';

import { useState } from 'react';
import { getStripe } from '@/src/lib/stripe';

interface PricingTier {
  name: string;
  price: string;
  priceId: string;
  features: string[];
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: '$9',
    priceId: 'price_starter', // Replace with your actual Stripe price ID
    features: ['Basic features', '10 projects', 'Email support']
  },
  {
    name: 'Pro',
    price: '$29',
    priceId: 'price_pro', // Replace with your actual Stripe price ID
    features: ['All Starter features', 'Unlimited projects', 'Priority support', 'Advanced analytics']
  },
  {
    name: 'Enterprise',
    price: '$99',
    priceId: 'price_enterprise', // Replace with your actual Stripe price ID
    features: ['All Pro features', 'Custom integrations', 'Dedicated support', 'SLA']
  }
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    setLoading(priceId);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const { sessionId } = await response.json();
      const stripe = await getStripe();
      
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h2>
          <p className="mt-4 text-lg text-gray-600">Choose the plan that's right for you</p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6">
          {pricingTiers.map((tier) => (
            <div key={tier.name} className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">{tier.name}</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                <span className="text-gray-600">/month</span>
              </p>
              
              <ul className="mt-6 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(tier.priceId)}
                disabled={loading === tier.priceId}
                className="mt-8 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === tier.priceId ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
` : `// Added by Shovel 🪓
'use client';

import { useState } from 'react';
import { getStripe } from '@/src/lib/stripe';

const pricingTiers = [
  {
    name: 'Starter',
    price: '$9',
    priceId: 'price_starter', // Replace with your actual Stripe price ID
    features: ['Basic features', '10 projects', 'Email support']
  },
  {
    name: 'Pro',
    price: '$29',
    priceId: 'price_pro', // Replace with your actual Stripe price ID
    features: ['All Starter features', 'Unlimited projects', 'Priority support', 'Advanced analytics']
  },
  {
    name: 'Enterprise',
    price: '$99',
    priceId: 'price_enterprise', // Replace with your actual Stripe price ID
    features: ['All Pro features', 'Custom integrations', 'Dedicated support', 'SLA']
  }
];

export default function PricingPage() {
  const [loading, setLoading] = useState(null);

  const handleCheckout = async (priceId) => {
    setLoading(priceId);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const { sessionId } = await response.json();
      const stripe = await getStripe();
      
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h2>
          <p className="mt-4 text-lg text-gray-600">Choose the plan that's right for you</p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6">
          {pricingTiers.map((tier) => (
            <div key={tier.name} className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">{tier.name}</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                <span className="text-gray-600">/month</span>
              </p>
              
              <ul className="mt-6 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(tier.priceId)}
                disabled={loading === tier.priceId}
                className="mt-8 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === tier.priceId ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

        fs.writeFileSync(
            path.join(componentsDir, `PricingPage.${this.isTypeScript ? 'tsx' : 'jsx'}`),
            pricingContent
        );
        this.filesCreated.push(`src/components/PricingPage.${this.isTypeScript ? 'tsx' : 'jsx'}`);
    }

    // Apply React/Vite payments
    async applyReactPayments() {
        const packageJson = this.getPackageJson();
        if (packageJson.dependencies && packageJson.dependencies['@stripe/stripe-js']) return;

        // Add dependencies
        this.addDependencies({
            '@stripe/stripe-js': '^2.4.0',
            '@stripe/react-stripe-js': '^2.4.0'
        });

        // Create Stripe lib
        const libDir = path.join(this.projectPath, 'src/lib');
        fs.mkdirSync(libDir, { recursive: true });

        const stripeLibContent = `// Added by Shovel 🪓
import { loadStripe } from '@stripe/stripe-js';

export const getStripe = () => {
  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Missing Stripe publishable key');
  }
  
  return loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
};
`;

        fs.writeFileSync(path.join(libDir, 'stripe.js'), stripeLibContent);
        this.filesCreated.push('src/lib/stripe.js');

        // Create pricing component (Note: needs backend)
        const componentsDir = path.join(this.projectPath, 'src/components');
        fs.mkdirSync(componentsDir, { recursive: true });

        const pricingContent = `// Added by Shovel 🪓
// NOTE: This component requires a backend server to create Stripe checkout sessions.
// You'll need to implement /api/checkout endpoint on your backend.

import { useState } from 'react';
import { getStripe } from '../lib/stripe';

const pricingTiers = [
  {
    name: 'Starter',
    price: '$9',
    priceId: 'price_starter', // Replace with your actual Stripe price ID
    features: ['Basic features', '10 projects', 'Email support']
  },
  {
    name: 'Pro',
    price: '$29',
    priceId: 'price_pro', // Replace with your actual Stripe price ID
    features: ['All Starter features', 'Unlimited projects', 'Priority support']
  }
];

export default function PricingPage() {
  const [loading, setLoading] = useState(null);

  const handleCheckout = async (priceId) => {
    setLoading(priceId);

    try {
      // TODO: Implement your backend endpoint that creates Stripe checkout sessions
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const { sessionId } = await response.json();
      const stripe = await getStripe();
      
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Pricing</h2>
          <p className="mt-4 text-gray-600">Choose the plan that's right for you</p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          {pricingTiers.map((tier) => (
            <div key={tier.name} className="border rounded-lg p-6">
              <h3 className="text-lg font-medium">{tier.name}</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-gray-600">/month</span>
              </p>
              
              <ul className="mt-6 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <span className="mr-2">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(tier.priceId)}
                disabled={loading === tier.priceId}
                className="mt-8 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === tier.priceId ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

        fs.writeFileSync(path.join(componentsDir, 'PricingPage.jsx'), pricingContent);
        this.filesCreated.push('src/components/PricingPage.jsx');

        // Add environment variable
        this.addEnvVars({
            'VITE_STRIPE_PUBLISHABLE_KEY': 'pk_test_your_stripe_publishable_key_here'
        });
    }

    // Apply deployment fixes
    async applyDeployment() {
        const stack = this.scanResult.stackDetection;
        
        if (stack.frontend?.framework === 'Next.js') {
            await this.applyNextJSDeployment();
        } else if (stack.frontend?.bundler === 'Vite') {
            await this.applyViteDeployment();
        } else if (stack.backend?.language === 'Python') {
            await this.applyPythonDeployment();
        }
    }

    // Apply Next.js deployment config
    async applyNextJSDeployment() {
        // Create next.config.js
        const nextConfigPath = path.join(this.projectPath, 'next.config.js');
        if (!fs.existsSync(nextConfigPath)) {
            const nextConfigContent = `// Added by Shovel 🪓
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: process.cwd(),
  },
};

module.exports = nextConfig;
`;
            fs.writeFileSync(nextConfigPath, nextConfigContent);
            this.filesCreated.push('next.config.js');
        }

        // Ensure build and start scripts
        this.ensurePackageJsonScripts({
            'build': 'next build',
            'start': 'next start'
        });

        // Create Dockerfile
        await this.createNextJSDockerfile();

        // Create .dockerignore
        await this.createDockerignore();

        // Create railway.json
        await this.createRailwayConfig();
    }

    // Apply Vite deployment config
    async applyViteDeployment() {
        // Ensure build script
        this.ensurePackageJsonScripts({
            'build': 'vite build'
        });

        // Create netlify.toml
        const netlifyConfigPath = path.join(this.projectPath, 'netlify.toml');
        if (!fs.existsSync(netlifyConfigPath)) {
            const netlifyConfigContent = `# Added by Shovel 🪓
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
            fs.writeFileSync(netlifyConfigPath, netlifyConfigContent);
            this.filesCreated.push('netlify.toml');
        }

        // Create _redirects for SPA routing
        const redirectsPath = path.join(this.projectPath, 'public/_redirects');
        if (!fs.existsSync(redirectsPath)) {
            const publicDir = path.join(this.projectPath, 'public');
            fs.mkdirSync(publicDir, { recursive: true });
            
            fs.writeFileSync(redirectsPath, '# Added by Shovel 🪓\n/* /index.html 200\n');
            this.filesCreated.push('public/_redirects');
        }

        // Create Dockerfile for static hosting
        await this.createViteDockerfile();
    }

    // Apply Python deployment config
    async applyPythonDeployment() {
        // Ensure requirements.txt exists
        const requirementsPath = path.join(this.projectPath, 'requirements.txt');
        if (!fs.existsSync(requirementsPath)) {
            const requirementsContent = `# Added by Shovel 🪓
flask>=2.0.0
gunicorn>=20.0.0
`;
            fs.writeFileSync(requirementsPath, requirementsContent);
            this.filesCreated.push('requirements.txt');
        }

        // Create Procfile
        const procfilePath = path.join(this.projectPath, 'Procfile');
        if (!fs.existsSync(procfilePath)) {
            fs.writeFileSync(procfilePath, '# Added by Shovel 🪓\nweb: gunicorn app:app\n');
            this.filesCreated.push('Procfile');
        }

        // Create Dockerfile
        await this.createPythonDockerfile();

        // Create railway.json
        await this.createRailwayConfig();
    }

    // Create Next.js Dockerfile
    async createNextJSDockerfile() {
        const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
        if (fs.existsSync(dockerfilePath)) return;

        const dockerfileContent = `# Added by Shovel 🪓
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN \\
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then npm ci; \\
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \\
  else echo "Lockfile not found." && exit 1; \\
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
`;
        fs.writeFileSync(dockerfilePath, dockerfileContent);
        this.filesCreated.push('Dockerfile');
    }

    // Create Vite Dockerfile
    async createViteDockerfile() {
        const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
        if (fs.existsSync(dockerfilePath)) return;

        const dockerfileContent = `# Added by Shovel 🪓
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/public/_redirects /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
        fs.writeFileSync(dockerfilePath, dockerfileContent);
        this.filesCreated.push('Dockerfile');
    }

    // Create Python Dockerfile
    async createPythonDockerfile() {
        const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
        if (fs.existsSync(dockerfilePath)) return;

        const dockerfileContent = `# Added by Shovel 🪓
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
`;
        fs.writeFileSync(dockerfilePath, dockerfileContent);
        this.filesCreated.push('Dockerfile');
    }

    // Create .dockerignore
    async createDockerignore() {
        const dockerignorePath = path.join(this.projectPath, '.dockerignore');
        if (fs.existsSync(dockerignorePath)) return;

        const dockerignoreContent = `# Added by Shovel 🪓
node_modules
.next
.git
.gitignore
README.md
.env
.env.local
.env.production
.env.staging
.vercel
.DS_Store
`;
        fs.writeFileSync(dockerignorePath, dockerignoreContent);
        this.filesCreated.push('.dockerignore');
    }

    // Create railway.json
    async createRailwayConfig() {
        const railwayConfigPath = path.join(this.projectPath, 'railway.json');
        if (fs.existsSync(railwayConfigPath)) return;

        const stack = this.scanResult.stackDetection;
        let buildCommand = 'npm run build';
        let startCommand = 'npm start';

        if (stack.backend?.language === 'Python') {
            buildCommand = 'pip install -r requirements.txt';
            startCommand = 'gunicorn app:app';
        }

        const railwayConfigContent = `{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "${buildCommand}"
  },
  "deploy": {
    "startCommand": "${startCommand}",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
`;
        fs.writeFileSync(railwayConfigPath, railwayConfigContent);
        this.filesCreated.push('railway.json');
    }

    // Helper methods

    // Get package.json content
    getPackageJson() {
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) return {};
        
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    }

    // Add dependencies to package.json
    addDependencies(deps) {
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        const packageJson = this.getPackageJson();

        if (!packageJson.dependencies) {
            packageJson.dependencies = {};
        }

        Object.assign(packageJson.dependencies, deps);

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        this.filesModified.push('package.json');
    }

    // Ensure package.json scripts exist
    ensurePackageJsonScripts(scripts) {
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        const packageJson = this.getPackageJson();

        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }

        let modified = false;
        for (const [script, command] of Object.entries(scripts)) {
            if (!packageJson.scripts[script]) {
                packageJson.scripts[script] = command;
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
            this.filesModified.push('package.json');
        }
    }

    // Add environment variables
    addEnvVars(vars) {
        const envExamplePath = path.join(this.projectPath, '.env.example');
        let content = '';

        if (fs.existsSync(envExamplePath)) {
            content = fs.readFileSync(envExamplePath, 'utf8');
        }

        const lines = content.split('\n').filter(line => line.trim());
        const existing = new Set(lines.map(line => line.split('=')[0]));

        const newLines = [];
        for (const [key, value] of Object.entries(vars)) {
            if (!existing.has(key)) {
                newLines.push(`${key}=${value}`);
            }
        }

        if (newLines.length > 0) {
            if (content && !content.endsWith('\n')) content += '\n';
            if (!content.includes('# Added by Shovel')) {
                content += '# Added by Shovel 🪓\n';
            }
            content += newLines.join('\n') + '\n';

            fs.writeFileSync(envExamplePath, content);
            
            if (!fs.existsSync(envExamplePath)) {
                this.filesCreated.push('.env.example');
            } else {
                this.filesModified.push('.env.example');
            }
        }
    }
}

module.exports = ProjectFixer;
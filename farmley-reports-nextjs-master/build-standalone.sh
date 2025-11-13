#!/bin/bash

echo "🚀 Building standalone Next.js application..."

# Clean previous builds
rm -rf .next
rm -rf dist-standalone

# Build the application
echo "📦 Building Next.js app..."
npm run build

# Create distribution directory
echo "📁 Creating distribution package..."
mkdir -p dist-standalone

# Copy the entire .next directory
cp -r .next dist-standalone/
# Copy public directory if it exists
cp -r public dist-standalone/ 2>/dev/null || :
# Copy package.json for dependencies
cp package.json dist-standalone/
# Copy ALL node_modules for production (safer approach)
echo "📦 Copying dependencies..."
cp -r node_modules dist-standalone/

# Create Node.js server file
cat > dist-standalone/server.js << 'EOF'
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
EOF

# Create start script
cat > dist-standalone/start.sh << 'EOF'
#!/bin/bash
PORT=${PORT:-3000}
NODE_ENV=production node server.js
EOF

chmod +x dist-standalone/start.sh

# Create start.bat for Windows
cat > dist-standalone/start.bat << 'EOF'
@echo off
set PORT=3000
set NODE_ENV=production
node server.js
EOF

# Create README for client
cat > dist-standalone/README.md << 'EOF'
# Access Control System - Production Build

## Requirements
- Node.js 18+ installed
- Port 3000 available (or set custom PORT)

## How to Run

### On Linux/Mac:
```bash
./start.sh
```

### On Windows:
```cmd
start.bat
```

### Custom Port:
```bash
PORT=8080 ./start.sh
```

## Access
Open browser at: http://localhost:3000

## Environment Variables
Create a `.env` file if needed:
```
DATABASE_URL=your_database_url
API_URL=your_api_url
```

## Support
Contact your administrator for support.
EOF

echo "✅ Standalone build created in 'dist-standalone' directory"
echo "📋 Instructions:"
echo "  1. Send the 'dist-standalone' folder to client"
echo "  2. Client needs Node.js 18+ installed"
echo "  3. Run start.sh (Linux/Mac) or start.bat (Windows)"
echo "  4. Access at http://localhost:3000"
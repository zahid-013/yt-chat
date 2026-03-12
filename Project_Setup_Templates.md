// ========================================
// package.json - Complete Configuration
// ========================================

{
  "name": "youtube-rag-chatbot",
  "version": "1.0.0",
  "description": "RAG-based chatbot that answers questions about YouTube video content",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js",
    "build": "echo 'No build needed for serverless deployment'",
    "test": "node --test tests/*.test.js",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "keywords": [
    "youtube",
    "rag",
    "chatbot",
    "ai",
    "embeddings",
    "supabase",
    "groq"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.4",
    "langchain": "^0.0.228",
    "langchain-community": "^0.0.24"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "eslint": "^8.50.0",
    "prettier": "^3.0.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}

// ========================================
// .env.local - Local Development
// ========================================

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# Groq API (LLM)
GROQ_API_KEY=your-groq-api-key-here

# Hugging Face (Embeddings)
HF_API_KEY=your-hugging-face-token-here

# Server Configuration
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# ========================================
# .env.production - Production Deployment
# ========================================

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-production-key
SUPABASE_SERVICE_KEY=your-production-service-key
GROQ_API_KEY=your-production-groq-key
HF_API_KEY=your-production-hf-key
PORT=5000
NODE_ENV=production
LOG_LEVEL=error
FRONTEND_URL=https://your-app-domain.com

# ========================================
# .gitignore - Ignore Sensitive Files
# ========================================

# Environment variables
.env
.env.local
.env.*.local
.env.production

# Dependencies
node_modules/
package-lock.json
yarn.lock

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Build
dist/
build/
.next/

# Temporary
tmp/
temp/

# ========================================
# vercel.json - Vercel Configuration
# ========================================

{
  "buildCommand": "npm install",
  "devCommand": "npm run dev",
  "outputDirectory": "./",
  "installCommand": "npm install",
  "framework": "nodejs",
  "env": [
    {
      "key": "SUPABASE_URL",
      "value": "@supabase_url"
    },
    {
      "key": "SUPABASE_KEY",
      "value": "@supabase_key"
    },
    {
      "key": "GROQ_API_KEY",
      "value": "@groq_api_key"
    },
    {
      "key": "HF_API_KEY",
      "value": "@hf_api_key"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "memory": 3008,
      "maxDuration": 60,
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}

// ========================================
// Quick Start Script (setup.sh)
// ========================================

#!/bin/bash

echo "🚀 YouTube RAG Chatbot - Setup Script"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Create project directory if it doesn't exist
if [ ! -d "youtube-rag-chatbot" ]; then
    echo "📁 Creating project directory..."
    mkdir youtube-rag-chatbot
fi

cd youtube-rag-chatbot

# Initialize Git if not already done
if [ ! -d ".git" ]; then
    echo "🔧 Initializing Git repository..."
    git init
    echo "node_modules/" >> .gitignore
    echo ".env.local" >> .gitignore
    echo ".env.production" >> .gitignore
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install express cors axios dotenv @supabase/supabase-js langchain

# Create directory structure
echo "📂 Creating directory structure..."
mkdir -p api src/components src/utils

# Create .env.local template
echo "⚙️  Creating .env.local template..."
cat > .env.local << 'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
GROQ_API_KEY=your-groq-key
HF_API_KEY=your-hf-key
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
EOF

echo "⚠️  IMPORTANT: Edit .env.local with your actual API keys!"
echo ""

# Create main server file if it doesn't exist
if [ ! -f "server.js" ]; then
    echo "📝 Creating server.js..."
    cat > server.js << 'EOF'
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(express.json());
app.use(cors());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
EOF
fi

# Create README if it doesn't exist
if [ ! -f "README.md" ]; then
    echo "📖 Creating README.md..."
    cat > README.md << 'EOF'
# YouTube RAG Chatbot

A web application that extracts YouTube video subtitles and answers questions using RAG (Retrieval Augmented Generation).

## Quick Start

1. **Setup Environment**
   ```bash
   npm install
   cp .env.local.template .env.local
   # Edit .env.local with your API keys
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

## Requirements

- Node.js 18+
- API Keys:
  - Supabase (vector database)
  - Groq API (LLM)
  - Hugging Face (embeddings)

## Documentation

- See `YouTube_RAG_Chatbot_Guide.md` for full architecture
- See `Deployment_Guide.md` for step-by-step setup
- See `Quick_Reference_Checklist.md` for quick reference

## License

MIT
EOF
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Read YouTube_RAG_Chatbot_Guide.md"
echo "3. Run: npm run dev"
echo ""
echo "🔗 Get API Keys:"
echo "- Supabase: https://supabase.com"
echo "- Groq: https://console.groq.com"
echo "- Hugging Face: https://huggingface.co"
echo ""

// ========================================
// database-setup.sql
// ========================================

-- Run this in your Supabase SQL editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create main embeddings table
CREATE TABLE IF NOT EXISTS video_embeddings (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),  -- 384 dimensions for all-MiniLM-L6-v2
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_video_chunk UNIQUE(video_id, chunk_index)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_embeddings_video_id 
  ON video_embeddings(video_id);

CREATE INDEX IF NOT EXISTS idx_video_embeddings_created_at 
  ON video_embeddings(created_at);

CREATE INDEX IF NOT EXISTS idx_video_embeddings_embedding 
  ON video_embeddings USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Create RPC function for similarity search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(384),
  match_video_id TEXT,
  match_count INT = 5,
  match_threshold FLOAT = 0.5
)
RETURNS TABLE (
  id BIGINT,
  video_id TEXT,
  content TEXT,
  chunk_index INT,
  similarity FLOAT
) LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ve.id,
    ve.video_id,
    ve.content,
    ve.chunk_index,
    (1 - (ve.embedding <=> query_embedding))::FLOAT as similarity
  FROM video_embeddings ve
  WHERE ve.video_id = match_video_id
    AND (1 - (ve.embedding <=> query_embedding)) > match_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create chat history table (optional)
CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  user_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (video_id) REFERENCES video_embeddings(video_id)
);

-- Create index for chat queries
CREATE INDEX IF NOT EXISTS idx_chat_history_video_id 
  ON chat_history(video_id);

-- Enable Row Level Security
ALTER TABLE video_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Create public read policy
CREATE POLICY "public_read_embeddings" ON video_embeddings
  FOR SELECT USING (true);

CREATE POLICY "api_insert_embeddings" ON video_embeddings
  FOR INSERT WITH CHECK (true);

-- Create policy for chat history
CREATE POLICY "public_read_chat" ON chat_history
  FOR SELECT USING (true);

CREATE POLICY "api_insert_chat" ON chat_history
  FOR INSERT WITH CHECK (true);

// ========================================
// Running the Application
// ========================================

// Method 1: Local Development
npm run dev
// Server will start at http://localhost:5000
// Open http://localhost:5173 for frontend

// Method 2: Production Build
npm run build
npm start

// Method 3: Deploy to Vercel
vercel --prod

// ========================================
// API Curl Examples
// ========================================

# Process a video
curl -X POST http://localhost:5000/api/process-video \
  -H "Content-Type: application/json" \
  -d '{"videoId":"dQw4w9WgXcQ"}'

# Ask a question
curl -X POST http://localhost:5000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"videoId":"dQw4w9WgXcQ","question":"What is this video about?"}'

# Health check
curl http://localhost:5000/api/health


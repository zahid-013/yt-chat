# YouTube RAG Chatbot - Deployment Guide

## Quick Start (5 Steps to Production)

### Step 1: Create Free Accounts

#### Supabase (Vector Database)
1. Go to https://supabase.com
2. Sign up with GitHub
3. Create new project
4. Copy `Project URL` and `Anon Key` (in Settings > API)
5. Note: Project automatically includes PostgreSQL with pgvector extension

#### Groq API (LLM - Free Tier)
1. Go to https://console.groq.com
2. Sign up with email or GitHub
3. Go to API Keys
4. Create new API key
5. Copy key (you'll have 90+ requests/hour free)

#### Hugging Face (Embeddings)
1. Go to https://huggingface.co
2. Sign up with email
3. Go to Settings > Access Tokens
4. Create new token with "read" permission
5. Copy token

#### Vercel (Frontend & Backend)
1. Go to https://vercel.com
2. Sign up with GitHub
3. You're ready to deploy!

---

### Step 2: Set Up Local Project

```bash
# Clone or create your project
mkdir youtube-rag-chatbot
cd youtube-rag-chatbot

# Initialize npm
npm init -y

# Install dependencies
npm install express cors axios langchain @supabase/supabase-js

# For frontend (if building separately)
npm create vite@latest frontend -- --template react
cd frontend
npm install react-query axios lucide-react
```

---

### Step 3: Configure Environment Variables

Create `.env.local` file in your project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here

# Groq API
GROQ_API_KEY=your-groq-api-key-here

# Hugging Face
HF_API_KEY=your-hugging-face-token-here

# Server
PORT=5000
NODE_ENV=development
```

Create `.env.production` for production:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-production-key
GROQ_API_KEY=your-production-key
HF_API_KEY=your-production-key
```

---

### Step 4: Set Up Supabase Database

Go to your Supabase project dashboard → SQL Editor and run:

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create main table
CREATE TABLE video_embeddings (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),  -- 384 dimensions for all-MiniLM-L6-v2
  chunk_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_chunk UNIQUE(video_id, chunk_index)
);

-- 3. Create indexes for performance
CREATE INDEX idx_video_embeddings_video_id 
ON video_embeddings(video_id);

CREATE INDEX idx_video_embeddings_embedding 
ON video_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 4. Create RPC function for similarity search
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
  similarity FLOAT
) LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ve.id,
    ve.video_id,
    ve.content,
    (1 - (ve.embedding <=> query_embedding))::FLOAT as similarity
  FROM video_embeddings ve
  WHERE ve.video_id = match_video_id
    AND (1 - (ve.embedding <=> query_embedding)) > match_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Create storage bucket for future use
INSERT INTO storage.buckets (id, name) VALUES ('chats', 'chats');

-- 6. Enable Row Level Security
ALTER TABLE video_embeddings ENABLE ROW LEVEL SECURITY;

-- 7. Create public read policy
CREATE POLICY "public_read" ON video_embeddings
  FOR SELECT USING (true);

-- 8. Create insert policy (for API)
CREATE POLICY "api_insert" ON video_embeddings
  FOR INSERT WITH CHECK (true);
```

---

### Step 5: Deploy to Vercel

#### Option A: Deploy Backend + Frontend Together

**Project Structure:**
```
youtube-rag-chatbot/
├── api/
│   └── [chat].js          # Serverless functions
├── public/
│   └── index.html
├── src/
│   └── components/        # React components
├── vercel.json
├── package.json
└── .env.local
```

**Create `vercel.json`:**
```json
{
  "buildCommand": "npm install && npm run build",
  "devCommand": "npm run dev",
  "env": [
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "GROQ_API_KEY",
    "HF_API_KEY"
  ],
  "functions": {
    "api/**/*.js": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

**Create `api/process-video.js`:**
```javascript
// This will be your serverless function
import handler from '../server.js';
export default handler;
```

**Deploy:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Option B: Deploy Frontend to Vercel, Backend to Railway

**Frontend (Vercel):**
1. Create `frontend/` directory with your React app
2. Push to GitHub
3. In Vercel: Connect GitHub repo
4. Select `frontend` folder as root
5. Add environment variables:
   - `REACT_APP_API_URL=your-railway-backend-url`

**Backend (Railway):**
1. Create `backend/` directory
2. Add `railway.json`:
```json
{
  "build": {
    "builder": "nixpacks",
    "config": {
      "nixpacks": {
        "nodejs": "18"
      }
    }
  }
}
```
3. Push to GitHub
4. In Railway: Create new service from GitHub
5. Select `backend` folder
6. Add environment variables in Railway dashboard
7. Railway will auto-deploy on push

---

## Feature Implementation Guide

### Feature 1: Video Metadata Display

```javascript
// Already included in React component
const getVideoMetadata = async (videoId) => {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
  );
  return response.json();
};
```

### Feature 2: Chat History

```javascript
// Save to localStorage (client-side)
const saveChatHistory = (videoId, messages) => {
  const history = JSON.parse(localStorage.getItem('chatHistory') || '{}');
  history[videoId] = {
    messages,
    timestamp: Date.now(),
    metadata: videoMetadata
  };
  localStorage.setItem('chatHistory', JSON.stringify(history));
};

// Load history
const loadChatHistory = (videoId) => {
  const history = JSON.parse(localStorage.getItem('chatHistory') || '{}');
  return history[videoId];
};
```

### Feature 3: Multi-Language Support

```javascript
// In backend
const getYouTubeSubtitles = async (videoId, language = 'en') => {
  const response = await axios.get(
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${language}&fmt=json3`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  // ... parse response
};

// In frontend - add language selector
<select onChange={(e) => setLanguage(e.target.value)} defaultValue="en">
  <option value="en">English</option>
  <option value="es">Spanish</option>
  <option value="fr">French</option>
  <option value="de">German</option>
</select>
```

### Feature 4: Video Summary

```javascript
// Add to backend
const generateSummary = async (subtitles) => {
  const prompt = `Summarize this video content in 5 bullet points:\n${subtitles}`;
  
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    },
    { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } }
  );
  
  return response.data.choices[0].message.content;
};

// Add endpoint
app.post('/api/summarize', async (req, res) => {
  const { videoId } = req.body;
  const subtitles = await getYouTubeSubtitles(videoId);
  const summary = await generateSummary(subtitles);
  res.json({ summary });
});
```

### Feature 5: Export Chat as PDF

```javascript
// Install dependency
npm install jspdf html2canvas

// Add function
const exportChatAsPDF = async (messages, videoMetadata) => {
  const { jsPDF } = require('jspdf');
  const html2canvas = require('html2canvas');
  
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(`Chat: ${videoMetadata.title}`, 10, 10);
  
  // Add messages
  let y = 30;
  messages.forEach((msg) => {
    doc.setFontSize(11);
    doc.text(`${msg.type === 'user' ? 'You' : 'Bot'}: ${msg.content}`, 10, y);
    y += 20;
  });
  
  doc.save(`chat-${videoMetadata.video_id}.pdf`);
};
```

### Feature 6: Timestamp-Based Answers

```javascript
// Enhance subtitle extraction to include timestamps
const getSubtitlesWithTimestamps = async (videoId) => {
  const response = await axios.get(
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
  );
  
  return response.data.events.map(event => ({
    text: event.segs.map(s => s.utf8).join(''),
    startTime: event.tStartMs / 1000,  // Convert to seconds
    duration: event.dDurationMs / 1000
  }));
};

// When returning context, include timestamps
const retrieveContextWithTimestamps = async (queryEmbedding, videoId) => {
  const { data } = await supabaseClient.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    video_id: videoId,
    match_count: 5
  });
  
  return data.map(item => ({
    content: item.content,
    timestamp: item.chunk_index * 30,  // Approximate timestamp
    link: `https://youtube.com/watch?v=${videoId}&t=${Math.floor(item.chunk_index * 30)}`
  }));
};
```

---

## Monitoring & Analytics

### Add Error Tracking (Sentry)

```bash
npm install @sentry/node
```

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Monitor API Usage

```javascript
// Log API calls
const logAPIUsage = (endpoint, videoId, status) => {
  console.log(`[${new Date().toISOString()}] ${endpoint} - Video: ${videoId} - Status: ${status}`);
  // Send to analytics service
};

app.post('/api/ask', async (req, res) => {
  const start = Date.now();
  try {
    // ... your code
    logAPIUsage('ask', videoId, 'success');
  } catch (error) {
    logAPIUsage('ask', videoId, 'error');
  }
});
```

---

## Cost Estimate (Monthly)

| Service | Free Tier | Cost if Exceeded |
|---------|-----------|-----------------|
| **Vercel** | 100GB bandwidth | $0.50/100GB |
| **Supabase** | 500MB storage, 2M queries | $25/month for more |
| **Groq API** | 90+ req/hour | $0.001/request |
| **Hugging Face** | Rate limited free tier | $9/month for tier 1 |
| **Total** | **$0/month** | **~$100/month** |

---

## Troubleshooting

### "Failed to fetch subtitles"
- Check if video has captions enabled
- Try different language: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=es`
- Use alternative: youtube-transcript-api npm package

### "Vector dimension mismatch"
- Ensure embedding model outputs 384 dimensions (all-MiniLM-L6-v2)
- Check Supabase vector type: `vector(384)`

### "Rate limit exceeded"
- Implement request queuing
- Use caching for repeated videos
- Upgrade to paid Groq tier

### "High latency"
- Use Groq's faster model: `mixtral-8x7b-32768`
- Implement response caching
- Reduce context size (fewer chunks)

---

## Next: Production Optimization

1. **Caching Layer**
   - Cache embeddings for popular videos
   - Cache LLM responses for repeated questions

2. **Database Optimization**
   - Archive old videos
   - Implement soft deletes
   - Regular index maintenance

3. **Cost Reduction**
   - Switch to open-source LLM (Ollama)
   - Self-host vector DB (Chroma)
   - Implement vector quantization

4. **Monetization**
   - Premium API key for faster processing
   - Bulk video analysis
   - Custom integrations


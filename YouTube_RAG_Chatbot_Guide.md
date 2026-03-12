# YouTube RAG Chatbot - Complete Project Guide

## Project Overview
A web application that extracts YouTube video subtitles, creates embeddings using RAG (Retrieval Augmented Generation), and answers user questions based on video content.

---

## Architecture

```
┌─────────────────────────────────────┐
│    Frontend (React + Tailwind)       │
│  - Video input (URL/ID)              │
│  - Chat interface                    │
│  - Real-time subtitle loading        │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│    Backend (Node.js/Python)          │
│  - YouTube API integration           │
│  - Subtitle extraction               │
│  - Text chunking                     │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│    RAG Pipeline                      │
│  - Text embedding (Hugging Face)     │
│  - Vector storage (Pinecone/Supabase)│
│  - Semantic search                   │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│    LLM Integration                   │
│  - Claude API / OpenAI API           │
│  - Context-aware responses           │
└──────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Query** - State management
- **Lucide Icons** - UI icons

### Backend
- **Node.js + Express** OR **Python + FastAPI**
- **youtube-transcript-api** - Extract subtitles
- **Langchain** - RAG orchestration
- **Hugging Face Transformers** - Embeddings (sentence-transformers)

### Vector Database (Free Tier)
- **Pinecone** (free tier: 1 million vectors)
- **Supabase** (PostgreSQL + pgvector)
- **Chroma** (open-source, self-hosted)
- **Weaviate** (open-source cloud)

### LLM API (Free Options)
- **Claude API** (Anthropic) - $5 free credit
- **OpenAI** - Free trial credits
- **Hugging Face Inference API** - Free tier with rate limits
- **Groq** - Free API with fast inference
- **Ollama** - Self-hosted, fully free

---

## Free Deployment Options

### 1. **Vercel + Supabase + Groq (Recommended)**
**Cost: $0/month**

✅ **Frontend:** Vercel (free tier)
- Unlimited deployments
- GitHub integration
- Serverless functions

✅ **Backend:** Vercel Serverless Functions (Node.js)
- 100GB bandwidth/month free
- 512MB execution memory

✅ **Vector DB:** Supabase (free tier)
- 500MB storage
- PostgreSQL + pgvector
- Real-time subscriptions

✅ **LLM:** Groq API (free)
- Fast inference
- 90+ requests/hour free tier

**Pros:**
- Completely free
- Easy GitHub integration
- Built-in PostgreSQL with pgvector
- Fast response times

**Cons:**
- Limited monthly bandwidth
- Storage limits on Supabase

---

### 2. **Render + Railway + Pinecone**
**Cost: $0-$7/month**

✅ **Frontend:** Render (free tier)
- 750 hours/month
- Auto-sleep on inactivity

✅ **Backend:** Railway (free tier credit $5/month)
- Pay-as-you-go after free credits

✅ **Vector DB:** Pinecone (free tier)
- 1M vectors
- 5 pod environments

---

### 3. **Hugging Face Spaces + Gradio**
**Cost: $0/month**

✅ **All-in-one solution:**
- Deploy Python backend + frontend
- GPU access available
- Public/private spaces

**Cons:**
- No custom domain (unless upgraded)
- Limited resources
- Slower inference

---

### 4. **Replit + Firebase + OpenRouter**
**Cost: $0/month**

✅ **Frontend:** Replit (free tier)
- Python/Node.js
- Instant deployment

✅ **Backend:** Replit Workspace
- 512MB RAM

✅ **Vector DB:** Firebase Firestore (free tier)
- 1GB storage
- 50K reads/day

✅ **LLM:** OpenRouter (free tier)
- Multiple model access

---

## Step-by-Step Implementation

### Step 1: Extract YouTube Subtitles

```python
from youtube_transcript_api import YouTubeTranscriptFetcher, TranscriptsDisabled
import re

def extract_video_id(url):
    """Extract video ID from YouTube URL or use directly"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'^([a-zA-Z0-9_-]{11})$'  # Direct video ID
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_subtitles(video_id, language='en'):
    """Fetch subtitles from YouTube video"""
    try:
        transcript = YouTubeTranscriptFetcher().fetch_transcript(video_id, languages=[language])
        text = ' '.join([item['text'] for item in transcript])
        return text
    except TranscriptsDisabled:
        return None
    except Exception as e:
        return None
```

### Step 2: Text Chunking & Embedding

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping chunks"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    return splitter.split_text(text)

def generate_embeddings(chunks):
    """Generate embeddings using Hugging Face model"""
    model = SentenceTransformer('all-MiniLM-L6-v2')  # Lightweight, free
    embeddings = model.encode(chunks)
    return embeddings
```

### Step 3: Vector Storage (Supabase + pgvector)

```python
import supabase
import json

# Initialize Supabase client
supabase_url = "YOUR_SUPABASE_URL"
supabase_key = "YOUR_SUPABASE_KEY"
client = supabase.create_client(supabase_url, supabase_key)

def store_embeddings(video_id, chunks, embeddings):
    """Store embeddings in Supabase"""
    for chunk, embedding in zip(chunks, embeddings):
        client.table('video_embeddings').insert({
            'video_id': video_id,
            'content': chunk,
            'embedding': embedding.tolist(),
            'created_at': 'now()'
        }).execute()

def retrieve_context(query_embedding, video_id, k=5):
    """Find most relevant chunks using similarity search"""
    response = client.rpc(
        'match_embeddings',
        {
            'query_embedding': query_embedding.tolist(),
            'video_id': video_id,
            'match_count': k
        }
    ).execute()
    return [item['content'] for item in response.data]
```

### Step 4: RAG Query Pipeline

```python
from langchain.chat_models import ChatAnthropic
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

def answer_question(query, video_id, context_chunks):
    """Generate answer using RAG"""
    context = "\n".join(context_chunks)
    
    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template="""You are a helpful assistant answering questions about YouTube videos.
        
Video Content:
{context}

Question: {question}

Provide a clear, concise answer based only on the video content."""
    )
    
    llm = ChatAnthropic(model="claude-3-haiku-20240307")
    chain = LLMChain(llm=llm, prompt=prompt)
    
    response = chain.run(context=context, question=query)
    return response
```

### Step 5: Backend API (Express.js)

```javascript
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/process-video', async (req, res) => {
    try {
        const { videoId } = req.body;
        
        // 1. Extract subtitles
        const subtitles = await fetchSubtitles(videoId);
        
        // 2. Chunk text
        const chunks = chunkText(subtitles);
        
        // 3. Generate embeddings
        const embeddings = await generateEmbeddings(chunks);
        
        // 4. Store in database
        await storeEmbeddings(videoId, chunks, embeddings);
        
        res.json({
            success: true,
            videoId,
            chunkCount: chunks.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/ask', async (req, res) => {
    try {
        const { videoId, question } = req.body;
        
        // 1. Embed query
        const queryEmbedding = await generateEmbeddings([question])[0];
        
        // 2. Retrieve context
        const context = await retrieveContext(queryEmbedding, videoId);
        
        // 3. Generate answer
        const answer = await answerQuestion(question, videoId, context);
        
        res.json({ answer, sources: context });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.listen(process.env.PORT || 5000);
```

---

## Extra Features to Implement

### 1. **Video Metadata & Thumbnails**
```javascript
// Fetch video title, duration, thumbnail
const getVideoMetadata = async (videoId) => {
    const response = await axios.get(
        `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
    );
    return response.data;
};
```

### 2. **Multiple Language Support**
- Auto-detect language
- Support English, Spanish, French, etc.
- Language selection dropdown

### 3. **Summary Generation**
```python
def generate_summary(text):
    """Generate video summary"""
    prompt = f"Summarize this video content in 3-5 bullet points:\n{text}"
    summary = llm.generate(prompt)
    return summary
```

### 4. **Chat History & Bookmarking**
- Store conversations in IndexedDB (browser)
- Bookmark important Q&A pairs
- Export chat as PDF

### 5. **Timestamp-Based Answers**
- Return video timestamps for relevant segments
- Link answers to specific parts of video

### 6. **Sentiment Analysis**
- Analyze video sentiment
- Extract key topics automatically

### 7. **Multi-Video Comparison**
- Compare content across multiple videos
- Cross-reference information

### 8. **Export Options**
- PDF report of Q&A
- JSON export of chat history
- Share chat via link

---

## Frontend UI Structure

```
┌──────────────────────────────────────┐
│         YouTube RAG Chatbot          │
├──────────────────────────────────────┤
│ [Paste Video URL] [Paste Video ID]   │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ Video Thumbnail & Metadata     │   │
│ │ Title: ...                     │   │
│ │ Duration: ...                  │   │
│ │ Processing Status: ✓           │   │
│ └────────────────────────────────┘   │
│                                      │
│ ┌────────────────────────────────┐   │
│ │  Chat History                  │   │
│ │ Bot: Video is about...         │   │
│ │ You: What is X?                │   │
│ │ Bot: Based on video, X is...   │   │
│ └────────────────────────────────┘   │
│                                      │
│ [Question Input] [Send]  [Summary]   │
│                                      │
│ [Export] [Clear] [New Video]         │
└──────────────────────────────────────┘
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured (.env)
- [ ] API keys secured (never commit to GitHub)
- [ ] Rate limiting implemented
- [ ] Error handling for failed subtitle extraction
- [ ] CORS configured properly

### Deployment Steps

#### Option A: Vercel + Supabase

1. **Frontend Deployment**
```bash
npm install -g vercel
vercel --prod
```

2. **Backend Functions** (Vercel Serverless)
- Deploy API routes in `/api` folder
- Auto-scales, no server management

3. **Database** 
- Create Supabase project
- Set `SUPABASE_URL` and `SUPABASE_KEY` as env vars

4. **LLM API**
- Get Groq API key: https://console.groq.com
- Add to environment variables

#### Option B: Render + Railway

1. **Create Render.com account**
2. **Connect GitHub repo**
3. **Set environment variables**
4. **Deploy with 1 click**

---

## Cost Analysis

| Option | Frontend | Backend | Vector DB | LLM | Total |
|--------|----------|---------|-----------|-----|-------|
| **Vercel + Supabase + Groq** | Free | Free | Free (500MB) | Free | **$0** |
| **Render + Railway + Pinecone** | Free | Free (credits) | Free (1M vectors) | Free | **$0-7** |
| **HF Spaces** | Free | Free | Free | Free | **$0** |
| **Production Scale** | $20 | $50 | $100+ | $50+ | **$220+** |

---

## Performance Optimization

### Frontend
- Lazy load chat messages
- Debounce search queries
- Cache video metadata
- Use Web Workers for embedding generation

### Backend
- Implement caching layer (Redis)
- Batch process embeddings
- Use async/await for I/O operations
- Implement request queuing

### Database
- Index on `video_id` and `created_at`
- Implement pagination
- Clean up old embeddings periodically

---

## Security Considerations

1. **API Key Management**
   - Never expose API keys in frontend
   - Use backend for all API calls
   - Rotate keys regularly

2. **Rate Limiting**
   - Limit API requests per IP
   - Implement token-based auth for paid tier

3. **Input Validation**
   - Validate video IDs
   - Sanitize user queries
   - Limit question length

4. **Data Privacy**
   - Clear old embeddings periodically
   - Implement user authentication
   - GDPR compliance

---

## Monitoring & Analytics

- **Error Tracking:** Sentry.io (free tier)
- **Analytics:** Vercel Analytics or Plausible
- **Uptime Monitoring:** UptimeRobot (free)
- **Logs:** Vercel Logs or LogRocket

---

## Next Steps

1. **Start with MVP:** Video input → Subtitle extraction → Basic Q&A
2. **Add UI Polish:** Implement professional design
3. **Scale Features:** Add summaries, multi-language, exports
4. **Monitor & Optimize:** Track usage and improve performance
5. **Monetize:** Add premium features (API key management, priority processing)

---

## Resource Links

- YouTube Transcript API: https://github.com/jderose9/youtube-transcript-api
- Langchain Docs: https://python.langchain.com/
- Pinecone Free Tier: https://www.pinecone.io/pricing/
- Supabase Docs: https://supabase.com/docs
- Groq API: https://console.groq.com
- Vercel Deployment: https://vercel.com/docs
- Sentence Transformers: https://www.sbert.net/


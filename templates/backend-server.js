/**
 * YouTube RAG Chatbot - Backend API
 * Framework: Express.js
 * Deployment: Vercel Serverless Functions
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HuggingFaceInference } = require('langchain/llms/hf');
const supabase = require('@supabase/supabase-js');

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;

// Initialize clients
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json());
app.use(cors());

// ============================================================
// 1. SUBTITLE EXTRACTION
// ============================================================

/**
 * Fetch subtitles from YouTube using yt-dlp API
 * Free alternative: youtube-transcript-api
 */
const getYouTubeSubtitles = async (videoId) => {
  try {
    // Method 1: Using YouTube Transcript API (recommended - completely free)
    const response = await axios.get(
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    if (response.data.events) {
      const subtitles = response.data.events
        .filter(e => e.segs)
        .map(e => e.segs.map(s => s.utf8).join(''))
        .join(' ');
      return subtitles;
    }

    throw new Error('No subtitles found');
  } catch (error) {
    console.error('Error fetching subtitles:', error.message);
    throw new Error('Failed to fetch subtitles. Make sure the video has captions enabled.');
  }
};

// ============================================================
// 2. TEXT CHUNKING
// ============================================================

const chunkText = async (text, chunkSize = 500, chunkOverlap = 50) => {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', ' ', '']
    });
    const chunks = await splitter.splitText(text);
    return chunks.filter(chunk => chunk.trim().length > 20); // Remove too short chunks
  } catch (error) {
    console.error('Error chunking text:', error);
    throw new Error('Failed to process video text');
  }
};

// ============================================================
// 3. EMBEDDING GENERATION (using Hugging Face Inference API)
// ============================================================

const generateEmbeddings = async (texts) => {
  try {
    const embeddings = [];
    
    for (const text of texts) {
      const response = await axios.post(
        'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
        { inputs: text },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`
          }
        }
      );
      
      embeddings.push(response.data);
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error.message);
    throw new Error('Failed to generate embeddings');
  }
};

// ============================================================
// 4. VECTOR STORAGE (Supabase + pgvector)
// ============================================================

const storeEmbeddings = async (videoId, chunks, embeddings) => {
  try {
    // Prepare data for insertion
    const data = chunks.map((chunk, idx) => ({
      video_id: videoId,
      content: chunk,
      embedding: embeddings[idx],
      chunk_index: idx,
      created_at: new Date().toISOString()
    }));

    // Insert in batches to avoid timeout
    const batchSize = 10;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from('video_embeddings')
        .insert(batch);

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
    }

    return data.length;
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw new Error('Failed to store embeddings');
  }
};

// ============================================================
// 5. SEMANTIC SEARCH (Vector Similarity)
// ============================================================

const retrieveContext = async (queryEmbedding, videoId, topK = 5) => {
  try {
    // Call Supabase RPC function for similarity search
    // Make sure you've created this function in Supabase first (see SQL below)
    const { data, error } = await supabaseClient.rpc('match_embeddings', {
      query_embedding: queryEmbedding,
      video_id: videoId,
      match_count: topK,
      match_threshold: 0.5
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      throw error;
    }

    return data.map(item => item.content);
  } catch (error) {
    console.error('Error retrieving context:', error);
    throw new Error('Failed to retrieve relevant content');
  }
};

// ============================================================
// 6. ANSWER GENERATION (Using Groq API)
// ============================================================

const generateAnswer = async (query, contextChunks) => {
  try {
    const context = contextChunks.join('\n\n---\n\n');
    
    const prompt = `You are a helpful assistant answering questions about YouTube video content.

Video Content:
${context}

User Question: ${query}

Instructions:
- Answer based ONLY on the provided video content
- If the answer is not in the content, say so
- Keep response concise (2-3 paragraphs max)
- Use bullet points if listing items
- Be specific and quote relevant parts when possible`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating answer:', error.message);
    throw new Error('Failed to generate answer');
  }
};

// ============================================================
// API ENDPOINTS
// ============================================================

/**
 * POST /api/process-video
 * Process a YouTube video: extract subtitles, chunk, embed, and store
 */
app.post('/api/process-video', async (req, res) => {
  try {
    const { videoId } = req.body;

    if (!videoId || videoId.length !== 11) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    console.log(`Processing video: ${videoId}`);

    // Check if video already processed
    const { data: existing } = await supabaseClient
      .from('video_embeddings')
      .select('video_id')
      .eq('video_id', videoId)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({
        success: true,
        videoId,
        message: 'Video already processed',
        cached: true
      });
    }

    // 1. Extract subtitles
    console.log('Extracting subtitles...');
    const subtitles = await getYouTubeSubtitles(videoId);

    if (!subtitles || subtitles.length === 0) {
      return res.status(400).json({
        error: 'No subtitles found. Please ensure the video has captions enabled.'
      });
    }

    // 2. Chunk text
    console.log('Chunking text...');
    const chunks = await chunkText(subtitles);

    if (chunks.length === 0) {
      return res.status(400).json({ error: 'Failed to process video content' });
    }

    // 3. Generate embeddings
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const embeddings = await generateEmbeddings(chunks);

    // 4. Store in database
    console.log('Storing embeddings...');
    const storedCount = await storeEmbeddings(videoId, chunks, embeddings);

    res.json({
      success: true,
      videoId,
      chunkCount: storedCount,
      processingTime: Date.now()
    });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/ask
 * Ask a question about a processed video
 */
app.post('/api/ask', async (req, res) => {
  try {
    const { videoId, question } = req.body;

    if (!videoId || !question) {
      return res.status(400).json({ error: 'Missing videoId or question' });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: 'Question too long' });
    }

    console.log(`Question: ${question} for video: ${videoId}`);

    // 1. Embed the query
    const queryEmbeddings = await generateEmbeddings([question]);
    const queryEmbedding = queryEmbeddings[0];

    // 2. Retrieve relevant context
    const contextChunks = await retrieveContext(queryEmbedding, videoId, 5);

    if (contextChunks.length === 0) {
      return res.json({
        answer: 'I could not find relevant information in the video to answer your question. Try asking something more specific about the video content.',
        sources: []
      });
    }

    // 3. Generate answer
    const answer = await generateAnswer(question, contextChunks);

    res.json({
      success: true,
      answer,
      sources: contextChunks,
      relevance: 'high'
    });
  } catch (error) {
    console.error('Error answering question:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/videos/:videoId
 * Get cached information about a video
 */
app.get('/api/videos/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    const { data, error } = await supabaseClient
      .from('video_embeddings')
      .select('video_id, COUNT(*)')
      .eq('video_id', videoId)
      .limit(1);

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      videoId,
      status: 'processed',
      chunkCount: data[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server (for local testing)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;

// ============================================================
// SUPABASE SQL SETUP
// ============================================================
/*
Run this in your Supabase SQL editor to set up the vector database:

-- Create table
CREATE TABLE video_embeddings (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),
  chunk_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(video_id, chunk_index)
);

-- Create index for faster searches
CREATE INDEX ON video_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON video_embeddings(video_id);

-- Create RPC function for similarity search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(384),
  video_id TEXT,
  match_count INTEGER = 5,
  match_threshold FLOAT = 0.5
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  similarity FLOAT
) AS $$
SELECT
  video_embeddings.id,
  video_embeddings.content,
  1 - (video_embeddings.embedding <=> query_embedding) as similarity
FROM video_embeddings
WHERE video_embeddings.video_id = match_embeddings.video_id
  AND 1 - (video_embeddings.embedding <=> query_embedding) > match_threshold
ORDER BY video_embeddings.embedding <=> query_embedding
LIMIT match_count;
$$ LANGUAGE SQL;

-- Enable RLS (Row Level Security) - Optional
ALTER TABLE video_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "public_read" ON video_embeddings
  FOR SELECT USING (true);
*/

// ============================================================
// ENVIRONMENT VARIABLES (.env)
// ============================================================
/*
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
GROQ_API_KEY=your-groq-api-key
HF_API_KEY=your-hugging-face-api-key
PORT=5000
*/

// ============================================================
// DEPLOYMENT TO VERCEL
// ============================================================
/*
1. Install Vercel CLI:
   npm install -g vercel

2. Create vercel.json in project root:
{
  "buildCommand": "npm install",
  "devCommand": "node server.js",
  "outputDirectory": "."
}

3. Deploy:
   vercel --prod

4. Set environment variables in Vercel dashboard:
   - SUPABASE_URL
   - SUPABASE_KEY
   - GROQ_API_KEY
   - HF_API_KEY
*/

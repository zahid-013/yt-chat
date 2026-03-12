import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Loader, Download, Trash2, Copy, Check } from 'lucide-react';

const YouTubeRAGChatbot = () => {
  const [videoInput, setVideoInput] = useState('');
  const [videoId, setVideoId] = useState(null);
  const [videoMetadata, setVideoMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Extract video ID from URL or validate direct ID
  const extractVideoId = (input) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (let pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Fetch video metadata
  const fetchMetadata = async (id) => {
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${id}&format=json`
      );
      if (!response.ok) throw new Error('Invalid video ID');
      return await response.json();
    } catch (err) {
      setError('Could not fetch video metadata. Please verify the video ID.');
      return null;
    }
  };

  const handleProcessVideo = async (e) => {
    e.preventDefault();
    setError('');

    const id = extractVideoId(videoInput);
    if (!id) {
      setError('Invalid YouTube URL or Video ID. Please enter a valid URL or 11-character video ID.');
      return;
    }

    setProcessing(true);
    try {
      // Fetch metadata
      const metadata = await fetchMetadata(id);
      if (!metadata) {
        setProcessing(false);
        return;
      }

      setVideoId(id);
      setVideoMetadata(metadata);

      // Send to backend for processing
      const response = await fetch('/api/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id })
      });

      if (!response.ok) throw new Error('Failed to process video');
      
      const data = await response.json();
      setMessages([{
        type: 'bot',
        content: `✅ Video processed successfully! Found ${data.chunkCount} content chunks. You can now ask questions about the video.`,
        timestamp: new Date()
      }]);
      setVideoInput('');
    } catch (err) {
      setError(err.message || 'Error processing video. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || !videoId) return;

    const userMessage = userInput;
    setUserInput('');
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);
    setLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, question: userMessage })
      });

      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      setMessages(prev => [...prev, {
        type: 'bot',
        content: data.answer,
        sources: data.sources,
        timestamp: new Date()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: '❌ Error: ' + (err.message || 'Could not process your question. Try again.'),
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const chatText = messages.map(m => `${m.type === 'user' ? 'You' : 'Assistant'}: ${m.content}`).join('\n\n');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(chatText));
    element.setAttribute('download', `chat-${videoId}-${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-red-500">▶</span> YouTube RAG Chatbot
          </h1>
          <p className="text-slate-400 text-sm mt-1">Ask questions about any YouTube video</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Video Input Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Load YouTube Video</h2>
          <form onSubmit={handleProcessVideo} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...) or Video ID (11 characters)"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={processing || !videoInput.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                {processing ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Load Video
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm bg-red-950 bg-opacity-50 p-3 rounded border border-red-700">
                {error}
              </p>
            )}
          </form>

          {/* Video Metadata */}
          {videoMetadata && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex gap-4">
                <img
                  src={videoMetadata.thumbnail_url}
                  alt="Video thumbnail"
                  className="w-32 h-24 rounded object-cover"
                />
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-2 line-clamp-2">
                    {videoMetadata.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-3">
                    Channel: {videoMetadata.author_name}
                  </p>
                  <div className="flex gap-2 items-center">
                    <code className="bg-slate-700 px-3 py-1 rounded text-slate-300 text-xs font-mono">
                      {videoId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(videoId)}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                      {copiedId === videoId ? (
                        <Check size={16} className="text-green-400" />
                      ) : (
                        <Copy size={16} className="text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Section */}
        {videoId && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col h-[600px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-800 to-slate-750">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <p className="text-center">
                    <span className="text-2xl mb-2 block">💬</span>
                    Ask a question about the video to get started
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-lg ${
                        msg.type === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-700 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.sources && (
                        <details className="mt-2 text-xs cursor-pointer">
                          <summary className="opacity-70 hover:opacity-100">📌 Sources</summary>
                          <div className="mt-2 space-y-1 opacity-70">
                            {msg.sources.slice(0, 2).map((source, i) => (
                              <p key={i} className="bg-slate-600 p-2 rounded line-clamp-2">
                                {source}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleAskQuestion} className="border-t border-slate-700 bg-slate-800 p-4 flex gap-2">
              <input
                type="text"
                placeholder="Ask a question about the video..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-400 disabled:opacity-50 text-sm"
              />
              <button
                type="submit"
                disabled={loading || !userInput.trim()}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>

            {/* Actions */}
            <div className="border-t border-slate-700 bg-slate-800 px-4 py-3 flex gap-2">
              <button
                onClick={handleExport}
                disabled={messages.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:opacity-50 text-white rounded text-sm transition-colors"
              >
                <Download size={16} />
                Export Chat
              </button>
              <button
                onClick={() => {
                  setMessages([]);
                  setVideoId(null);
                  setVideoMetadata(null);
                  setVideoInput('');
                  setError('');
                }}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors ml-auto"
              >
                <Trash2 size={16} />
                Clear & New Video
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 bg-slate-950 mt-8 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>Built with React, Langchain & RAG Technology</p>
          <p className="mt-1 text-xs text-slate-500">
            Powered by Hugging Face Embeddings, Groq API & Supabase
          </p>
        </div>
      </div>
    </div>
  );
};

export default YouTubeRAGChatbot;

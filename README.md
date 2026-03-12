---
title: YouTube RAG Chatbot
emoji: 🎥
colorFrom: red
colorTo: blue
sdk: streamlit
sdk_version: "1.35.0"
app_file: app.py
pinned: false
---

# 🎥 YouTube RAG Chatbot

Ask questions about any YouTube video that has captions/transcripts using a **Retrieval-Augmented Generation (RAG)** pipeline powered by LangChain, FAISS, and Llama 3.3 on HuggingFace.

## How it works

1. Paste a YouTube URL in the sidebar and click **Process Video**.
2. The app fetches the video transcript, splits it into chunks, and builds a FAISS vector index.
3. Ask any question in the chat — relevant chunks are retrieved and passed to **Llama-3.3-70B-Instruct** to generate an answer grounded in the transcript.

## Setup (local)

```bash
pip install -r requirements.txt
```

Create a `.env` file with your HuggingFace token:

```
HUGGINGFACEHUB_ACCESS_TOKEN=hf_your_token_here
```

Then run:

```bash
streamlit run app.py
```

## HuggingFace Spaces

Add your `HUGGINGFACEHUB_ACCESS_TOKEN` as a **Secret** in the Space settings (Settings → Variables and secrets). No `.env` file is needed on Spaces.

## Tech stack

| Component | Library |
|---|---|
| LLM | `meta-llama/Llama-3.3-70B-Instruct` via HuggingFace |
| Embeddings | `BAAI/bge-small-en-v1.5` |
| Vector store | FAISS |
| Orchestration | LangChain |
| UI | Streamlit |

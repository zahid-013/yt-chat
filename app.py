import streamlit as st
from dotenv import load_dotenv
from youtube_transcript_api import TranscriptsDisabled
from ytchat import build_retriever, get_answer

load_dotenv()

st.set_page_config(page_title="YouTube RAG Chatbot", page_icon="🎥", layout="wide")
st.title("🎥 YouTube RAG Chatbot")
st.markdown("Ask questions about any YouTube video that has captions.")

if "retriever" not in st.session_state:
    st.session_state.retriever = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "processed_url" not in st.session_state:
    st.session_state.processed_url = ""

with st.sidebar:
    st.header("⚙️ Video Setup")
    video_url = st.text_input(
        "YouTube URL or Video ID",
        placeholder="https://www.youtube.com/watch?v=...",
    )
    if st.button("Process Video", type="primary", use_container_width=True):
        if video_url.strip():
            with st.spinner("Fetching transcript and building knowledge base…"):
                try:
                    st.session_state.retriever = build_retriever(video_url.strip())
                    st.session_state.processed_url = video_url.strip()
                    st.session_state.chat_history = []
                    st.success("✅ Video processed! Ask your questions below.")
                except TranscriptsDisabled:
                    st.error("This video does not have captions/transcripts available.")
                except Exception as e:
                    st.error(f"Error: {e}")
        else:
            st.warning("Please enter a YouTube URL.")

    if st.session_state.processed_url:
        st.caption(f"Currently loaded:\n{st.session_state.processed_url}")

if st.session_state.retriever is None:
    st.info("👈 Paste a YouTube URL in the sidebar and click **Process Video** to get started.")
else:
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])

    question = st.chat_input("Ask a question about the video…")
    if question:
        st.session_state.chat_history.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.write(question)
        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                try:
                    answer = get_answer(st.session_state.retriever, question)
                    st.write(answer)
                    st.session_state.chat_history.append({"role": "assistant", "content": answer})
                except Exception as e:
                    err = f"Error: {e}"
                    st.error(err)
                    st.session_state.chat_history.append({"role": "assistant", "content": err})

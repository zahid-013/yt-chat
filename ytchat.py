import re
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda, RunnableParallel, RunnablePassthrough
from langchain_huggingface import ChatHuggingFace, HuggingFaceEmbeddings, HuggingFaceEndpoint
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate


def _get_model():
    llm = HuggingFaceEndpoint(
        repo_id="meta-llama/Llama-3.3-70B-Instruct",
        task="text-generation",
        temperature=0.5,
    )
    return ChatHuggingFace(llm=llm)


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from a URL or return the value as-is if it looks like an ID."""
    pattern = r"(?:v=|youtu\.be/|embed/)([a-zA-Z0-9_-]{11})"
    match = re.search(pattern, url)
    return match.group(1) if match else url


def build_retriever(url: str):
    """Fetch the transcript for *url* and return a FAISS retriever."""
    video_id = extract_video_id(url)

    api = YouTubeTranscriptApi()
    transcript_data = api.fetch(video_id)
    transcript = " ".join(snippet.text for snippet in transcript_data)

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_text(transcript)

    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    vector_store = FAISS.from_texts(chunks, embeddings)
    return vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 4})


def get_answer(retriever, question: str) -> str:
    """Answer *question* using chunks retrieved from *retriever*."""
    prompt = PromptTemplate(
        template="""You are a helpful assistant.
Answer ONLY from the provided transcript context.
If the context is insufficient, say: This information is not available in the provided context.

{context}
Question: {question}
""",
        input_variables=["context", "question"],
    )

    def _format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    chain = (
        RunnableParallel(
            {
                "context": retriever | RunnableLambda(_format_docs),
                "question": RunnablePassthrough(),
            }
        )
        | prompt
        | _get_model()
        | StrOutputParser()
    )
    return chain.invoke(question)

from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda, RunnableLambda, RunnableParallel, RunnablePassthrough, RunnablePassthrough
from langchain_huggingface import ChatHuggingFace, HuggingFaceEmbeddings, HuggingFaceEndpoint
from langchain_huggingface.embeddings import HuggingFaceEmbeddings
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate

import streamlit as st
from dotenv import load_dotenv

load_dotenv()
llm = HuggingFaceEndpoint(
    repo_id = 'meta-llama/Llama-3.3-70B-Instruct',
    task = 'text-generation',
    temperature=0.5
)
model = ChatHuggingFace(llm=llm)

# Step 1: Fetch YouTube Transcript
import re

def extract_video_id(url):
    pattern = r"(?:v=|youtu.be/)([a-zA-Z0-9_-]+)"
    match = re.search(pattern, url)
    return match.group(1)


#take the video URL as input and extract the video ID
yt_link = input("Enter YouTube video URL: ")

video_id = extract_video_id(yt_link)  # Extract ID from full URL

try:
    api = YouTubeTranscriptApi()
    transcript_data = api.fetch(video_id)

    # Flatten it to plain text
    transcript = " ".join(snippet.text for snippet in transcript_data)
    print(transcript)

except TranscriptsDisabled:
    print("No captions available for this video.")
    exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    exit(1)

# Step 2: Split Transcript into Chunks
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_text(transcript)

# Step 3: Create Vector Store
embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5"
)

vector_store = FAISS.from_texts(chunks, embeddings)

# Step 4: Define Prompt Template
prompt_template = PromptTemplate(
    input_variables=["query"],
    template="Based on the YouTube video transcript, answer the following question: {query}"
)

#retrieve relevant chunks from the vector store based on the user query
retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 4})

#prompt the LLM with the retrieved chunks and the user query
prompt = PromptTemplate(
    template="""
      You are a helpful assistant.
      Answer ONLY from the provided transcript context.
      If the context is insufficient, just say This information is not available in the provided context.

      {context}
      Question: {question}
    """,
    input_variables = ['context', 'question']
)

#ask   question about video

question          = input("Enter your question: ")
retrieved_docs    = retriever.invoke(question)

#store answer from query
context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)

final_prompt = prompt.invoke({"context": context_text, "question": question})

answer = model.invoke(final_prompt)
print(answer.content)

#build a chain to automate the process
def format_docs(retrieved_docs):
  context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
  return context_text

parallel_chain = RunnableParallel({
    'context': retriever | RunnableLambda(format_docs),
    'question': RunnablePassthrough()
})
parser = StrOutputParser()

while True:
    user_query = input("Enter your question (or 'exit' to quit): ")
    if user_query.lower() == 'exit':
        break
    final_chain = parallel_chain | prompt | model | parser

    result = final_chain.invoke(user_query)

    print(result)
    
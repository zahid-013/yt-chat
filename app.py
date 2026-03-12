import gradio as gr
from ytchat import process_youtube_video, answer_question

def chat_interface(video_url_or_id, question):
    """Simple Gradio interface"""
    try:
        # Process video
        context = process_youtube_video(video_url_or_id)
        
        # Answer question
        answer = answer_question(question, context)
        
        return answer
    except Exception as e:
        return f"Error: {str(e)}"

# Create interface
demo = gr.Interface(
    fn=chat_interface,
    inputs=[
        gr.Textbox(label="YouTube URL or Video ID"),
        gr.Textbox(label="Ask a question")
    ],
    outputs=gr.Textbox(label="Answer"),
    title="YouTube RAG Chatbot",
    description="Ask questions about YouTube videos"
)

if __name__ == "__main__":
    demo.launch()
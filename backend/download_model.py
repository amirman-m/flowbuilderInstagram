# Script to pre-download the model during Docker build
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

# Define model name
model_name = "Mike0307/multilingual-e5-language-detection"

# Pre-download and cache the model
print(f"Pre-downloading model: {model_name}")
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name).to("cpu")

# Initialize pipeline to ensure all components are cached
nlp = pipeline(
    task="text-classification",
    model=model,
    tokenizer=tokenizer,
    return_all_scores=False,
)

print(f"Model {model_name} successfully downloaded and cached")

from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer
model = M2M100ForConditionalGeneration.from_pretrained("facebook/m2m100_418M")
tokenizer = M2M100Tokenizer.from_pretrained("facebook/m2m100_418M")

print(f"Model {model} successfully downloaded and cached")
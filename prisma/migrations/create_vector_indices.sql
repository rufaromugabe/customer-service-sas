-- This migration file adds vector indices to improve performance of vector similarity searches

-- Create a vector index on the todos.embedding column
CREATE INDEX IF NOT EXISTS todos_embedding_idx ON public.todos USING ivfflat (embedding vector_l2_ops)
WHERE embedding IS NOT NULL;

-- Create a vector index on the messages.embedding column
CREATE INDEX IF NOT EXISTS messages_embedding_idx ON public.messages USING ivfflat (embedding vector_l2_ops)
WHERE embedding IS NOT NULL;

-- Create a vector index on the documents.embedding column
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents USING ivfflat (embedding vector_l2_ops)
WHERE embedding IS NOT NULL;

-- Add metadata to help with query planning for vector searches
ANALYZE public.todos;
ANALYZE public.messages;
ANALYZE public.documents;

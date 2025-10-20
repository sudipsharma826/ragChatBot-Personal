export const EMBEDDINGS_SQL = `
-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the documents table for storing embeddings
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding VECTOR(384), -- Using 384 dimensions for BAAI/bge-small-en-v1.5
    type VARCHAR(50),
    title VARCHAR(255),
    keywords TEXT,
    features TEXT[],
    skills TEXT[],
    liveUrl TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on the embedding column for faster similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create the match_documents function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(384),
    match_threshold FLOAT DEFAULT 0.75,
    match_count INT DEFAULT 5
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    similarity FLOAT,
    type VARCHAR(50),
    title VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        (1 - (d.embedding <=> query_embedding)) AS similarity,
        d.type,
        d.title
    FROM documents d
    WHERE (1 - (d.embedding <=> query_embedding)) > match_threshold
    ORDER BY (1 - (d.embedding <=> query_embedding)) DESC
    LIMIT match_count;
END;
$$;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for easier querying
CREATE OR REPLACE VIEW documents_view AS
SELECT
    id,
    content,
    embedding,
    type,
    title,
    keywords,
    features,
    skills,
    liveUrl,
    metadata,
    created_at,
    updated_at
FROM documents;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO your_user;
-- GRANT EXECUTE ON FUNCTION match_documents TO your_user;
`;

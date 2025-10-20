// User SQL Queries
// CREATE TABLE verified_users (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   email TEXT UNIQUE NOT NULL,
//   verified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
// );

//and
// ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
// -- Create policy to allow all operations (for simplicity - adjust for production)
// CREATE POLICY "Allow all operations" ON verified_users
// FOR ALL USING (true);


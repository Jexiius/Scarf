process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-key';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/scarf';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-with-32-characters!!!';

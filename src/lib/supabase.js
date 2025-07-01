import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Create client only if we have the credentials
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// FREE Embedding Generation Function
export const generateFreeEmbedding = (text, dimensionSize = 384) => {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  const hashWord = (word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
  
  const embedding = new Array(dimensionSize).fill(0);
  const wordFreq = {};
  
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  Object.entries(wordFreq).forEach(([word, freq]) => {
    const baseIndex = hashWord(word) % dimensionSize;
    for (let i = 0; i < 3; i++) {
      const index = (baseIndex + i * 13) % dimensionSize;
      embedding[index] += freq * (1 / (i + 1));
    }
    
    // Boost education-related terms
    const educationTerms = ['equation', 'formula', 'theorem', 'solve', 'calculate', 'proof'];
    if (educationTerms.includes(word.toLowerCase())) {
      embedding[50] += 2;
    }
  });
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return embedding.map(val => val / magnitude);
  }
  
  return embedding;
};

// Cosine similarity for vector comparison
export const cosineSimilarity = (vec1, vec2) => {
  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  return dotProduct;
};

// Database functions
export async function getExamTypes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('exam_types')
    .select('*')
    .order('name');
  return data || [];
}

export async function getExamBoards() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('exam_boards')
    .select('*')
    .order('name');
  return data || [];
}

export async function getSubjects() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name');
  return data || [];
}

export async function addExamType(name, code) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('exam_types')
    .insert({ name, code })
    .select()
    .single();
  return data;
}

export async function addExamBoard(name, code) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('exam_boards')
    .insert({ name, code })
    .select()
    .single();
  return data;
}

export async function addSubject(name, code) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('subjects')
    .insert({ name, code })
    .select()
    .single();
  return data;
}

export async function uploadDocument(chatKey, file) {
  if (!supabase) return null;
  
  try {
    const content = await file.text();
    
    // Create document
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        chat_key: chatKey,
        name: file.name,
        content: content,
        size: file.size,
        type: file.type || 'text/plain'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Create chunks with embeddings
    const chunks = createChunks(content);
    const chunkRecords = chunks.map((chunk, idx) => ({
      document_id: document.id,
      chunk_index: idx,
      content: chunk,
      embedding: generateFreeEmbedding(chunk)
    }));
    
    await supabase.from('document_chunks').insert(chunkRecords);
    
    return document;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export async function getDocuments(chatKey) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('chat_key', chatKey)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function deleteDocument(id) {
  if (!supabase) return;
  await supabase
    .from('documents')
    .delete()
    .eq('id', id);
}

export async function searchDocuments(chatKey, query) {
  if (!supabase) return [];
  
  try {
    const queryEmbedding = generateFreeEmbedding(query);
    
    const { data, error } = await supabase.rpc('search_documents', {
      query_embedding: queryEmbedding,
      chat_key_filter: chatKey,
      match_threshold: 0.7,
      match_count: 5
    });
    
    return data || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function createChunks(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  
  return chunks;
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Simple embedding function (no API needed)
export function generateFreeEmbedding(text) {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(384).fill(0);
  
  // Create a simple but effective embedding
  words.forEach((word, index) => {
    if (word.length > 2) {
      // Hash word to multiple positions
      for (let i = 0; i < word.length; i++) {
        const pos = (word.charCodeAt(i) * (i + 1)) % 384;
        embedding[pos] += 1 / (index + 1); // Reduce weight for later words
      }
    }
  });
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  
  return dotProduct; // Already normalized
}

// Document operations
export async function uploadDocument(subjectKey, document) {
  if (!supabase) {
    // Local storage fallback
    const docs = JSON.parse(localStorage.getItem(`docs_${subjectKey}`) || '[]');
    docs.push(document);
    localStorage.setItem(`docs_${subjectKey}`, JSON.stringify(docs));
    return document;
  }
  
  try {
    // Insert document
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        name: document.name,
        content: document.content,
        subject_key: subjectKey,
        size: document.size,
        type: document.type
      })
      .select()
      .single();
    
    if (docError) throw docError;
    
    // Create chunks with embeddings
    const chunks = [];
    const chunkSize = 1000; // Larger chunks for better context
    
    for (let i = 0; i < document.content.length; i += chunkSize - 200) { // Overlap
      const chunkText = document.content.slice(i, i + chunkSize);
      chunks.push({
        document_id: docData.id,
        content: chunkText,
        embedding: generateFreeEmbedding(chunkText),
        metadata: {
          subject_key: subjectKey,
          document_name: document.name,
          position: i
        }
      });
    }
    
    if (chunks.length > 0) {
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(chunks);
      
      if (chunkError) console.error('Chunk insert error:', chunkError);
    }
    
    return docData;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

export async function searchDocuments(subjectKey, query, limit = 5) {
  if (!supabase) {
    // Local search fallback
    const docs = JSON.parse(localStorage.getItem(`docs_${subjectKey}`) || '[]');
    const queryEmbedding = generateFreeEmbedding(query);
    
    return docs
      .map(doc => ({
        ...doc,
        relevance: cosineSimilarity(queryEmbedding, doc.embedding || generateFreeEmbedding(doc.content))
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .filter(doc => doc.relevance > 0.1);
  }
  
  try {
    const queryEmbedding = generateFreeEmbedding(query);
    
    // Try vector search first
    const { data, error } = await supabase.rpc('search_documents', {
      query_embedding: queryEmbedding,
      subject_key: subjectKey,
      match_threshold: 0.5,
      match_count: limit
    });
    
    if (error) {
      console.error('Vector search error:', error);
      // Fallback to text search
      const { data: textResults, error: textError } = await supabase
        .from('document_chunks')
        .select('*, documents!inner(name)')
        .eq('metadata->subject_key', subjectKey)
        .textSearch('content', query)
        .limit(limit);
      
      if (textError) throw textError;
      return textResults || [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export async function getDocuments(subjectKey) {
  if (!supabase) {
    return JSON.parse(localStorage.getItem(`docs_${subjectKey}`) || '[]');
  }
  
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('subject_key', subjectKey)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get documents error:', error);
    return [];
  }
}

export async function deleteDocument(documentId, subjectKey) {
  if (!supabase) {
    const docs = JSON.parse(localStorage.getItem(`docs_${subjectKey}`) || '[]');
    const filtered = docs.filter(doc => doc.id !== documentId);
    localStorage.setItem(`docs_${subjectKey}`, JSON.stringify(filtered));
    return;
  }
  
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);
  
  if (error) throw error;
}

// Database structure operations
export async function getExamTypes() {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('exam_types')
      .select('*')
      .order('level');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching exam types:', error);
    return [];
  }
}

export async function getExamBoards() {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('exam_boards')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching exam boards:', error);
    return [];
  }
}

export async function getSubjects() {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return [];
  }
}

export async function addExamType(examType) {
  if (!supabase) throw new Error('Supabase not connected');
  
  const { data, error } = await supabase
    .from('exam_types')
    .insert([examType])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function addExamBoard(board) {
  if (!supabase) throw new Error('Supabase not connected');
  
  const { data, error } = await supabase
    .from('exam_boards')
    .insert([board])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function addSubject(subject) {
  if (!supabase) throw new Error('Supabase not connected');
  
  const { data, error } = await supabase
    .from('subjects')
    .insert([subject])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

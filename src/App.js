import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Loader2,
  RefreshCw,
  Square,
  Upload,
  FileText,
  Trash2,
  Database,
  Check,
  X,
  Plus,
  Settings,
  Sparkles
} from 'lucide-react';
import { 
  supabase, 
  generateFreeEmbedding, 
  cosineSimilarity,
  getExamTypes,
  getExamBoards,
  getSubjects,
  addExamType,
  addExamBoard,
  addSubject,
  uploadDocument,
  getDocuments,
  deleteDocument,
  searchDocuments
} from './lib/supabase';

// Configuration
const config = {
  useSupabase: !!supabase,
  useGemini: !!process.env.REACT_APP_GEMINI_API_KEY,
  geminiApiKey: process.env.REACT_APP_GEMINI_API_KEY || ''
};

function App() {
  // Selection state
  const [selectedType, setSelectedType] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // UI state
  const [adminMode, setAdminMode] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  
  // Structure data
  const [examTypes, setExamTypes] = useState([
    { id: '1', name: 'Class 10', code: 'class10' },
    { id: '2', name: 'Class 12', code: 'class12' }
  ]);
  
  const [examBoards, setExamBoards] = useState([
    { id: '1', name: 'CBSE', code: 'cbse' },
    { id: '2', name: 'ICSE', code: 'icse' },
    { id: '3', name: 'State Board', code: 'state' }
  ]);
  
  const [subjects, setSubjects] = useState([
    { id: '1', name: 'Mathematics', code: 'math' },
    { id: '2', name: 'Science', code: 'science' },
    { id: '3', name: 'English', code: 'english' },
    { id: '4', name: 'Physics', code: 'physics' },
    { id: '5', name: 'Chemistry', code: 'chemistry' }
  ]);
  
  // Add item modals
  const [showAddType, setShowAddType] = useState(false);
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Document state
  const [documents, setDocuments] = useState({});
  
  // Refs
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Get current chat key
  const getChatKey = useCallback(() => {
    if (!selectedType || !selectedBoard || !selectedSubject) return null;
    const type = examTypes.find(t => t.id === selectedType);
    const board = examBoards.find(b => b.id === selectedBoard);
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!type || !board || !subject) return null;
    return `${type.code}-${board.code}-${subject.code}`;
  }, [selectedType, selectedBoard, selectedSubject, examTypes, examBoards, subjects]);
  
  // Get current messages
  const getMessages = useCallback(() => {
    const key = getChatKey();
    return key ? (messages[key] || []) : [];
  }, [getChatKey, messages]);
  
  // Get current documents
  const getCurrentDocuments = useCallback(() => {
    const key = getChatKey();
    return key ? (documents[key] || []) : [];
  }, [getChatKey, documents]);
  
  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (config.useSupabase) {
        try {
          const [types, boards, subjs] = await Promise.all([
            getExamTypes(),
            getExamBoards(),
            getSubjects()
          ]);
          
          if (types.length > 0) setExamTypes(types);
          if (boards.length > 0) setExamBoards(boards);
          if (subjs.length > 0) setSubjects(subjs);
          
          setSupabaseConnected(true);
        } catch (error) {
          console.error('Failed to load from Supabase:', error);
        }
      }
    };
    
    loadData();
  }, []);
  
  // Load documents when selection changes
  useEffect(() => {
    const loadDocs = async () => {
      const key = getChatKey();
      if (key && config.useSupabase) {
        const docs = await getDocuments(key);
        if (docs) {
          setDocuments(prev => ({ ...prev, [key]: docs }));
        }
      }
    };
    
    loadDocs();
  }, [getChatKey]);
  
  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Reset selections
  useEffect(() => {
    setSelectedBoard('');
    setSelectedSubject('');
  }, [selectedType]);
  
  useEffect(() => {
    setSelectedSubject('');
  }, [selectedBoard]);
  
  // Add exam type
  const handleAddExamType = async () => {
    if (!newItemName.trim()) return;
    
    const code = newItemName.toLowerCase().replace(/\s+/g, '_');
    
    if (config.useSupabase) {
      const newType = await addExamType(newItemName, code);
      if (newType) {
        setExamTypes([...examTypes, newType]);
      }
    } else {
      const newType = {
        id: Date.now().toString(),
        name: newItemName,
        code
      };
      setExamTypes([...examTypes, newType]);
    }
    
    setNewItemName('');
    setShowAddType(false);
  };
  
  // Add exam board
  const handleAddExamBoard = async () => {
    if (!newItemName.trim()) return;
    
    const code = newItemName.toLowerCase().replace(/\s+/g, '_');
    
    if (config.useSupabase) {
      const newBoard = await addExamBoard(newItemName, code);
      if (newBoard) {
        setExamBoards([...examBoards, newBoard]);
      }
    } else {
      const newBoard = {
        id: Date.now().toString(),
        name: newItemName,
        code
      };
      setExamBoards([...examBoards, newBoard]);
    }
    
    setNewItemName('');
    setShowAddBoard(false);
  };
  
  // Add subject
  const handleAddSubject = async () => {
    if (!newItemName.trim()) return;
    
    const code = newItemName.toLowerCase().replace(/\s+/g, '_');
    
    if (config.useSupabase) {
      const newSubject = await addSubject(newItemName, code);
      if (newSubject) {
        setSubjects([...subjects, newSubject]);
      }
    } else {
      const newSubject = {
        id: Date.now().toString(),
        name: newItemName,
        code
      };
      setSubjects([...subjects, newSubject]);
    }
    
    setNewItemName('');
    setShowAddSubject(false);
  };
  
  // Handle file upload
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const key = getChatKey();
    if (!key) return;
    
    for (const file of files) {
      try {
        if (config.useSupabase) {
          const doc = await uploadDocument(key, file);
          if (doc) {
            setDocuments(prev => ({
              ...prev,
              [key]: [...(prev[key] || []), doc]
            }));
          }
        } else {
          // Local storage
          const content = await file.text();
          const doc = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            content: content,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            embedding: generateFreeEmbedding(content)
          };
          
          setDocuments(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), doc]
          }));
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
    
    e.target.value = '';
  };
  
  // Delete document
  const handleDeleteDocument = async (docId) => {
    const key = getChatKey();
    if (!key) return;
    
    if (config.useSupabase) {
      await deleteDocument(docId);
    }
    
    setDocuments(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(doc => doc.id !== docId)
    }));
  };
  
  // Search documents
  const searchDocumentsLocal = async (query, docs) => {
    if (!docs || docs.length === 0) return [];
    
    if (config.useSupabase) {
      const results = await searchDocuments(getChatKey(), query);
      return results;
    }
    
    // Local search with embeddings
    const queryEmbedding = generateFreeEmbedding(query);
    
    const scoredDocs = docs.map(doc => {
      const docEmbedding = doc.embedding || generateFreeEmbedding(doc.content);
      const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
      return { ...doc, score: similarity, embedding: docEmbedding };
    });
    
    return scoredDocs
      .filter(doc => doc.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };
  
  // Append message
  const append = useCallback((message) => {
    const key = getChatKey();
    if (!key) return;
    
    setMessages(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), message]
    }));
  }, [getChatKey]);
  
  // Handle submit
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const key = getChatKey();
    if (!key) return;
    
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };
    
    append(userMessage);
    setInput('');
    setIsLoading(true);
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Get relevant documents
      const docs = getCurrentDocuments();
      const relevantDocs = await searchDocumentsLocal(userMessage.content, docs);
      
      // Build context
      const typeInfo = examTypes.find(t => t.id === selectedType);
      const boardInfo = examBoards.find(b => b.id === selectedBoard);
      const subjectInfo = subjects.find(s => s.id === selectedSubject);
      
      let context = '';
      if (relevantDocs.length > 0) {
        context = `\nContext from documents:\n${relevantDocs.map(doc => 
          `${doc.document_name || doc.name}: ${doc.content.substring(0, 500)}...`
        ).join('\n\n')}\n\n`;
      }
      
      // Build prompt
      const prompt = `You are an exam preparation AI for ${boardInfo.name} ${typeInfo.name} ${subjectInfo.name}.

${context}Question: ${userMessage.content}

IMPORTANT: Provide ONLY the direct answer to the question. No explanations, no study tips, no encouragement - just the specific answer requested. Be concise and precise.`;

      let response = '';
      
      // Try Gemini API if available
      if (config.useGemini && config.geminiApiKey) {
        try {
          const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
          
          if (geminiResponse.ok) {
            const data = await geminiResponse.json();
            response = data.candidates[0].content.parts[0].text;
          }
        } catch (error) {
          console.error('Gemini API error:', error);
        }
      }
      
      // Fallback response
      if (!response) {
        response = `Based on ${subjectInfo.name} for ${typeInfo.name}: The answer would be provided here when the AI API is connected. ${relevantDocs.length > 0 ? 'Found relevant information in your documents.' : 'No relevant documents found.'}`;
      }
      
      // Add assistant message
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        metadata: {
          docsUsed: relevantDocs.length,
          docNames: relevantDocs.map(d => d.document_name || d.name)
        }
      };
      
      append(assistantMessage);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error:', error);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  // Handle input change
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };
  
  // Reload last response
  const reload = () => {
    const messages = getMessages();
    if (messages.length < 2) return;
    
    const key = getChatKey();
    if (!key) return;
    
    setMessages(prev => ({
      ...prev,
      [key]: messages.slice(0, -1)
    }));
    
    const lastUserMessage = messages[messages.length - 2];
    if (lastUserMessage?.role === 'user') {
      setInput(lastUserMessage.content);
      setTimeout(() => handleSubmit(), 100);
    }
  };
  
  // Stop generation
  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };
  
  const currentMessages = getMessages();
  const currentDocs = getCurrentDocuments();
  const hasSelection = selectedType && selectedBoard && selectedSubject;
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">ExamPrep AI</h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Selection Dropdowns */}
            <div className="flex items-center gap-3">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Type</option>
                {examTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              
              <select
                value={selectedBoard}
                onChange={(e) => setSelectedBoard(e.target.value)}
                disabled={!selectedType}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Select Board</option>
                {examBoards.map(board => (
                  <option key={board.id} value={board.id}>{board.name}</option>
                ))}
              </select>
              
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={!selectedBoard}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Select Subject</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setAdminMode(!adminMode)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Admin Settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Admin Sidebar */}
        {adminMode && (
          <aside className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            <h2 className="font-semibold text-gray-900 mb-4">Admin Settings</h2>
            
            {/* Add Items */}
            <div className="space-y-4 mb-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Exam Types</span>
                  <button
                    onClick={() => setShowAddType(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {examTypes.map(type => (
                    <div key={type.id} className="text-sm text-gray-600">{type.name}</div>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Boards</span>
                  <button
                    onClick={() => setShowAddBoard(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {examBoards.map(board => (
                    <div key={board.id} className="text-sm text-gray-600">{board.name}</div>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Subjects</span>
                  <button
                    onClick={() => setShowAddSubject(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {subjects.map(subject => (
                    <div key={subject.id} className="text-sm text-gray-600">{subject.name}</div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Document Management */}
            {hasSelection && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents
                </h3>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <Upload className="w-4 h-4" />
                  Upload Files
                </button>
                
                {currentDocs.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {currentDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div className="flex-1 truncate">
                          <div className="font-medium truncate">{doc.name}</div>
                          <div className="text-xs text-gray-500">
                            {(doc.size / 1024).toFixed(1)}KB
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-600 hover:text-red-700 ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center">No documents uploaded</p>
                )}
              </div>
            )}
            
            {/* Database Status */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center gap-2 text-sm mb-2">
                <Database className={`w-4 h-4 ${supabaseConnected ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-gray-600">
                  {supabaseConnected ? 'Supabase Connected' : 'Local Storage (Dev Mode)'}
                </span>
              </div>
              
              {!config.useSupabase && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs">
                  <p className="font-semibold text-blue-900 mb-1">Database not configured</p>
                  <p className="text-blue-800">Using local storage with FREE embeddings</p>
                </div>
              )}
            </div>
          </aside>
        )}
        
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col bg-white">
          {!hasSelection ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to ExamPrep AI</h2>
                <p className="text-gray-600">Select your exam type, board, and subject to start getting direct answers to your questions.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto">
                  {currentMessages.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">Ask any question about {subjects.find(s => s.id === selectedSubject)?.name}</p>
                      <p className="text-sm text-gray-400">I'll provide direct, specific answers only.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <div>{message.content}</div>
                            {message.metadata?.docsUsed > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                📄 Used {message.metadata.docsUsed} document{message.metadata.docsUsed > 1 ? 's' : ''}: {message.metadata.docNames.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-lg px-4 py-2">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Input */}
              <div className="border-t border-gray-200 p-4">
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="Ask a specific question..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                    {isLoading ? (
                      <button
                        onClick={stop}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Square className="w-5 h-5" />
                      </button>
                    ) : currentMessages.length > 0 ? (
                      <button
                        onClick={reload}
                        className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    ) : null}
                    <button
                      onClick={handleSubmit}
                      disabled={!input.trim() || isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      
      {/* Add Type Modal */}
      {showAddType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Exam Type</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., Class 11"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddType(false);
                  setNewItemName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExamType}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Board Modal */}
      {showAddBoard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Exam Board</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., IB"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddBoard(false);
                  setNewItemName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExamBoard}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Subject</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., Biology"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddSubject(false);
                  setNewItemName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubject}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

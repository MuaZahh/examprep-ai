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

const config = {
  useSupabase: true,
  useGemini: true,
  geminiApiKey: process.env.REACT_APP_GEMINI_API_KEY || '',
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || '',
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || ''
};

// Gemini API helper function
async function callGeminiAPI(prompt) {
  if (!config.geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        },
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export default function ExamPrepAI() {
  // State for UI
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // State for exam structure
  const [examTypes, setExamTypes] = useState([
    { id: '1', name: 'Class 10', code: 'class10', level: 10 },
    { id: '2', name: 'Class 12', code: 'class12', level: 12 }
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
    { id: '4', name: 'Social Studies', code: 'social' },
    { id: '5', name: 'Computer Science', code: 'cs' }
  ]);

  // Selection state
  const [selectedType, setSelectedType] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Chat state
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Documents state
  const [documents, setDocuments] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Database state
  const [dbConnected, setDbConnected] = useState(false);
  const [dbSyncing, setDbSyncing] = useState(false);

  // Helper functions
  const getCurrentSubjectKey = useCallback(() => {
    if (!selectedType || !selectedBoard || !selectedSubject) return null;
    return `${selectedType}-${selectedBoard}-${selectedSubject}`;
  }, [selectedType, selectedBoard, selectedSubject]);

  const getSubjectInfo = useCallback(() => {
    if (!selectedType || !selectedBoard || !selectedSubject) return null;
    const type = examTypes.find(t => t.code === selectedType);
    const board = examBoards.find(b => b.code === selectedBoard);
    const subject = subjects.find(s => s.code === selectedSubject);
    return { type, board, subject };
  }, [selectedType, selectedBoard, selectedSubject, examTypes, examBoards, subjects]);

  const getCurrentMessages = useCallback(() => {
    const key = getCurrentSubjectKey();
    return key ? (messages[key] || []) : [];
  }, [getCurrentSubjectKey, messages]);

  const getCurrentDocuments = useCallback(() => {
    const key = getCurrentSubjectKey();
    return key ? (documents[key] || []) : [];
  }, [getCurrentSubjectKey, documents]);

  // Load data from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      if (!config.useSupabase || !config.supabaseUrl || !config.supabaseAnonKey) return;
      
      setDbSyncing(true);
      try {
        const [types, boards, subjs] = await Promise.all([
          getExamTypes(),
          getExamBoards(),
          getSubjects()
        ]);
        
        if (types.length > 0) setExamTypes(types);
        if (boards.length > 0) setExamBoards(boards);
        if (subjs.length > 0) setSubjects(subjs);
        
        setDbConnected(true);
      } catch (error) {
        console.error('Failed to load from Supabase:', error);
        setDbConnected(false);
      } finally {
        setDbSyncing(false);
      }
    };
    
    loadData();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle adding new items
  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemCode.trim()) return;
    
    setIsLoading(true);
    try {
      const newItem = {
        id: Date.now().toString(),
        name: newItemName.trim(),
        code: newItemCode.trim().toLowerCase().replace(/\s+/g, '-')
      };
      
      if (addModalType === 'type') {
        newItem.level = parseInt(newItemName.match(/\d+/)?.[0] || '10');
        setExamTypes([...examTypes, newItem]);
        if (dbConnected) await addExamType(newItem);
      } else if (addModalType === 'board') {
        setExamBoards([...examBoards, newItem]);
        if (dbConnected) await addExamBoard(newItem);
      } else if (addModalType === 'subject') {
        setSubjects([...subjects, newItem]);
        if (dbConnected) await addSubject(newItem);
      }
      
      setShowAddModal(false);
      setNewItemName('');
      setNewItemCode('');
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle document upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    const subjectKey = getCurrentSubjectKey();
    if (!subjectKey || files.length === 0) return;
    
    setUploadingDocs(true);
    try {
      const newDocs = [];
      
      for (const file of files) {
        if (file.type === 'text/plain' || file.name.endsWith('.md')) {
          const content = await file.text();
          const doc = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            content: content,
            size: file.size,
            uploadDate: new Date().toLocaleDateString(),
            type: file.type,
            embedding: generateFreeEmbedding(content)
          };
          
          newDocs.push(doc);
          if (dbConnected) {
            await uploadDocument(subjectKey, doc);
          }
        }
      }
      
      setDocuments(prev => ({
        ...prev,
        [subjectKey]: [...(prev[subjectKey] || []), ...newDocs]
      }));
    } catch (error) {
      console.error('Failed to upload documents:', error);
      alert('Failed to upload some documents. Please try again.');
    } finally {
      setUploadingDocs(false);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (docId) => {
    const subjectKey = getCurrentSubjectKey();
    if (!subjectKey) return;
    
    try {
      setDocuments(prev => ({
        ...prev,
        [subjectKey]: prev[subjectKey].filter(doc => doc.id !== docId)
      }));
      
      if (dbConnected) {
        await deleteDocument(docId);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  // Search documents for relevant content
  const searchRelevantDocuments = useCallback(async (query) => {
    const subjectKey = getCurrentSubjectKey();
    if (!subjectKey) return [];
    
    const docs = getCurrentDocuments();
    if (docs.length === 0) return [];
    
    try {
      if (dbConnected) {
        return await searchDocuments(subjectKey, query);
      } else {
        // Local search with embeddings
        const queryEmbedding = generateFreeEmbedding(query);
        const results = docs.map(doc => ({
          ...doc,
          relevance: cosineSimilarity(queryEmbedding, doc.embedding || {})
        }))
        .filter(doc => doc.relevance > 0.1)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 5);
        
        return results;
      }
    } catch (error) {
      console.error('Document search failed:', error);
      return [];
    }
  }, [getCurrentSubjectKey, getCurrentDocuments, dbConnected]);

  // AI message handling
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !getCurrentSubjectKey() || isGenerating) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };
    
    const subjectKey = getCurrentSubjectKey();
    setMessages(prev => ({
      ...prev,
      [subjectKey]: [...(prev[subjectKey] || []), userMessage]
    }));
    setInput('');
    setIsGenerating(true);
    
    try {
      // Search for relevant documents
      const relevantDocs = await searchRelevantDocuments(userMessage.content);
      const docContext = relevantDocs.length > 0
        ? '\n\nRelevant documents found:\n' + relevantDocs.map(doc => 
            `Document: ${doc.name}\nContent: ${doc.content.substring(0, 500)}...`
          ).join('\n\n')
        : '';
      
      // Get subject info
      const subjectInfo = getSubjectInfo();
      
      // Build the prompt
      const conversationHistory = messages[subjectKey] || [];
      const prompt = `You are an AI tutor helping with ${subjectInfo?.subject?.name} for ${subjectInfo?.type?.name} ${subjectInfo?.board?.name} board.

Previous conversation:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

${docContext}

Student question: ${userMessage.content}

Important: Provide ONLY the direct answer to the question. No greetings, no explanations about what you'll do, no closing remarks. Just the answer itself. Be specific and accurate for the ${subjectInfo?.board?.name} ${subjectInfo?.type?.name} curriculum.`;

      // Call Gemini API
      let response;
      if (config.useGemini && config.geminiApiKey) {
        try {
          response = await callGeminiAPI(prompt);
        } catch (error) {
          console.error('Gemini API failed:', error);
          response = `I apologize, but I'm having trouble connecting to the AI service. Please check your Gemini API key configuration or try again later.`;
        }
      } else {
        response = `Please configure your Gemini API key to get AI-powered responses. Add REACT_APP_GEMINI_API_KEY to your environment variables.`;
      }
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        metadata: {
          documentsUsed: relevantDocs.length,
          documentNames: relevantDocs.map(d => d.name)
        }
      };
      
      setMessages(prev => ({
        ...prev,
        [subjectKey]: [...prev[subjectKey], assistantMessage]
      }));
    } catch (error) {
      console.error('Failed to generate response:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => ({
        ...prev,
        [subjectKey]: [...prev[subjectKey], errorMessage]
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const reload = async () => {
    const subjectKey = getCurrentSubjectKey();
    if (!subjectKey) return;
    
    const msgs = messages[subjectKey] || [];
    if (msgs.length < 2) return;
    
    const lastUserMessage = [...msgs].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;
    
    // Remove last assistant message
    setMessages(prev => ({
      ...prev,
      [subjectKey]: prev[subjectKey].slice(0, -1)
    }));
    
    // Resubmit
    setInput(lastUserMessage.content);
    setTimeout(() => handleSubmit(), 100);
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const append = (message) => {
    const subjectKey = getCurrentSubjectKey();
    if (!subjectKey) return;
    
    setMessages(prev => ({
      ...prev,
      [subjectKey]: [...(prev[subjectKey] || []), message]
    }));
  };

  // Quick action handlers
  const quickActions = [
    "What are the important formulas?",
    "Explain this concept simply",
    "Give me practice questions",
    "What are common mistakes to avoid?"
  ];

  const handleQuickAction = (action) => {
    setInput(action);
    setTimeout(() => handleSubmit(), 100);
  };

  // Computed values
  const currentMessages = getCurrentMessages();
  const subjectInfo = getSubjectInfo();
  const hasSelection = !!(selectedType && selectedBoard && selectedSubject);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">ExamPrep AI</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setSelectedBoard('');
                setSelectedSubject('');
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Type</option>
              {examTypes.map(type => (
                <option key={type.id} value={type.code}>{type.name}</option>
              ))}
            </select>
            
            <select
              value={selectedBoard}
              onChange={(e) => {
                setSelectedBoard(e.target.value);
                setSelectedSubject('');
              }}
              disabled={!selectedType}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Select Board</option>
              {examBoards.map(board => (
                <option key={board.id} value={board.code}>{board.name}</option>
              ))}
            </select>
            
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedBoard}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Select Subject</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.code}>{subject.name}</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex relative">
        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-10 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Admin Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Database Status */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Database Status</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-600">
                    {dbConnected ? 'Supabase Connected' : 'Local Storage (Dev Mode)'}
                  </span>
                </div>
                {config.geminiApiKey && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600">Gemini AI Connected</span>
                  </div>
                )}
              </div>
              
              {/* Add Items */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Exam Types</h3>
                    <button
                      onClick={() => {
                        setAddModalType('type');
                        setShowAddModal(true);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {examTypes.map(type => (
                      <div key={type.id} className="text-sm text-gray-600 px-2 py-1 bg-gray-50 rounded">
                        {type.name}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Exam Boards</h3>
                    <button
                      onClick={() => {
                        setAddModalType('board');
                        setShowAddModal(true);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {examBoards.map(board => (
                      <div key={board.id} className="text-sm text-gray-600 px-2 py-1 bg-gray-50 rounded">
                        {board.name}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Subjects</h3>
                    <button
                      onClick={() => {
                        setAddModalType('subject');
                        setShowAddModal(true);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {subjects.map(subject => (
                      <div key={subject.id} className="text-sm text-gray-600 px-2 py-1 bg-gray-50 rounded">
                        {subject.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Document Management */}
              {hasSelection && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Documents</h3>
                  <input
                    type="file"
                    id="doc-upload"
                    multiple
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="doc-upload"
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingDocs ? 'Uploading...' : 'Upload Documents'}
                  </label>
                  
                  <div className="mt-3 space-y-2">
                    {getCurrentDocuments().map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm text-gray-600 truncate">{doc.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Local Data Storage */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Local Data Storage</h3>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Messages: {Object.keys(messages).length} subjects</p>
                  <p>Documents: {Object.keys(documents).length} subjects</p>
                  <p>Current key: {getCurrentSubjectKey() || 'none'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        <main className="flex-1 flex flex-col">
          {!hasSelection ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Welcome to ExamPrep AI
                </h2>
                <p className="text-gray-600 mb-6">
                  Select your exam type, board, and subject to start learning
                </p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>📚 Get instant answers to your questions</p>
                  <p>📄 Upload study materials for better context</p>
                  <p>🎯 Focused preparation for your specific curriculum</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Subject Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="max-w-3xl mx-auto">
                  <h2 className="text-lg font-medium text-gray-900">
                    {subjectInfo?.type?.name} • {subjectInfo?.board?.name} • {subjectInfo?.subject?.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {getCurrentDocuments().length} documents uploaded
                  </p>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto p-4 space-y-4">
                  {currentMessages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">
                        Ready to help with {subjectInfo?.subject?.name}! Ask me anything.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {quickActions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickAction(action)}
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {currentMessages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.metadata?.documentsUsed > 0 && (
                          <p className="text-xs mt-2 opacity-70">
                            📄 Used {message.metadata.documentsUsed} document{message.metadata.documentsUsed > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isGenerating && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              {/* Input */}
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                    placeholder="Ask your question..."
                    disabled={isGenerating}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {isGenerating ? (
                    <button
                      onClick={stop}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                     Stop
                   </button>
                 ) : (
                   <button
                     onClick={handleSubmit}
                     disabled={!input.trim()}
                     className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                   >
                     <Send className="w-4 h-4" />
                     Send
                   </button>
                 )}
                 {currentMessages.length > 0 && !isGenerating && (
                   <button
                     onClick={reload}
                     className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                     title="Regenerate last response"
                   >
                     <RefreshCw className="w-5 h-5" />
                   </button>
                 )}
               </div>
             </div>
           </>
         )}
       </main>
     </div>

     {/* Add Item Modal */}
     {showAddModal && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg p-6 w-full max-w-md">
           <h3 className="text-lg font-semibold mb-4">
             Add New {addModalType === 'type' ? 'Exam Type' : addModalType === 'board' ? 'Board' : 'Subject'}
           </h3>
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Name
               </label>
               <input
                 type="text"
                 value={newItemName}
                 onChange={(e) => setNewItemName(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder={addModalType === 'type' ? 'e.g., Class 11' : addModalType === 'board' ? 'e.g., IB' : 'e.g., Physics'}
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Code
               </label>
               <input
                 type="text"
                 value={newItemCode}
                 onChange={(e) => setNewItemCode(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder={addModalType === 'type' ? 'e.g., class11' : addModalType === 'board' ? 'e.g., ib' : 'e.g., physics'}
               />
             </div>
           </div>
           <div className="flex gap-2 mt-6">
             <button
               onClick={handleAddItem}
               disabled={isLoading || !newItemName.trim() || !newItemCode.trim()}
               className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
             >
               {isLoading ? 'Adding...' : 'Add'}
             </button>
             <button
               onClick={() => {
                 setShowAddModal(false);
                 setNewItemName('');
                 setNewItemCode('');
               }}
               className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
             >
               Cancel
             </button>
           </div>
         </div>
       </div>
     )}
   </div>
 );
}
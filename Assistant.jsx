import React, { useState, useRef, useEffect } from 'react';
import { Plus, CheckSquare, Send, X, Check } from 'lucide-react';
import { supabase } from './supabaseClient';


const Assistant = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [pendingTask, setPendingTask] = useState(null);
  const [showExpensePrompt, setShowExpensePrompt] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Configuration - In production, you'd get this from your backend
  const OPENROUTER_API_KEY = "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"; // Replace with your actual API key
  const API_BASE_URL = "https://openrouter.ai/api/v1";

  const categoryMap = {
    "Food": "🍽️",
    "Transport": "🚗",
    "Shopping": "🛍️",
    "Bills": "📄",
    "Entertainment": "🎬",
    "Other": "💰"
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    loadTasks();
  }, []);

  // Mock database operations (in a real React app, these would be API calls to your backend)
  const executeQuery = async (query) => {
    // This would be replaced with actual API calls to your backend
    // For demo purposes, using mock data
    console.log("Executing query:", query);
    
    // Mock response based on query type
    if (query.toLowerCase().includes('tasks') && query.toLowerCase().includes('is_done = 0')) {
      return tasks.filter(t => !t.isDone);
    }
    if (query.toLowerCase().includes('expenses')) {
      return [
        { id: 1, text: "Lunch at restaurant", amount: 450, category: "Food", created_at: "2025-01-21" },
        { id: 2, text: "Uber ride", amount: 120, category: "Transport", created_at: "2025-01-21" }
      ];
    }
    if (query.toLowerCase().includes('memories')) {
      return [
        { id: 1, text: "Had amazing coffee at Blue Bottle", location: "Mumbai", created_at: "2025-01-20" }
      ];
    }
    return [];
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }

      // Convert Supabase data to match your component's expected format
      const formattedTasks = data.map(task => ({
        id: task.id,
        text: task.text,
        isDone: task.is_done,
        created_at: task.created_at
      }));

      setTasks(formattedTasks);
    } catch (err) {
      console.error('Unexpected error loading tasks:', err);
    }
  };

  // Real LLM integration function
 const callLLM = async (messages, temperature = 0.2) => {
  try {
    const response = await fetch("/api/llmProxy", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        temperature
      }),
    });

    if (!response.ok) {
      throw new Error(`Proxy call failed: ${response.status}`);
    }

    const data = await response.json();
    return data.content.trim();
  } catch (error) {
    console.error('LLM Proxy Error:', error);
    throw error;
  }
};

    

  const fetchMemoriesForContext = async () => {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('text, location, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching memories:", error);
      return [];
    }

    return data;
  } catch (err) {
    console.error("Unexpected error fetching memories:", err);
    return [];
  }
};

  // Main chat processing function (from your original code)
  const processUserMessage = async (userInput) => {
  const memoryContext = await fetchMemoriesForContext();

  const schema = `
TABLE: expenses
COLUMNS:
- id (UUID)
- text (string)
- amount (float)
- category (string)
- created_at (timestamp)

TABLE: tasks
COLUMNS:
- id (UUID)
- text (string)
- is_done (boolean)
- created_at (timestamp)

TABLE: memories
COLUMNS:
- id (UUID)
- text (string)
- location (string or null)
- created_at (timestamp)
`;


  const systemPrompt = `
You are a helpful assistant for a memory and expense tracking app in India.
Format currency in Indian Rupees (₹).

Here is the database schema:
${schema}

User may ask about:
- Tasks (e.g. what's pending, completed)
- Expenses (total today/yesterday/this month, by category)
- Memories (retrieved from Supabase with location and date)

Only generate safe SQLite SELECT queries. No INSERT, UPDATE, DELETE.

Context from memories:
${memoryContext.map(mem => `- ${mem.text} [${mem.location || 'no location'}] on ${mem.created_at}`).join('\n')}

If memory context isn't needed for a question, focus only on SQL result.
`;


    

    try {
      setIsLoading(true);

      // Generate SQL query
      const sqlResponse = await callLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the SQL only for this: ${userInput}` }
      ], 0.2);

      let rawSql = sqlResponse;
      if (rawSql.includes("```")) {
        const sqlLines = rawSql.split("\n");
        rawSql = sqlLines.filter(line => !line.trim().startsWith("```")).join("\n").trim();
      }

      // Execute query (mock execution for demo)
      const queryResults = await executeQuery(rawSql);
      const resultStr = queryResults.length > 0 
        ? queryResults.map(row => JSON.stringify(row)).join('\n')
        : "NO_RESULTS";

      // Generate natural response
      const replyResponse = await callLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: `User asked: ${userInput}\nSQL result: ${resultStr}\nNow respond naturally with Indian Rupee (₹) format for any amounts.` }
      ], 0.3);

      return replyResponse;

    } catch (error) {
      console.error('Error processing message:', error);
      return `❌ Sorry, I encountered an error: ${error.message}`;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = { role: 'user', content: inputValue };
    setChatHistory(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    
    const aiResponse = await processUserMessage(currentInput);
    const assistantMessage = { role: 'assistant', content: aiResponse };
    setChatHistory(prev => [...prev, assistantMessage]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Task splitting function (from your utils)
  const splitTasks = (text) => {
    const separators = ['\n', ',', ';', 'and ', '&'];
    let tasks = [text];
    
    for (const sep of separators) {
      const newTasks = [];
      for (const task of tasks) {
        newTasks.push(...task.split(sep));
      }
      tasks = newTasks;
    }
    
    return tasks.map(task => task.trim()).filter(task => task.length > 0);
  };

  const AddItemModal = () => {
    const [itemType, setItemType] = useState('Task');
    const [itemText, setItemText] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Food');

    
    const extractMemoryInfo = async (rawInput) => {
  const prompt = `
You are a parser that extracts structured memory data for a tracking app.
Given a user's memory input, extract:
1. A short memory summary (text)
2. The location mentioned, if any (null if none)

Respond strictly in JSON:
{text: string, location: string | null}

Examples:
Input: "Left my glasses in Hiland Park"
Output: {"text": "Left my glasses", "location": "Hiland Park"}

Input: "Had amazing coffee"
Output: {"text": "Had amazing coffee", "location": null}

Input: "${rawInput}"
Output:
  `.trim();

  try {
    const response = await callLLM([
      { role: "system", content: prompt }
    ]);
    return JSON.parse(response);
  } catch (err) {
    console.error("❌ Failed to extract memory info:", err);
    return { text: rawInput, location: null };
  }
};

    
    
    const handleSave = async () => {
      if (!itemText.trim()) return;
      
      try {
        if (itemType === 'Task') {
          const taskList = splitTasks(itemText);
          
          // Insert tasks into Supabase
          const tasksToInsert = taskList.map(taskText => ({
            text: taskText,
            is_done: false
          }));

          const { data, error } = await supabase
            .from('tasks')
            .insert(tasksToInsert)
            .select();

          if (error) {
            console.error('Error saving tasks:', error);
            return;
          }

          // Reload tasks from database
          await loadTasks();
          
        } else if (itemType === 'Memory') {
          const extracted = await extractMemoryInfo(itemText);

        const { data, error } = await supabase
        .from('memories')
        .insert([{ 
        text: extracted.text, 
        location: extracted.location 
        }])
        .select();


          if (error) {
            console.error('Error saving memory:', error);
            return;
          }
          
        } else if (itemType === 'Expense') {
          const { data, error } = await supabase
            .from('expenses')
            .insert([{ 
              text: itemText, 
              amount: parseFloat(amount) || 0, 
              category: category 
            }])
            .select();

          if (error) {
            console.error('Error saving expense:', error);
            return;
          }
        }

        setItemText('');
        setAmount('');
        setShowAddModal(false);
        
      } catch (error) {
        console.error('Error saving item:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">➕ Add New Entry</h3>
            <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">What would you like to add?</label>
              <div className="flex gap-2">
                {['Task', 'Memory', 'Expense'].map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="radio"
                      value={type}
                      checked={itemType === type}
                      onChange={(e) => setItemType(e.target.value)}
                      className="mr-1"
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Enter details</label>
              <textarea 
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md h-20 resize-none"
                placeholder="Enter details..."
              />
            </div>
            
            {itemType === 'Expense' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹)</label>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="0.00"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    {Object.keys(categoryMap).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleSave}
                className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
                ✅ Save
              </button>
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TodoModal = () => {
    const pendingTasks = tasks.filter(t => !t.isDone);

    const completeTask = (task) => {
      setPendingTask(task);
      setShowExpensePrompt(true);
      setShowTodoModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw] max-h-[80vh] overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">📋 Pending Tasks</h3>
            <button onClick={() => setShowTodoModal(false)} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-3">
            {pendingTasks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">🎉 No pending tasks!</p>
            ) : (
              pendingTasks.map(task => (
                <div key={task.id} className="flex items-start justify-between p-3 border border-gray-200 rounded-md">
                  <div className="flex-1">
                    <p className="font-medium">{task.text}</p>
                    <p className="text-sm text-gray-500">Created: {task.created_at}</p>
                  </div>
                  <button 
                    onClick={() => completeTask(task)}
                    className="ml-3 text-green-500 hover:text-green-700 p-1"
                    title="Mark as completed"
                  >
                    ✅
                  </button>
                </div>
              ))
            )}
          </div>
          
          <button 
            onClick={() => setShowTodoModal(false)}
            className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const ExpensePromptModal = () => {
    const handleYes = () => {
      setShowExpensePrompt(false);
      setShowExpenseForm(true);
    };

    const handleNo = async () => {
      try {
        // Mark task as completed in Supabase
        const { error } = await supabase
          .from('tasks')
          .update({ is_done: true })
          .eq('id', pendingTask.id);

        if (error) {
          console.error('Error updating task:', error);
          return;
        }

        // Update local state
        setTasks(prev => prev.map(task => 
          task.id === pendingTask.id ? { ...task, isDone: true } : task
        ));
        
        setPendingTask(null);
        setShowExpensePrompt(false);
      } catch (err) {
        console.error('Error completing task:', err);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
          <h3 className="text-lg font-semibold mb-4">💸 Task Completed!</h3>
          <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
            <p className="font-medium">{pendingTask?.text}</p>
          </div>
          <p className="mb-6">Did you spend money on this task?</p>
          
          <div className="flex gap-3">
            <button 
              onClick={handleYes}
              className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
            >
              💰 Yes
            </button>
            <button 
              onClick={handleNo}
              className="flex-1 bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              ❌ No
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ExpenseFormModal = () => {
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('Food');

    const handleSave = async () => {
      if (parseFloat(expenseAmount) > 0) {
        try {
          // Save expense to Supabase
          const { error: expenseError } = await supabase
            .from('expenses')
            .insert([{
              text: pendingTask.text,
              amount: parseFloat(expenseAmount),
              category: expenseCategory
            }]);

          if (expenseError) {
            console.error('Error saving expense:', expenseError);
            return;
          }

          // Mark task as completed in Supabase
          const { error: taskError } = await supabase
            .from('tasks')
            .update({ is_done: true })
            .eq('id', pendingTask.id);

          if (taskError) {
            console.error('Error updating task:', taskError);
            return;
          }

          // Update local state
          setTasks(prev => prev.map(task => 
            task.id === pendingTask.id ? { ...task, isDone: true } : task
          ));
          
          setPendingTask(null);
          setShowExpenseForm(false);
          setExpenseAmount('');
        } catch (err) {
          console.error('Error saving expense and completing task:', err);
        }
      }
    };

    const handleBack = () => {
      setShowExpenseForm(false);
      setShowExpensePrompt(true);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
          <h3 className="text-lg font-semibold mb-4">💰 Add Expense</h3>
          <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
            <p className="font-medium">Task: {pendingTask?.text}</p>
          </div>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Amount (₹)</label>
                <input 
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="0.00"
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select 
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  {Object.keys(categoryMap).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleSave}
              className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors"
              disabled={!expenseAmount || parseFloat(expenseAmount) <= 0}
            >
              💾 Save
            </button>
            <button 
              onClick={handleBack}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              🔙 Back
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-light text-gray-800">🧠 Assistant</h1>
        </div>
        
        {/* Top Buttons */}
        <div className="flex gap-3 mb-6 justify-center">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            <Plus size={18} />
            Add Item
          </button>
          <button 
            onClick={() => setShowTodoModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            <CheckSquare size={18} />
            To-Do List
          </button>
        </div>
        
        {/* Chat Area */}
        <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto mb-4 border">
          {chatHistory.length === 0 ? (
            <div className="text-center text-gray-500 italic mt-8">
              Ask me anything about your tasks, expenses, or memories!
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-lg whitespace-pre-line ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white rounded-br-sm' 
                      : 'bg-white text-gray-800 rounded-bl-sm border'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 p-3 rounded-lg rounded-bl-sm border">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      
      {/* Modals */}
      {showAddModal && <AddItemModal />}
      {showTodoModal && <TodoModal />}
      {showExpensePrompt && <ExpensePromptModal />}
      {showExpenseForm && <ExpenseFormModal />}
    </div>
  );
};

export default Assistant;
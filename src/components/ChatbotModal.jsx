import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatbotModal = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: "Hello! I'm EcoBot, your AI irrigation assistant. I can help you with:",
      list: [
        'Current soil conditions and sensor readings',
        'Crop suitability based on environmental data'
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const CHATBOT_API_URL = '/api/chatbot';

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { type: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Sending message to:', CHATBOT_API_URL);
      console.log('Message:', text.trim());
      
      const response = await fetch(CHATBOT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: text.trim(), message: text.trim() }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          const errorData = JSON.parse(errorText);
          console.error('Chatbot API error (JSON):', response.status, errorData);
          throw new Error(errorData.response || errorData.message || `Server error: ${response.status}`);
        } catch (parseError) {
          console.error('Chatbot API error (text):', response.status, errorText);
          throw new Error(`Server error: ${response.status} - ${errorText || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      const botResponse = data.response || data.message || "I'm sorry, I couldn't process that request. Please try again.";

      // Add bot response (links are included directly in the HTML response)
      setMessages(prev => [...prev, { 
        type: 'bot', 
        text: botResponse
      }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      setMessages(prev => [...prev, { 
        type: 'bot', 
        text: `Error: ${error.message}. Please check the browser console (F12) for more details.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sanitizeChatbotHTML = (html) => {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Find all links and validate them
    const links = temp.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        try {
          // Check for broken link patterns
          if (href === '' || 
              href === '#' || 
              href.startsWith('javascript:') ||
              href.includes('example.com') ||
              href.includes('placeholder')) {
            // Remove the link, keep the text
            const textNode = document.createTextNode(link.textContent);
            link.parentNode.replaceChild(textNode, link);
          } else {
            // Validate URL
            const url = new URL(href, window.location.origin);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
              // Remove localhost links
              const textNode = document.createTextNode(link.textContent);
              link.parentNode.replaceChild(textNode, link);
            } else {
              // Ensure proper attributes for valid links
              link.setAttribute('target', '_blank');
              link.setAttribute('rel', 'noopener noreferrer');
            }
          }
        } catch (e) {
          // Invalid URL, remove link and keep text
          const textNode = document.createTextNode(link.textContent);
          link.parentNode.replaceChild(textNode, link);
        }
      }
    });
    
    return temp.innerHTML;
  };

  const exampleQuestions = [
    "What is the current soil moisture level?",
    "What crops are suitable?",
    "When should I water my plants?"
  ];

  return (
    <>
      <style>{`
        .chatbot-html-response p {
          margin-bottom: 0.5rem;
        }
        .chatbot-html-response ul {
          margin-left: 1rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          list-style-type: disc;
        }
        .chatbot-html-response li {
          margin-bottom: 0.25rem;
        }
        .chatbot-html-response strong {
          font-weight: 600;
        }
        .chatbot-html-response a {
          color: #10b981;
          text-decoration: underline;
        }
        .chatbot-html-response a:hover {
          color: #059669;
        }
      `}</style>
      <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Chatbot Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 w-[calc(100%-2rem)] sm:w-full max-w-md h-[500px] sm:h-[600px] bg-surface rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-eco-green-medium to-eco-green-dark px-6 py-4 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg">EcoBot</h3>
                <p className="text-white/80 text-xs mt-0.5">Your AI irrigation assistant</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xl transition-colors"
                aria-label="Close chatbox"
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-eco-green-medium flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">EB</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.type === 'user'
                        ? 'bg-eco-green-medium text-white'
                        : 'bg-surface text-gray-800 shadow-sm'
                    }`}
                  >
                    {message.type === 'bot' ? (
                      <div 
                        className="text-sm leading-relaxed chatbot-html-response"
                        style={{ lineHeight: '1.6' }}
                        dangerouslySetInnerHTML={{ __html: sanitizeChatbotHTML(message.text) }}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed">{message.text}</p>
                    )}
                    {message.list && (
                      <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                        {message.list.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 text-xs font-semibold">U</span>
                    </div>
                  )}
                </motion.div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-eco-green-medium flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-semibold">EB</span>
                  </div>
                  <div className="bg-surface rounded-lg px-4 py-2 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Example Questions */}
            {messages.length === 1 && (
              <div className="px-4 py-2 bg-surface border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {exampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(question)}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-surface border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about your irrigation system..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-eco-green-medium focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="w-10 h-10 bg-eco-green-medium hover:bg-eco-green-dark text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
};

export default ChatbotModal;

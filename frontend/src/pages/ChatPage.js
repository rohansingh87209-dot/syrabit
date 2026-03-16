/**
 * ChatPage — /chat
 * Full spec rebuild: 5-element animated empty state, typed bubbles,
 * actions bar (copy / regenerate / timestamp / credit badge),
 * credit progress bar, sync indicator, RAG source badge.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader2, BookOpen, Zap, RefreshCw, Copy, Check,
  AlertTriangle, Globe, Database, WifiOff, FileText, Sparkles, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getConversation, getSubject, getChapters } from '@/utils/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/perplexity-chat.css';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;
const getToken = () => { try { return localStorage.getItem('syrabit:token') || null; } catch { return null; } };

// ── Models (Groq) ─────────────────────────────────────────────────────────────
const MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Syrabit SLM', badge: '⚡ Fast'  },
  { value: 'qwen/qwen3-32b',          label: 'Syrabit MLM', badge: '🔜 Coming Soon', disabled: true },
];

// ── Bubble animation variants ─────────────────────────────────────────────────
const bubbleVariants = {
  hidden:  { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,
    transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } },
};

// ── RAG source badge ──────────────────────────────────────────────────────────
function RagBadge({ source, chunks }) {
  if (!source || source === 'none') return null;
  if (source === 'document') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}
        title="Answer grounded in the uploaded subject document (Tier 0 — highest priority)"
      >
        <FileText size={9} aria-hidden="true" /> Document
      </span>
    );
  }
  if (source === 'rag' || source === 'rag+web') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ background: 'rgba(16,185,129,0.10)', color: '#34d399', border: '1px solid rgba(16,185,129,0.20)' }}
        title={`Answer grounded in ${chunks} syllabus content blocks`}
      >
        <Database size={9} aria-hidden="true" /> Syllabus · {chunks} blocks
      </span>
    );
  }
  if (source === 'web') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ background: 'rgba(59,130,246,0.10)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.20)' }}
        title="No syllabus content found — answer supplemented by web search"
      >
        <Globe size={9} aria-hidden="true" /> Web search
      </span>
    );
  }
  return null;
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onCopy, onRegenerate, isLast }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onCopy) onCopy();
    } catch (err) {
      // Fallback for clipboard restrictions
      const textArea = document.createElement('textarea');
      textArea.value = msg.content || '';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (onCopy) onCopy();
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group mb-1`}
      data-testid="chat-message-bubble"
    >
      {isUser && (
        <div className="flex justify-end w-full">
          <div style={{
            padding: '12px 16px',
            background: '#7c3aed',
            borderRadius: '18px 18px 4px 18px',
            fontSize: '16px',
            lineHeight: '1.5',
            color: '#fff',
            maxWidth: '85%',
            wordWrap: 'break-word',
          }}>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      )}

      {!isUser && (
        <div className="flex items-start gap-2 w-[96%]">
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
            <img src="/logo.png" alt="Syrabit.ai" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            {msg.streaming && !msg.content && (
              <div className="flex items-center gap-3 py-4">
                <Loader2 size={20} className="animate-spin text-violet-400" />
                <span className="text-white/60 text-sm">AI is thinking...</span>
              </div>
            )}
            
            {msg.streaming && msg.content && (
              <div className="text-white/90 leading-relaxed whitespace-pre-wrap p-3 bg-white/[0.03] rounded-xl">
                {msg.content}
                <motion.span
                  className="inline-block w-px h-[1em] ml-0.5 rounded-full align-middle bg-violet-400"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.65, repeat: Infinity }}
                />
              </div>
            )}
            
            {!msg.streaming && msg.content && (
              <div className="text-white/90 leading-relaxed whitespace-pre-wrap p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                {msg.content}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div
        className={`flex items-center gap-1 transition-opacity ${
          msg.streaming ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'
        } ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
          {/* Timestamp */}
          {timeStr && (
            <span className="text-xs text-muted-foreground px-1">{timeStr}</span>
          )}

          {/* RAG badge (AI only, after streaming) */}
          {!isUser && !msg.streaming && (
            <RagBadge source={msg.rag_source} chunks={msg.rag_chunks} />
          )}

          {/* Copy button */}
          {!msg.streaming && (
            <button
              onClick={handleCopy}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Copy response"
              aria-label={copied ? 'Copied to clipboard' : 'Copy response'}
            >
              {copied
                ? <Check size={12} style={{ color: '#34d399' }} aria-hidden="true" />
                : <Copy size={12} aria-hidden="true" />
              }
            </button>
          )}

          {/* Regenerate (AI only, last message, not streaming) */}
          {!isUser && !msg.streaming && isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Regenerate response"
              aria-label="Regenerate AI response"
            >
              <RefreshCw size={12} aria-hidden="true" />
            </button>
          )}
        </div>
    </motion.div>
  );
}

// ── ChatPage ──────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const convId     = searchParams.get('id');
  const subjectId  = searchParams.get('subject');
  const documentId = searchParams.get('document_id'); // Tier 0 RAG when present

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [conversationId, setConversationId] = useState(convId || null);
  const [model, setModel]                 = useState('llama-3.3-70b-versatile');
  const [subject, setSubject]             = useState(null);
  const [scopedChapters, setScopedChapters] = useState([]);
  const [credits, setCredits]             = useState({ used: user?.credits_used || 0, limit: user?.credits_limit || 0 });
  const [syncState, setSyncState]         = useState('idle');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [copiedMsgId, setCopiedMsgId]     = useState(null);

  // ── Refs (3 useRef) ────────────────────────────────────────────────────────
  const messagesEndRef    = useRef(null);
  const textareaRef       = useRef(null);
  const abortControllerRef = useRef(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load subject context ───────────────────────────────────────────────────
  useEffect(() => {
    if (!subjectId) return;
    setSyncState('syncing');
    getSubject(subjectId)
      .then((r) => {
        setSubject(r.data);
        return getChapters(subjectId);
      })
      .then((r) => {
        setScopedChapters(r.data || []);
        setSyncState('idle');
      })
      .catch(() => setSyncState('idle'));
  }, [subjectId]);

  // ── Load conversation from URL ─────────────────────────────────────────────
  useEffect(() => {
    if (!convId || !user) return;
    setSyncState('syncing');
    getConversation(convId)
      .then((r) => {
        const conv = r.data;
        setConversationId(conv.id);
        setMessages(conv.messages || []);
        setSyncState('idle');
      })
      .catch(() => setSyncState('offline'));
  }, [convId, user]);

  // ── Sync state probe on focus ──────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') {
        fetch(`${API_BASE}/health`).then(() => setSyncState('idle')).catch(() => setSyncState('offline'));
      }
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  // ── Auto-grow textarea ────────────────────────────────────────────────────
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => { adjustTextarea(); }, [input, adjustTextarea]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const remaining    = Math.max(0, credits.limit - credits.used);
  // NaN guard: free user has limit=0, so creditPercent would be NaN
  const creditPercent = credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : 0;
  // Free users (limit=0) are always "out of credits" — they need to upgrade
  const isOutOfCredits = credits.limit === 0 || remaining <= 0;
  const isLow = credits.limit > 0 && remaining > 0 && remaining <= 5;

  // ── Sync indicator ────────────────────────────────────────────────────────
  const SyncDot = () => {
    if (syncState === 'syncing') return <Loader2 size={12} className="animate-spin text-muted-foreground" />;
    if (syncState === 'offline') return <WifiOff size={12} className="text-amber-400" />;
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />;
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMsg = async (text) => {
    if (!text.trim() || isLoading || isOutOfCredits) return;

    const msgId = Date.now().toString();
    const userMsg = { id: msgId + '_u', role: 'user', content: text, timestamp: new Date().toISOString() };
    const aiMsgId = msgId + '_a';
    const aiMsg   = { id: aiMsgId, role: 'assistant', content: '', streaming: true, timestamp: new Date().toISOString() };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    setIsLoading(true);
    setSyncState('syncing');

    // Abort previous stream if any
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const payload = {
      message: text,
      conversation_id: conversationId,
      subject_id:   subjectId   || null,
      subject_name: subject?.name || null,
      board_name:   user?.board_name  || null,
      class_name:   user?.class_name  || null,
      stream_name:  user?.stream_name || null,
      model,
      // Tier 0 RAG: when user came from "Ask AI 📄" button on a card with document
      document_id: documentId || null,
    };

    try {
      const _token = getToken();
      const response = await fetch(`${API_BASE}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          toast.error('Credits exhausted — upgrade to continue.', {
            action: { label: 'Upgrade', onClick: () => navigate('/profile') },
          });
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
          return;
        }
        throw new Error(errData.detail || 'Stream failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let newConvId = conversationId;
      let ragSource = 'none';
      let ragChunks = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.conversation_id) newConvId = parsed.conversation_id;
            if (parsed.rag_source) ragSource = parsed.rag_source;
            if (parsed.rag_chunks !== undefined) ragChunks = parsed.rag_chunks;
            if (parsed.content) {
              fullContent += parsed.content;
              setMessages((prev) => prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: fullContent } : m
              ));
            }
            // ── syrabit_done: credits metadata ─────────────────────────
            if (parsed.event === 'syrabit_done') {
              setCredits((c) => ({
                ...c,
                used: parsed.credits_used_total || c.used + 1,
              }));
              const remaining = parsed.remaining_credits ?? 0;
              try {
                const { Analytics } = await import('@/utils/analytics');
                Analytics.chatMessage(ragSource, remaining, model);
                if (remaining <= 0) Analytics.chatCreditsExhausted();
              } catch {}
            }
          } catch {}
        }
      }

      setConversationId(newConvId);
      // Finalize: remove streaming flag, attach RAG metadata
      setMessages((prev) => prev.map((m) =>
        m.id === aiMsgId
          ? { ...m, streaming: false, rag_source: ragSource, rag_chunks: ragChunks }
          : m
      ));
      setCredits((c) => ({ ...c, used: c.used + 1 }));
      setSyncState('idle');

    } catch (err) {
      if (err.name === 'AbortError') return;
      toast.error(err.message || 'Failed to get AI response');
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
      setSyncState('offline');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Regenerate last AI message ─────────────────────────────────────────────
  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setMessages((prev) => prev.slice(0, -1)); // remove last AI msg
      sendMsg(lastUser.content);
    }
  }, [messages]); // eslint-disable-line

  // ── Default prompts based on subject ──────────────────────────────────────
  const defaultPrompts = subject
    ? [
        `Explain the key concepts of ${subject.name}`,
        `What are the most important topics in ${subject.name} for exams?`,
        `Give me a solved example from ${subject.name}`,
        `What are common mistakes students make in ${subject.name}?`,
      ]
    : [
        'Explain this concept step by step',
        'Give me an exam-ready answer',
        'Show me a solved example',
        'What are the key points to remember?',
      ];

  const modelLabel = MODELS.find((m) => m.value === model) || MODELS[0];

  return (
    <AppLayout pageTitle={
      <div className="relative">
        <button
          onClick={() => setShowModelMenu((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-foreground hover:text-primary transition-all border border-border/50 hover:border-primary/30 hover:shadow-[0_0_12px_rgba(139,92,246,0.1)]"
          data-testid="model-selector-button"
        >
          <img src="/logo.png" alt="" className="w-4 h-4 rounded-sm" />
          <span>{modelLabel.label}</span>
          {!modelLabel.disabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {modelLabel.badge.replace(/[🧠⚡🔜]\s*/, '')}
            </span>
          )}
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
        </button>
        {showModelMenu && (
          <div
            className="absolute top-full left-0 mt-2 z-50 rounded-xl border border-border/60 shadow-2xl min-w-[260px] overflow-hidden backdrop-blur-xl"
            style={{ background: 'var(--popover-glass, var(--popover))' }}
          >
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => { 
                  if (!m.disabled) {
                    setModel(m.value); 
                    setShowModelMenu(false);
                  }
                }}
                disabled={m.disabled}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  m.disabled 
                    ? 'opacity-50 cursor-not-allowed bg-muted/20' 
                    : 'hover:bg-accent/40'
                } ${
                  model === m.value ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'
                }`}
              >
                <img src="/logo.png" alt="" className="w-5 h-5 rounded-sm flex-shrink-0" />
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{m.label}</span>
                    {m.disabled && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {m.disabled 
                      ? 'Advanced model launching soon' 
                      : (m.badge.replace(/[🧠⚡🔜]\s*/, '') === 'Fast' ? 'Best for quick Q&A, fastest responses' : 'Best for complex problems, deep reasoning')
                    }
                  </span>
                </div>
                {model === m.value && !m.disabled && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    }>
      <Toaster richColors position="top-right" />

      <div className="flex flex-col h-[calc(100vh-56px)]">

        {/* ── Out-of-credits / upgrade banner ────────────────────────────── */}
        {isOutOfCredits && (
          <div
            className="flex items-center justify-between px-4 py-2.5 text-sm flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}
            role="alert"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>
                {credits.limit === 0
                  ? 'Free plan has no credits — upgrade to start chatting'
                  : 'Credits exhausted — upgrade to continue'}
              </span>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="text-xs font-semibold text-red-300 hover:text-red-200 transition-colors underline"
              aria-label="Go to profile to upgrade plan"
            >
              Upgrade →
            </button>
          </div>
        )}

        {/* ── Message area - Perplexity Pro Style ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto chat-viewport" 
             style={{ 
               height: '100vh', 
               padding: '8px',
               overflowY: 'auto',
               scrollBehavior: 'smooth',
               WebkitOverflowScrolling: 'touch'
             }}
             onClick={() => setShowModelMenu(false)}
             role="log" aria-label="Chat messages" aria-live="polite">
          <div className="h-full">

            {/* Empty state — 5 animated elements */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 min-h-[400px]">

                {/* 1. Floating logo */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg,rgba(124,58,237,0.20),rgba(139,92,246,0.15))',
                      border: '1px solid rgba(139,92,246,0.25)',
                      animation: 'float 4s ease-in-out infinite',
                    }}
                  >
                    <BookOpen size={48} className="text-violet-400" />
                  </div>
                </motion.div>

                {/* 2. Heading + description */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.08 }}
                >
                  <h2
                    className="text-foreground mb-2 shimmer-text"
                    style={{ fontSize: '1.35rem', fontWeight: 700 }}
                  >
                    {subject ? `Ask me about ${subject.name}` : "Hi! I'm your AI Tutor"}
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-sm">
                  {documentId
                      ? 'I have the uploaded document loaded as primary source (Tier 0 RAG). Ask any question.'
                      : subject
                      ? `${scopedChapters.length} chapters loaded — I'll search the syllabus database before answering. If no relevant content is found, I'll search the web.`
                      : 'Ask me anything about your subjects. I search the syllabus database first, then the web if needed.'
                    }
                  </p>
                </motion.div>

                {/* 3. "Browse Syllabus" button (when no subject) */}
                {!subject && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.14 }}
                    onClick={() => navigate('/library')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(139,92,246,0.15))',
                      border: '1px solid rgba(139,92,246,0.25)',
                      color: 'hsl(var(--primary))',
                    }}
                  >
                    <BookOpen size={16} />
                    Ask about a Syllabus Subject →
                  </motion.button>
                )}

                {/* 4. Prompt suggestion cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {defaultPrompts.map((prompt, i) => (
                    <motion.button
                      key={prompt}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.18 + i * 0.06 }}
                      onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                      className="p-3 rounded-2xl text-left text-sm text-muted-foreground hover:text-foreground transition-all duration-200 card-3d glass-card"
                      style={{ border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                      {prompt}
                    </motion.button>
                  ))}
                </div>

                {/* 5. Connection status line */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground border border-border"
                >
                  <span>
                    {syncState === 'offline' && 'AI service check failed'}
                    {syncState === 'syncing' && 'Connecting…'}
                  </span>
                </motion.div>
              </div>
            )}

            {/* Messages */}
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id || i}
                  msg={msg}
                  isLast={i === messages.length - 1}
                  onCopy={() => setCopiedMsgId(msg.id)}
                  onRegenerate={msg.role === 'assistant' && i === messages.length - 1 ? handleRegenerate : null}
                />
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input area ────────────────────────────────────────────────── */}
        <motion.div
          className="flex-shrink-0 border-t border-border px-4 md:px-6 py-4"
          style={{ background: 'var(--card)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          data-testid="chat-input"
        >
          <div className="max-w-[96%] mx-auto">

            {/* RAG context info (when subject set + no messages yet) */}
            {subject && messages.length === 0 && scopedChapters.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-1 text-xs text-muted-foreground">
                <Database size={12} style={{ color: 'hsl(var(--primary) / 0.6)' }} />
                <span>RAG context: {scopedChapters.length} chapters from {subject.name} loaded</span>
              </div>
            )}


            {/* Input container */}
            <div
              className="flex items-end gap-3 p-3 rounded-2xl border transition-all duration-200"
              style={
                isOutOfCredits
                  ? { borderColor: 'rgba(239,68,68,0.20)', opacity: 0.6, background: 'rgba(239,68,68,0.02)' }
                  : { borderColor: 'rgba(139,92,246,0.15)', background: 'rgba(124,58,237,0.03)' }
              }
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMsg(input);
                  }
                }}
                placeholder={
                  isOutOfCredits
                    ? 'No credits remaining — upgrade your plan to continue'
                    : subject
                    ? `Ask about ${subject.name}…`
                    : 'Ask anything... (I\'ll search syllabus DB, then web if needed)'
                }
                disabled={isOutOfCredits}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
                style={{ minHeight: 24, maxHeight: 160 }}
                aria-label="Type your message"
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">↵ Enter</span>
                <button
                  onClick={() => sendMsg(input)}
                  disabled={!input.trim() || isLoading || isOutOfCredits}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:cursor-not-allowed"
                  style={
                    input.trim() && !isLoading && !isOutOfCredits
                      ? {
                          background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
                          color: '#fff',
                          boxShadow: '0 4px 15px rgba(139,92,246,0.4)',
                        }
                      : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
                  }
                  data-testid="chat-send-button"
                  aria-label={isLoading ? 'Sending message…' : 'Send message'}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}

/**
 * LibraryPage — /library
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, Bookmark, BookmarkCheck,
  BookOpen, Layers, ChevronRight, Sparkles, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import PageMeta from '@/components/seo/PageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useSubjects, useBoards, useClasses, useStreams, useSavedSubjects,
} from '@/hooks/useContent';
import { useToggleSavedSubject } from '@/hooks/useUser';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import PdfViewer from '@/components/PdfViewer';

// ── Inline Globe SVG (no lucide Globe import in this file per spec) ──────────
function Globe({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

// ── Thumbnail gradient maps (for subjects without a real thumbnailUrl) ────────
const THUMB_GRADIENTS = {
  math:      ['#4f46e5', '#7c3aed'],
  physics:   ['#2563eb', '#0891b2'],
  chemistry: ['#059669', '#0d9488'],
  biology:   ['#16a34a', '#15803d'],
  arts:      ['#d97706', '#b45309'],
  science:   ['#7c3aed', '#4f46e5'],
};

// ── Filter chips — 11 total covering both boards ──────────────────────────────
const FILTER_CHIPS = [
  { id: 'all',         label: 'All'      },
  { id: 'saved',       label: '★ Saved'  },
  // AHSEC filters
  { id: 'class-11',    label: 'Class 11' },
  { id: 'class-12',    label: 'Class 12' },
  { id: 'science-pcm', label: 'PCM'      },
  { id: 'science-pcb', label: 'PCB'      },
  { id: 'arts',        label: 'Arts'     },
  // DEGREE filters
  { id: '2nd-sem',     label: '2nd Sem'  },
  { id: '4th-sem',     label: '4th Sem'  },
  { id: 'bcom',        label: 'B.Com'    },
  { id: 'ba',          label: 'B.A'      },
  { id: 'bsc',         label: 'B.Sc'     },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getOnboardingProfile() {
  try {
    const raw = localStorage.getItem('syrabit:onboarding');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Skeleton screen ───────────────────────────────────────────────────────────
function LibrarySkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-5">
      {/* Filter bar skeleton */}
      <div className="flex gap-2 animate-pulse">
        {[80, 96, 72, 88].map((w) => (
          <div
            key={w}
            className="h-9 rounded-xl flex-shrink-0"
            style={{ width: w, background: 'rgba(255,255,255,0.06)' }}
          />
        ))}
      </div>
      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-4 space-y-3 animate-pulse"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(139,92,246,0.07)',
            }}
          >
            <div className="h-28 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-4 rounded-lg w-3/4" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-3 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <div className="h-5 w-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Subject Card ──────────────────────────────────────────────────────────────
function SubjectCard({ sub, isSaved, onToggleSave, onOpen, onAskAI, onSeoNav, onViewPdf, index }) {
  const thumbColors = THUMB_GRADIENTS[sub.gradient] || THUMB_GRADIENTS.math;
  const hasThumbnail = !!sub.thumbnailUrl;
  const tags = Array.isArray(sub.tags) ? sub.tags : [];
  const visibleTags = tags.slice(0, 4);
  const overflowCount = tags.length - 4;
  const chapterCount = sub.chapter_count || sub.chapterCount || 0;
  const totalTokens = sub.total_tokens || sub.totalTokens || 0;
  const totalChats = sub.total_chats || sub.totalChats || 0;
  const hasDocument = sub.has_document === true;  // admin uploaded a text file
  const seoPath = sub.boardSlug && sub.classSlug && sub.streamSlug && sub.slug
    ? `/${sub.boardSlug}/${sub.classSlug}/${sub.streamSlug}/${sub.slug}`
    : null;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden card-3d transition-all duration-300"
      style={{
        background: 'var(--card)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        border: isSaved
          ? '1px solid rgba(139,92,246,0.35)'
          : '1px solid rgba(139,92,246,0.12)',
        boxShadow: isSaved
          ? '0 0 20px var(--glow-primary, rgba(139,92,246,0.15)), 0 4px 24px rgba(0,0,0,0.2)'
          : '0 4px 24px rgba(0,0,0,0.15)',
        animationDelay: `${index * 60}ms`,
      }}
      data-testid="library-subject-card"
      data-subject-id={sub.id}
    >
      {/* ── Thumbnail ── */}
      <div className="relative h-44 overflow-hidden group">
        {/* Document indicator badge — top-left overlay when doc exists */}
        {hasDocument && (
          <div
            className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] font-semibold"
            style={{ background: 'rgba(16,185,129,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(16,185,129,0.35)' }}
          >
            <FileText size={10} aria-hidden="true" /> DOC
          </div>
        )}
        {hasThumbnail ? (
          <img
            src={sub.thumbnailUrl}
            alt={`${sub.name} — AHSEC ${sub.className} ${sub.streamName} | Syrabit`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Gradient fallback thumbnail */
          <div
            className="w-full h-full transition-transform duration-500 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${thumbColors[0]}, ${thumbColors[1]})`,
            }}
          >
            {/* Subject icon centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span aria-hidden="true" style={{ fontSize: '3rem', opacity: 0.85 }}>{sub.icon || '📚'}</span>
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.80), rgba(0,0,0,0.30), rgba(0,0,0,0.10))',
          }}
        />

        {/* Stream badge — top-left */}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-white text-xs font-semibold"
          style={{
            background: 'rgba(0,0,0,0.50)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          {sub.streamName || '—'}
        </div>

        {/* Class badge — top-right */}
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-white text-xs font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.85), rgba(139,92,246,0.85))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 2px 10px rgba(124,58,237,0.3)',
          }}
        >
          {sub.className || '—'}
        </div>

        {/* Saved indicator — top-right, offset from class badge */}
        {isSaved && (
          <div
            className="absolute top-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white"
            style={{
              right: '4.5rem',
              background: 'rgba(124,58,237,0.70)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <BookmarkCheck size={12} />
          </div>
        )}

        {/* Title overlay — bottom */}
        <div className="absolute bottom-3 left-3.5 right-3.5">
          <h3
            className="text-white"
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              lineHeight: 1.3,
              textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}
          >
            {sub.name}
          </h3>
          <p className="text-white/65 mt-0.5" style={{ fontSize: '0.78rem' }}>
            {[sub.boardName, sub.className, sub.streamName].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div className="px-4 pt-3.5 pb-4 space-y-3">
        {/* Description — 2-line clamp */}
        <p
          className="text-muted-foreground leading-relaxed"
          style={{
            fontSize: '0.82rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {sub.description || 'No description available.'}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers size={14} aria-hidden="true" />
            {chapterCount} Chapters
          </span>
          {totalTokens > 0 && (
            <span>{(totalTokens / 1000).toFixed(0)}K tokens</span>
          )}
          {totalChats > 0 && (
            <span>{totalChats} chats</span>
          )}
        </div>

        {/* Tags */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  color: 'hsl(var(--primary))',
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}
              >
                {tag}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="px-2 py-0.5 text-xs text-muted-foreground/50">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* SEO path row */}
        {seoPath && (
          <Link
            to={seoPath}
            className="group/seo flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-primary/60 transition-colors"
            title={`Open ${sub.name} subject page`}
          >
            <Globe className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate group-hover/seo:underline">{seoPath}</span>
          </Link>
        )}

        {/* Action buttons - Grid layout based on hasDocument */}
        <div className={hasDocument ? "grid grid-cols-2 gap-2 pt-1" : "flex gap-2 pt-1"}>
          {/* Save / Unsave */}
          <button
            onClick={() => onToggleSave(sub.id)}
            aria-label={isSaved ? `Unsave ${sub.name}` : `Save ${sub.name}`}
            className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
            style={
              isSaved
                ? { color: 'hsl(var(--primary))', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.30)' }
                : { color: 'hsl(var(--muted-foreground))', background: 'transparent', border: '1px solid rgba(139,92,246,0.15)' }
            }
            data-testid="subject-bookmark-button"
          >
            {isSaved ? 'Saved' : 'Save'}
          </button>

          {/* View PDF button - only show if document exists */}
          {hasDocument && (
            <button
              onClick={() => onViewPdf && onViewPdf(sub.id)}
              aria-label={`View PDF for ${sub.name}`}
              className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
              style={{ 
                color: '#f87171', 
                background: 'rgba(239,68,68,0.10)', 
                border: '1px solid rgba(239,68,68,0.25)' 
              }}
              data-testid="subject-view-pdf-button"
            >
              <FileText size={14} />
              View PDF
            </button>
          )}

          {/* Open - Goes to subject page */}
          <button
            onClick={() => onOpen(sub)}
            aria-label={`Open ${sub.name}`}
            className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
            style={
              hasDocument
                ? { color: '#34d399', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }
                : { color: 'hsl(var(--muted-foreground))', background: 'transparent', border: '1px solid rgba(139,92,246,0.15)' }
            }
            data-testid="subject-open-button"
          >
            Open
          </button>

          {/* Ask AI — gradient button */}
          <button
            onClick={() => onAskAI(sub.id, hasDocument)}
            aria-label={`Ask AI about ${sub.name}`}
            className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
            style={{
              background: hasDocument
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
              boxShadow: hasDocument
                ? '0 4px 18px rgba(16,185,129,0.35)'
                : '0 4px 18px var(--glow-primary, rgba(139,92,246,0.35))',
            }}
            data-testid="subject-ask-ai-button"
          >
            Ask AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LibraryPage ───────────────────────────────────────────────────────────────
export default function LibraryPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [searchQuery, setSearchQuery]   = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewingDoc, setViewingDoc]     = useState(null);
  const [pdfToView, setPdfToView]       = useState(null);
  const [loadingPdf, setLoadingPdf]     = useState(false);
  
  // PDF Cache - stores fetched PDFs to avoid re-fetching
  const [pdfCache] = useState(() => new Map());

  // Preload PDFs for subjects with documents (in background after initial load)
  useEffect(() => {
    if (!subjects.length) return;
    
    // Prefetch PDFs for subjects with documents (limit to first 3 to avoid overwhelming)
    const subjectsWithDocs = subjects.filter(s => s.has_document).slice(0, 3);
    
    const prefetchPdfs = async () => {
      const API = process.env.REACT_APP_BACKEND_URL || '';
      
      for (const subject of subjectsWithDocs) {
        // Skip if already cached
        if (pdfCache.has(subject.id)) continue;
        
        try {
          const response = await fetch(`${API}/api/content/subject-documents/${subject.id}?include_pdf=true`);
          const docs = await response.json();
          
          if (docs && docs.length > 0 && docs[0].pdf_data_url) {
            pdfCache.set(subject.id, docs[0]);
          }
        } catch (error) {
          // Silent fail for prefetch
          console.log(`Prefetch failed for ${subject.id}:`, error);
        }
        
        // Small delay between prefetches to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };
    
    // Prefetch after 2 seconds to not block initial page load
    const timeoutId = setTimeout(prefetchPdfs, 2000);
    return () => clearTimeout(timeoutId);
  }, [subjects, pdfCache]);

  // ── React Query data ──────────────────────────────────────────────────────
  const { data: subjects = [],  isLoading: subjectsLoading, refetch: refetchSubjects } = useSubjects();
  const { data: boards   = [] }                               = useBoards();
  const { data: classes  = [] }                               = useClasses();
  const { data: streams  = [] }                               = useStreams();
  const { data: savedSubjects = [] }                          = useSavedSubjects(token, user);
  const toggleSaved = useToggleSavedSubject(token);

  // ── Handle URL parameters for deep linking (REMOVED - causing issues) ───────
  // Removed to prevent "Cannot access 'subjects' before initialization" error
  
  // ── Auto-select stream from onboarding ───────────────────────────────────
  useEffect(() => {
    if (!streams.length) return;
    const profile = getOnboardingProfile();
    if (profile?.stream_id) {
      const stream = streams.find((s) => s.id === profile.stream_id);
      if (stream?.slug) setActiveFilter(stream.slug);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streams.length]);

  // ── Listen for content uploads to refresh subjects ───────────────────────────
  useEffect(() => {
    const handleContentUploaded = () => {
      console.log('Content uploaded - refreshing subjects');
      refetchSubjects();
    };
    
    window.addEventListener('content-uploaded', handleContentUploaded);
    return () => window.removeEventListener('content-uploaded', handleContentUploaded);
  }, [refetchSubjects]);

  // ── Data enrichment pipeline ──────────────────────────────────────────────
  const enrichedSubjects = subjects.map((sub) => {
    const stream = streams.find((s) => s.id === sub.stream_id);
    const cls    = classes.find((c) => c.id === stream?.class_id);
    const board  = boards.find((b)  => b.id === cls?.board_id);
    return {
      ...sub,
      boardName:  board?.name  || '',
      className:  cls?.name    || '',
      streamName: stream?.name || '',
      boardSlug:  board?.slug  || '',
      classSlug:  cls?.slug    || '',
      streamSlug: stream?.slug || '',
    };
  });

  // ── Filter + search pipeline ──────────────────────────────────────────────
  const filteredSubjects = enrichedSubjects.filter((sub) => {
    // Gate 1: published only
    if (sub.status && sub.status !== 'published') return false;

    // Gate 2: filter chip
    if (activeFilter === 'all') {
      // pass
    } else if (activeFilter === 'saved') {
      if (!savedSubjects.includes(sub.id)) return false;
    } else if (['class-11', 'class-12', '2nd-sem', '4th-sem'].includes(activeFilter)) {
      // class-level filter
      if (sub.classSlug !== activeFilter) return false;
    } else {
      // stream slug: science-pcm / science-pcb / arts / bcom / ba / bsc
      if (sub.streamSlug !== activeFilter) return false;
    }

    // Gate 3: search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inName   = sub.name?.toLowerCase().includes(q);
      const inTags   = Array.isArray(sub.tags) && sub.tags.some((t) => t.toLowerCase().includes(q));
      const inClass  = sub.className?.toLowerCase().includes(q);
      const inStream = sub.streamName?.toLowerCase().includes(q);
      const inBoard  = sub.boardName?.toLowerCase().includes(q);
      if (!inName && !inTags && !inClass && !inStream && !inBoard) return false;
    }

    return true;
  });

  // ── JSON-LD ItemList schema ───────────────────────────────────────────────
  useEffect(() => {
    if (!filteredSubjects.length) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'library-jsonld';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'AHSEC Subject Library',
      itemListElement: filteredSubjects.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: s.name,
        url: s.boardSlug && s.classSlug && s.streamSlug && s.slug
          ? `https://syrabit.ai/${s.boardSlug}/${s.classSlug}/${s.streamSlug}/${s.slug}`
          : `https://syrabit.ai/subject/${s.id}`,
      })),
    });
    const existing = document.getElementById('library-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => { const el = document.getElementById('library-jsonld'); if (el) el.remove(); };
  }, [filteredSubjects]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpen = (sub) => {
    // Always navigate to subject page to show chapters
    navigate(`/subject/${sub.id}`);
  };

  // Ask AI — if subject has document, pass document_id so chat uses it as Tier 0 RAG
  const handleAskAI = (subjectId, hasDocument = false) => {
    const params = new URLSearchParams({ subject: subjectId });
    if (hasDocument) params.set('document_id', subjectId); // same as subject_id
    navigate(`/chat?${params.toString()}`);
  };

  const handleSeoNav  = (path) => navigate(path);
  const handleResetFilters = () => { setSearchQuery(''); setActiveFilter('all'); };

  const handleViewPdf = async (subjectId) => {
    // Check cache first for instant loading
    if (pdfCache.has(subjectId)) {
      setPdfToView(pdfCache.get(subjectId));
      return;
    }

    setLoadingPdf(true);
    try {
      const API = process.env.REACT_APP_BACKEND_URL || '';
      
      // Single optimized call - include PDF data in one request
      const response = await fetch(`${API}/api/content/subject-documents/${subjectId}?include_pdf=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const docs = await response.json();
      
      if (docs && docs.length > 0 && docs[0].pdf_data_url) {
        const pdfData = docs[0];
        
        // Cache the PDF for instant future access
        pdfCache.set(subjectId, pdfData);
        
        // Show PDF viewer
        setPdfToView(pdfData);
      } else {
        toast.error('No PDF document found for this subject');
      }
    } catch (error) {
      console.error('Failed to load PDF:', error);
      toast.error('Failed to load PDF document');
    } finally {
      setLoadingPdf(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (subjectsLoading) {
    return (
      <AppLayout pageTitle="Library">
        <PageMeta
          title="AHSEC Subject Library"
          description="Explore AHSEC Class 11-12 and Degree subjects. AI-powered notes, chapters, and exam preparation for Assam students."
          url="https://syrabit.ai/library"
        />
        <LibrarySkeleton />
      </AppLayout>
    );
  }

  // ── Loaded state ──────────────────────────────────────────────────────────
  return (
    <AppLayout pageTitle="Library">
      <Toaster richColors position="top-right" />
      <PageMeta
        title="AHSEC Subject Library"
        description="Explore AHSEC Class 11-12 and Degree subjects. AI-powered notes, chapters, and exam preparation for Assam students."
        url="https://syrabit.ai/library"
      />
      <div className="flex flex-col h-full w-full overflow-x-hidden">
        <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-5">

          {/* ── Header row ── */}
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-foreground shimmer-text"
                style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}
              >
                AHSEC &amp; DEGREE STUDY LIBRARY
              </h1>
            </div>

            {/* Update Library Button */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  refetchSubjects();
                  toast.success('Library updated!');
                }}
                className="h-10 px-4 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all flex items-center gap-2"
              >
                <Layers size={14} />
                Update Library
              </button>
              
              <button
                className="w-10 h-10 rounded-full transition-all hover:scale-105 active:scale-95 overflow-hidden flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(139,92,246,0.15))',
                  border: '1px solid rgba(139,92,246,0.25)',
                  boxShadow: '0 0 18px var(--glow-primary, rgba(139,92,246,0.2))',
                }}
                aria-label="Library"
              >
                <img src="/logo.png" alt="Syrabit.ai" className="w-7 h-7 rounded-lg object-cover" />
              </button>
            </div>
          </div>

          {/* ── Search input ── */}
          <div className="relative group/search">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors text-muted-foreground group-focus-within/search:text-primary"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search subjects"
              placeholder="Search subjects, topics..."
              className="w-full h-11 pl-10 pr-4 rounded-xl text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
              style={{
                background: 'var(--card)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.15)',
                color: 'hsl(var(--foreground))',
              }}
              data-testid="library-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground text-xs px-1.5 py-0.5 rounded transition-colors"
                aria-label="Clear search"
                data-testid="library-search-clear"
              >
                Clear
              </button>
            )}
          </div>

          {/* ── Filter chips ── */}
          <div
            role="group"
            aria-label="Subject filters"
            className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar"
            data-testid="library-filter-chips"
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = chip.id === activeFilter;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  aria-pressed={isActive}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm transition-all duration-200 active:scale-95"
                  style={
                    isActive
                      ? {
                          color: '#fff',
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                          boxShadow: '0 4px 16px var(--glow-primary, rgba(139,92,246,0.35))',
                        }
                      : {
                          color: 'hsl(var(--muted-foreground))',
                          fontWeight: 400,
                          background: 'var(--card)',
                          border: '1px solid rgba(139,92,246,0.12)',
                        }
                  }
                  data-testid="library-filter-chip"
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* ── Subject grid or empty state ── */}
          {filteredSubjects.length === 0 ? (
            /* Empty state */
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(139,92,246,0.04))',
                  border: '1px solid rgba(139,92,246,0.12)',
                }}
              >
                <BookOpen className="w-10 h-10" style={{ color: 'hsl(var(--muted-foreground) / 0.3)' }} />
              </div>
              <h3 className="text-foreground font-semibold text-lg">No subjects found</h3>
              <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-xs">
                Try adjusting your search or filters to discover more subjects
              </p>
              {(searchQuery || activeFilter !== 'all') && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 rounded-xl text-sm text-primary hover:text-white transition-all duration-200 active:scale-95"
                  style={{
                    border: '1px solid rgba(139,92,246,0.25)',
                    background: 'rgba(139,92,246,0.06)',
                  }}
                  data-testid="library-reset-filters-button"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="library-subject-grid"
            >
              {filteredSubjects.map((sub, index) => (
                <SubjectCard
                  key={sub.id}
                  sub={sub}
                  isSaved={savedSubjects.includes(sub.id)}
                  onToggleSave={(id) => toggleSaved.mutate(id)}
                  onOpen={handleOpen}
                  onAskAI={handleAskAI}
                  onSeoNav={handleSeoNav}
                  onViewPdf={handleViewPdf}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Document Viewer Modal ── */}
      {viewingDoc && (
        <DocumentViewerModal
          subjectId={viewingDoc.id}
          subjectName={viewingDoc.name}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* ── PDF Viewer ── */}
      {pdfToView && (
        <PdfViewer
          pdfDataUrl={pdfToView.pdf_data_url}
          fileName={pdfToView.file_name || pdfToView.title}
          onClose={() => setPdfToView(null)}
        />
      )}

      {/* Loading overlay for PDF with better animation */}
      {loadingPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-t-4 border-purple-500 animate-spin"></div>
              {/* Inner pulsing dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></div>
              </div>
            </div>
            <p className="text-white font-semibold text-lg">Loading PDF...</p>
            <p className="text-gray-400 text-sm mt-1">Preparing document viewer</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

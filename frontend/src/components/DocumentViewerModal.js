import { useState, useEffect, useCallback, memo } from 'react';
import { X, Loader2, BookOpen, AlertCircle, FileText } from 'lucide-react';
import axios from 'axios';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;
const PDF_WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

let pdfViewerCache = null;
function loadPdfViewer() {
  if (pdfViewerCache) return pdfViewerCache;
  pdfViewerCache = Promise.all([
    import('@react-pdf-viewer/core'),
    import('@react-pdf-viewer/default-layout'),
    import('@react-pdf-viewer/core/lib/styles/index.css'),
    import('@react-pdf-viewer/default-layout/lib/styles/index.css'),
  ]).then(([core, layout]) => ({ core, layout }));
  return pdfViewerCache;
}

const preloadWorker = () => {
  if (typeof window !== 'undefined' && !document.querySelector(`link[href="${PDF_WORKER_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = PDF_WORKER_URL;
    document.head.appendChild(link);
  }
};

const LazyPdfViewer = memo(function LazyPdfViewer({ fileUrl }) {
  const [modules, setModules] = useState(null);
  const [plugin, setPlugin] = useState(null);

  useEffect(() => {
    loadPdfViewer().then((m) => {
      setModules(m);
      const p = m.layout.defaultLayoutPlugin({
        sidebarTabs: () => [],
        toolbarPlugin: {
          downloadPlugin: { enableShortcuts: false },
          printPlugin: { enableShortcuts: false },
          getFilePlugin: { enableShortcuts: false },
        },
        renderToolbar: (Toolbar) => (
          <Toolbar>
            {(slots) => {
              const { CurrentPageInput, NumberOfPages, ZoomIn, ZoomOut, GoToNextPage, GoToPreviousPage } = slots;
              return (
                <div className="rpv-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <GoToPreviousPage />
                    <CurrentPageInput /> / <NumberOfPages />
                    <GoToNextPage />
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <ZoomOut />
                    <ZoomIn />
                  </div>
                </div>
              );
            }}
          </Toolbar>
        ),
      });
      setPlugin(p);
    });
  }, []);

  if (!modules || !plugin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={32} className="animate-spin text-violet-400" />
        <span className="text-sm text-gray-500">Preparing viewer...</span>
      </div>
    );
  }

  const { Viewer, Worker } = modules.core;

  return (
    <Worker workerUrl={PDF_WORKER_URL}>
      <Viewer fileUrl={fileUrl} plugins={[plugin]} />
    </Worker>
  );
});

export default function DocumentViewerModal({ isOpen, onClose, subjectId, subjectName }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    preloadWorker();
    loadPdfViewer();
  }, []);

  useEffect(() => {
    if (!isOpen || !subjectId) {
      setDoc(null);
      setError(null);
      setVisible(false);
      return;
    }

    setVisible(true);
    setLoading(true);
    setError(null);
    axios.get(`${API_BASE}/content/subjects/${subjectId}/document`)
      .then((res) => setDoc(res.data))
      .catch((err) => setError(err.response?.status === 404 ? 'No content uploaded' : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [subjectId, isOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 150);
  }, [onClose]);

  if (!isOpen) return null;

  const isPDF = doc?.is_pdf || doc?.document_type === 'pdf';
  const pdfUrl = doc?.document_url || '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: visible ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0)',
        transition: 'background 150ms ease-out',
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: '90vw',
          height: '90vh',
          maxWidth: '1400px',
          transform: visible ? 'scale(1)' : 'scale(0.97)',
          opacity: visible ? 1 : 0,
          transition: 'transform 150ms ease-out, opacity 150ms ease-out',
          willChange: 'transform, opacity',
        }}
      >
        <div className="h-14 bg-[#0d0d1a] border-b border-white/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen size={18} className="text-violet-400 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{subjectName}</h3>
              {doc?.document_name && (
                <p className="text-xs text-white/40 truncate">{doc.document_name}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
            data-testid="close-doc-viewer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-[calc(100%-56px)] overflow-hidden bg-white">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={40} className="animate-spin text-violet-400" />
              <span className="text-sm text-gray-600">Loading document...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle size={48} className="text-rose-400" />
              <p className="text-gray-700 font-medium">{error}</p>
              <button onClick={handleClose} className="mt-4 px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium">
                Close
              </button>
            </div>
          )}

          {!loading && !error && doc && (
            <>
              {isPDF && pdfUrl && (
                <div className="h-full">
                  <LazyPdfViewer fileUrl={pdfUrl} />
                </div>
              )}

              {!isPDF && doc.document_text && (
                <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
                  <div className="prose prose-gray max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-[15px]">
                      {doc.document_text}
                    </pre>
                  </div>
                </div>
              )}

              {!isPDF && !doc.document_text && (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText size={48} className="text-gray-400 mb-4" />
                  <p className="text-gray-600">No content available</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

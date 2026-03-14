import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Maximize2, Minimize2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker with optimized settings
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfViewer = ({ pdfDataUrl, fileName, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.5); // Increased default scale for better readability
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Calculate optimal scale based on device
  const devicePixelRatio = window.devicePixelRatio || 1;
  const renderScale = scale * Math.min(devicePixelRatio, 2); // Cap at 2x for performance

  // Memoize document load callbacks
  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setLoading(false);
  }, []);

  const zoomIn = useCallback(() => setScale(prev => Math.min(prev + 0.25, 4.0)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev - 0.25, 0.75)), []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, zoomIn, zoomOut]);

  // Memoize document options for better performance
  const documentOptions = useMemo(() => ({
    cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  }), []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/95 border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{fileName || 'Document.pdf'}</h3>
            {numPages && (
              <p className="text-gray-400 text-xs">
                {numPages} {numPages === 1 ? 'page' : 'pages'} • Scroll to view all
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.75}
            className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out (−)"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 4.0}
            className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn size={18} />
          </button>
          
          {/* Fit to Width Button */}
          <button
            onClick={() => setScale(1.5)}
            className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-white text-xs font-medium transition-colors ml-1"
            title="Reset to Default (150%)"
          >
            Reset
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors ml-2"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* PDF Content - Scrollable with all pages */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex flex-col items-center gap-4 p-8 bg-gradient-to-b from-black/95 to-black/90"
      >
        {loading && (
          <div className="text-center py-20">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/30"></div>
              <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></div>
              </div>
            </div>
            <p className="text-sm text-white">Loading PDF...</p>
            {numPages && <p className="text-xs text-gray-400 mt-1">Rendering {numPages} pages</p>}
          </div>
        )}

        <Document
          file={pdfDataUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          options={documentOptions}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <div key={`page_${index + 1}`} className="relative mb-8 last:mb-0">
              {/* Page number indicator */}
              <div className="absolute -top-6 left-0 text-gray-400 text-xs font-medium bg-gray-800/50 px-2 py-1 rounded">
                Page {index + 1} of {numPages}
              </div>
              
              <Page 
                pageNumber={index + 1} 
                scale={renderScale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading=""
                className="shadow-2xl rounded-lg overflow-hidden bg-white border border-white/10"
                canvasBackground="white"
                devicePixelRatio={2}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;

import React, { useState, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X, Maximize2, Minimize2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker with optimized settings
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfViewer = ({ pdfDataUrl, fileName, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Memoize document load callbacks
  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setLoading(false);
  }, []);

  // Optimized page navigation
  const changePage = useCallback((offset) => {
    setPageNumber(prev => Math.max(1, Math.min(prev + offset, numPages || prev)));
  }, [numPages]);

  const previousPage = useCallback(() => changePage(-1), [changePage]);
  const nextPage = useCallback(() => changePage(1), [changePage]);

  const zoomIn = useCallback(() => setScale(prev => Math.min(prev + 0.2, 3.0)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev - 0.2, 0.5)), []);

  const downloadPdf = useCallback(() => {
    const link = document.createElement('a');
    link.href = pdfDataUrl;
    link.download = fileName || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pdfDataUrl, fileName]);

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
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
      if (e.key === 'ArrowLeft') previousPage();
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, previousPage, nextPage, zoomIn, zoomOut]);

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
                Page {pageNumber} of {numPages}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white text-sm font-medium min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadPdf}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title="Download PDF"
          >
            <Download size={18} />
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

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gradient-to-b from-black/95 to-black/90">
        {loading && (
          <div className="text-white text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/30"></div>
              <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
            </div>
            <p className="text-sm">Loading PDF...</p>
            {numPages && <p className="text-xs text-gray-400 mt-1">Rendering page {pageNumber} of {numPages}</p>}
          </div>
        )}

        <Document
          file={pdfDataUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          options={documentOptions}
          className="shadow-2xl"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading=""
            className="shadow-2xl border border-white/10 rounded-lg overflow-hidden bg-white"
          />
        </Document>
      </div>

      {/* Footer Navigation */}
      {numPages && numPages > 1 && (
        <div className="bg-gray-900/95 border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
            <span>Previous</span>
          </button>

          <div className="text-white font-medium">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= numPages) {
                  setPageNumber(page);
                }
              }}
              className="w-16 px-2 py-1 text-center bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="mx-2">/</span>
            <span>{numPages}</span>
          </div>

          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfViewer;

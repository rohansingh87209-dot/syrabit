import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Loader2, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

function authHeaders(token) {
  return { headers: token ? { Authorization: `Bearer ${token}` } : {}, withCredentials: true };
}

export default function AdminSyllabusManager({ adminToken, boards = [], classes = [], streams = [] }) {
  const [syllabi, setSyllabi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [editingSyllabus, setEditingSyllabus] = useState(null);
  const [formData, setFormData] = useState({
    content: '',
    chapters: [],
    topics: [],
    guidelines: '',
  });
  const [newChapter, setNewChapter] = useState('');
  const [newTopic, setNewTopic] = useState('');

  // Fetch existing syllabi
  useEffect(() => {
    if (selectedBoardId && selectedClassId) {
      fetchSyllabus();
    }
  }, [selectedBoardId, selectedClassId]);

  const fetchSyllabus = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API}/syllabi/${selectedBoardId}/${selectedClassId}`,
        { withCredentials: true }
      );
      if (res.data && res.data.content) {
        setEditingSyllabus(res.data);
        setFormData({
          content: res.data.content || '',
          chapters: res.data.chapters || [],
          topics: res.data.topics || [],
          guidelines: res.data.guidelines || '',
        });
      } else {
        setEditingSyllabus(null);
        setFormData({
          content: '',
          chapters: [],
          topics: [],
          guidelines: '',
        });
      }
    } catch (err) {
      console.error('Fetch syllabus error:', err);
      setEditingSyllabus(null);
      setFormData({ content: '', chapters: [], topics: [], guidelines: '' });
    } finally {
      setLoading(false);
    }
  };

  const saveSyllabus = async () => {
    if (!selectedBoardId || !selectedClassId) {
      toast.error('Please select Board and Class');
      return;
    }
    if (!formData.content.trim()) {
      toast.error('Syllabus content is required');
      return;
    }

    try {
      setSaving(true);
      await axios.post(
        `${API}/admin/syllabi/${selectedBoardId}/${selectedClassId}`,
        formData,
        authHeaders(adminToken)
      );
      toast.success('Syllabus saved successfully!');
      fetchSyllabus();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.detail || 'Failed to save syllabus');
    } finally {
      setSaving(false);
    }
  };

  const deleteSyllabus = async () => {
    if (!window.confirm('Delete this syllabus? This cannot be undone.')) return;

    try {
      setSaving(true);
      await axios.delete(
        `${API}/admin/syllabi/${selectedBoardId}/${selectedClassId}`,
        authHeaders(adminToken)
      );
      toast.success('Syllabus deleted');
      setEditingSyllabus(null);
      setFormData({ content: '', chapters: [], topics: [], guidelines: '' });
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete syllabus');
    } finally {
      setSaving(false);
    }
  };

  const addChapter = () => {
    if (newChapter.trim()) {
      setFormData({
        ...formData,
        chapters: [...formData.chapters, newChapter],
      });
      setNewChapter('');
    }
  };

  const removeChapter = (index) => {
    setFormData({
      ...formData,
      chapters: formData.chapters.filter((_, i) => i !== index),
    });
  };

  const addTopic = () => {
    if (newTopic.trim()) {
      setFormData({
        ...formData,
        topics: [...formData.topics, newTopic],
      });
      setNewTopic('');
    }
  };

  const removeTopic = (index) => {
    setFormData({
      ...formData,
      topics: formData.topics.filter((_, i) => i !== index),
    });
  };

  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen size={24} className="text-indigo-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Universal Syllabus Manager</h2>
          <p className="text-xs text-white/40 mt-1">Create board/class-specific syllabi that auto-inject into every AI answer</p>
        </div>
      </div>

      {/* Board & Class Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2 block">Board</label>
          <select
            value={selectedBoardId}
            onChange={(e) => {
              setSelectedBoardId(e.target.value);
              setSelectedClassId('');
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:border-indigo-500 outline-none transition-colors"
          >
            <option value="">Select Board</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2 block">Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={!selectedBoardId}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:border-indigo-500 outline-none transition-colors disabled:opacity-50"
          >
            <option value="">Select Class</option>
            {classes.filter(c => c.board_id === selectedBoardId).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedBoardId && selectedClassId && (
        <>
          {/* Syllabus Content */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Main Syllabus Description</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="e.g., AHSEC Class 11 Physics covers Mechanics, Thermodynamics, Waves, Optics, and Modern Physics. Focus on conceptual understanding and problem-solving skills..."
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 text-sm focus:border-indigo-500 outline-none transition-colors resize-none"
              rows={6}
            />
          </div>

          {/* Guidelines */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Learning Guidelines (Optional)</label>
            <textarea
              value={formData.guidelines}
              onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
              placeholder="e.g., Students should focus on deriving formulas, solving numeric problems, and understanding real-world applications..."
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 text-sm focus:border-indigo-500 outline-none transition-colors resize-none"
              rows={3}
            />
          </div>

          {/* Topics List */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Key Topics</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                placeholder="Add a topic and press Enter..."
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-sm focus:border-indigo-500 outline-none"
              />
              <button
                onClick={addTopic}
                className="px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-medium text-sm transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            {formData.topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.topics.map((topic, i) => (
                  <div key={i} className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-sm flex items-center gap-2">
                    {topic}
                    <button onClick={() => removeTopic(i)} className="hover:text-indigo-100"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chapters (optional structured breakdown) */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Chapters (Optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newChapter}
                onChange={(e) => setNewChapter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChapter()}
                placeholder="Add chapter name and press Enter..."
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-sm focus:border-indigo-500 outline-none"
              />
              <button
                onClick={addChapter}
                className="px-3 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 font-medium text-sm transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            {formData.chapters.length > 0 && (
              <div className="space-y-1.5">
                {formData.chapters.map((ch, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-200 text-sm flex items-center justify-between">
                    {ch}
                    <button onClick={() => removeChapter(i)} className="hover:text-violet-100"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          {editingSyllabus && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-200 text-sm">
              <CheckCircle size={16} />
              Syllabus exists for {selectedBoard?.name} - {selectedClass?.name}
            </div>
          )}

          {/* Save/Delete Actions */}
          <div className="flex gap-2">
            <button
              onClick={saveSyllabus}
              disabled={saving || loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Syllabus'}
            </button>
            {editingSyllabus && (
              <button
                onClick={deleteSyllabus}
                disabled={saving || loading}
                className="px-4 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 disabled:bg-red-600/10 text-red-300 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {!selectedBoardId || !selectedClassId && (
        <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
          <p className="text-white/60 text-sm">Select a Board and Class to manage their syllabus</p>
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { X, Send, CheckCircle2, AlertCircle, ImagePlus, Trash2 } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

const WEB3FORMS_ACCESS_KEY = '72d665ca-a9a2-43e0-a872-baf046c09143';

export function FeedbackModal() {
  const { closeModal } = useUIStore();
  const [type, setType] = useState<'Bug Report' | 'Feature Request' | 'General Feedback'>('Bug Report');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setAttachment(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('submitting');

    try {
      let fullMessage = message;

      // Include diagnostics for bug reports
      if (type === 'Bug Report') {
        const diagnostics = `
---
Diagnostics:
App Version: ${import.meta.env.VITE_APP_VERSION || 'unknown'}
User Agent: ${navigator.userAgent}
Screen: ${window.innerWidth}x${window.innerHeight}
        `.trim();
        fullMessage = `${message}\n\n${diagnostics}`;
      }

      const formData = new FormData();
      formData.append('access_key', WEB3FORMS_ACCESS_KEY);
      formData.append('subject', `PeptiTrack ${type}`);
      formData.append('from_name', 'PeptiTrack App');
      formData.append('message', fullMessage);
      
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setTimeout(() => {
          closeModal();
        }, 2000);
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Feedback submission error:', err);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center mx-5">
        <CheckCircle2 size={48} className="text-primary-500 mb-4" />
        <h3 className="text-xl font-bold text-content-primary mb-2">Thank You!</h3>
        <p className="text-sm text-content-secondary mb-4">
          Your feedback has been submitted successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-800 border border-white/10 rounded-2xl w-[calc(100%-2.5rem)] mx-5 max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-lg font-bold text-content-primary">Submit Feedback</h3>
        <button
          onClick={closeModal}
          className="p-1 rounded-full hover:bg-white/10 transition-colors text-content-secondary"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto">
        <div>
          <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-2">
            Feedback Type
          </label>
          <div className="flex rounded-lg border border-white/10 overflow-hidden bg-surface-900">
            {(['Bug Report', 'Feature Request', 'General Feedback'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                  type === t
                    ? 'bg-primary-600 text-white'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                {t.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === 'Bug Report'
                ? 'Please describe the issue in detail...'
                : 'Tell us what you think...'
            }
            required
            rows={5}
            className="w-full input-premium border border-white/10 rounded-xl p-3 text-content-primary text-sm focus:outline-none focus:border-primary-500 bg-surface-900 resize-none"
          />
        </div>

        <div>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          {!attachment ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
            >
              <ImagePlus size={16} />
              Attach Screenshot
            </button>
          ) : (
            <div className="flex items-center justify-between bg-surface-900 border border-white/10 rounded-lg p-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <ImagePlus size={16} className="text-content-secondary shrink-0" />
                <span className="text-xs text-content-primary truncate">{attachment.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="p-1 rounded-md text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-2 rounded-lg">
            <AlertCircle size={14} />
            <span>Failed to submit. Please try again.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting' || !message.trim()}
          className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? (
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send size={18} />
              Submit
            </>
          )}
        </button>
        
        <p className="text-[10px] text-content-muted text-center mt-2">
          Your feedback is sent anonymously. No email address is collected.
        </p>
      </form>
    </div>
  );
}

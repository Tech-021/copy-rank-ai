"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/client";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { Loader2, Send, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface Props {
  articleId: string;
  articleTitle: string;
  isPublished?: boolean;
  framerUrl?: string;
  onPublishSuccess?: (url: string) => void;
}

export function FramerPublishButton({ articleId, articleTitle, isPublished = false, framerUrl, onPublishSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) fetchConnections();
  }, [isOpen]);

  const fetchConnections = async () => {
    setLoadingConnections(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch('/api/framer/connections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setConnections(json.connections || []);
        const def = (json.connections || []).find((c: any) => c.is_default);
        setSelectedConnection(def?.id || null);
      }
    } catch (err) {
      console.error('Failed to load Framer connections', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Please sign in to publish');
        return;
      }

      const res = await fetch('/api/framer/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ articleId, connectionId: selectedConnection }),
      });

      const data = await res.json();
      if (data.success) {
        setIsOpen(false);
        if (onPublishSuccess && data.framerUrl) onPublishSuccess(data.framerUrl);
        toast.showToast({ title: 'Published to Framer!', description: data.framerUrl || 'Preview deployed', type: 'success' });
        if (data.updateError) {
          toast.showToast({ title: 'Warning', description: 'Published but failed to save Framer URL to the article', type: 'error' });
        }
      } else {
        throw new Error(data.error || 'Failed to publish');
      }
    } catch (err: any) {
      console.error('Framer publish error:', err);
      toast.showToast({ title: 'Publish failed', description: err?.message || 'Failed to publish to Framer', type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isPublished && framerUrl) {
    return (
      <Button variant="outline" size="sm" className="text-purple-400 border-purple-400/30 hover:bg-purple-950/20" onClick={() => {
        const raw = framerUrl;
        let target = ensureAbsoluteUrl(raw) || null;
        if (!target) {
          const s = String(raw || '').trim().replace(/^\/+/, '');
          target = s ? (s.match(/^https?:\/\//i) ? s : `https://${s}`) : 'about:blank';
        }
        window.open(target, "_blank");
      }}>
        <CheckCircle className="mr-2 h-4 w-4" />
        View on Framer
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-[#9162ff] border-[#9162ff]/30 hover:bg-[#9162ff]/10" onClick={() => setIsOpen(true)}>
        <Send className="mr-2 h-4 w-4" />
        Publish to Framer
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Publish to Framer</DialogTitle>
            <DialogDescription className="text-gray-400">Publish "{articleTitle}" to your Framer project (MVP uses server-wide API key)</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-300 break-words">This will create or update a CMS item in the project-managed collection named <strong>Articles</strong> and publish a preview deployment. If you have connected one or more Framer projects in <strong>Settings → Framer</strong>, you can choose which connection to use. If none are configured the server will fall back to `FRAMER_API_KEY` + `FRAMER_PROJECT_URL` (if set).</p>

            <div>
              <label className="text-xs text-gray-400">Connection</label>
              {loadingConnections ? (
                <div className="text-xs text-gray-400">Loading connections...</div>
              ) : connections.length === 0 ? (
                <div className="text-xs text-gray-400">No connections configured. Add one in Settings → Framer, or configure a global FRAMER_API_KEY on the server.</div>
              ) : (
                <Select value={selectedConnection || undefined} onValueChange={(val) => setSelectedConnection(val === '__use_default' ? null : val || null)}>
                  <SelectTrigger className="w-full h-10 bg-zinc-800 border-zinc-700 text-white overflow-hidden min-w-0 truncate whitespace-nowrap">
                    <SelectValue placeholder="Use default connection" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 max-w-[28rem] w-full">
                    <SelectItem value="__use_default"><span className="truncate block" title="Use default connection">Use default connection</span></SelectItem>
                    {connections.map((c) => (
                      <SelectItem  key={c.id} value={c.id} className="text-white hover:bg-zinc-700"><span className="truncate block max-w-[32rem]" title={c.project_url + (c.is_default ? ' (default)' : '')}>{c.project_url}{c.is_default ? ' (default)' : ''}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPublishing}>Cancel</Button>
            <Button onClick={handlePublish} disabled={isPublishing} className="bg-[#9162ff] hover:bg-[#6f42d6] text-white">
              {isPublishing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Publishing...</>) : (<><Send className="mr-2 h-4 w-4"/>Publish</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

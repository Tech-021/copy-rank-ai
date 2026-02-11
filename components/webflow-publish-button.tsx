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
  webflowUrl?: string;
  onPublishSuccess?: (url: string) => void;
}

export function WebflowPublishButton({ articleId, articleTitle, isPublished = false, webflowUrl, onPublishSuccess }: Props) {
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

      const res = await fetch('/api/webflow/connections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setConnections(json.connections || []);
        const def = (json.connections || []).find((c: any) => c.is_default);
        setSelectedConnection(def?.id || null);
      }
    } catch (err) {
      console.error('Failed to load Webflow connections', err);
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

      const res = await fetch('/api/webflow/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ articleId, connectionId: selectedConnection }),
      });

      const data = await res.json();
      if (data.success) {
        setIsOpen(false);
        if (onPublishSuccess && data.webflowUrl) onPublishSuccess(data.webflowUrl);
        toast.showToast({ title: 'Published to Webflow!', description: data.webflowUrl || 'Preview deployed', type: 'success' });
        if (data.updateError) {
          toast.showToast({ title: 'Warning', description: 'Published but failed to save Webflow URL to the article', type: 'error' });
        }
      } else {
        throw new Error(data.error || 'Failed to publish');
      }
    } catch (err: any) {
      console.error('Webflow publish error:', err);
      toast.showToast({ title: 'Publish failed', description: err?.message || 'Failed to publish to Webflow', type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isPublished && webflowUrl) {
    return (
      <Button variant="outline" size="sm" className="text-sky-400 border-sky-400/30 hover:bg-sky-950/20" onClick={() => {
        const raw = webflowUrl;
        let target = ensureAbsoluteUrl(raw) || null;
        if (!target) {
          const s = String(raw || '').trim().replace(/^\/+/, '');
          target = s ? (s.match(/^https?:\/\//i) ? s : `https://${s}`) : 'about:blank';
        }
        window.open(target, "_blank");
      }}>
        <CheckCircle className="mr-2 h-4 w-4" />
        View on Webflow
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-[#00b4ff] border-[#00b4ff]/30 hover:bg-[#00b4ff]/10" onClick={() => setIsOpen(true)}>
        <Send className="mr-2 h-4 w-4" />
        Publish to Webflow
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Publish to Webflow</DialogTitle>
            <DialogDescription className="text-gray-400">Publish "{articleTitle}" to your Webflow site collection (attempts to use a collection named <strong>Articles</strong>)</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-300 break-words">This will create or update a CMS item in a collection named <strong>Articles</strong> (site-level collection lookup) and attempt to publish the site. If you have connected one or more Webflow sites in <strong>Settings → Webflow</strong>, you can choose which connection to use. If none are configured the server will fall back to `WEBFLOW_API_TOKEN` + `WEBFLOW_SITE_ID` (if set).</p>

            <div>
              <label className="text-xs text-gray-400">Connection</label>
              {loadingConnections ? (
                <div className="text-xs text-gray-400">Loading connections...</div>
              ) : connections.length === 0 ? (
                <div className="text-xs text-gray-400">No connections configured. Add one in Settings → Webflow, or configure a global WEBFLOW_API_TOKEN + WEBFLOW_SITE_ID on the server.</div>
              ) : (
                <Select value={selectedConnection || undefined} onValueChange={(val) => setSelectedConnection(val === '__use_default' ? null : val || null)}>
                  <SelectTrigger className="w-full h-10 bg-zinc-800 border-zinc-700 text-white overflow-hidden min-w-0 truncate whitespace-nowrap">
                    <SelectValue placeholder="Use default connection" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 max-w-[28rem] w-full">
                    <SelectItem value="__use_default"><span className="truncate block" title="Use default connection">Use default connection</span></SelectItem>
                    {connections.map((c) => (
                      <SelectItem  key={c.id} value={c.id} className="text-white hover:bg-zinc-700"><span className="truncate block max-w-[32rem]" title={c.site_id + (c.is_default ? ' (default)' : '')}>{c.site_id}{c.is_default ? ' (default)' : ''}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPublishing}>Cancel</Button>
            <Button onClick={handlePublish} disabled={isPublishing} className="bg-[#00b4ff] hover:bg-[#018fd6] text-white">
              {isPublishing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Publishing...</>) : (<><Send className="mr-2 h-4 w-4"/>Publish</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
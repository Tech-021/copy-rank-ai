"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/client";
import { Loader2, Send, CheckCircle, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { Label } from "@/components/ui/label";
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
  articleStatus?: string | null;
  framerUrl?: string | null;
  framerLastSynced?: string | null;
  wordpressUrl?: string | null;
  wordpressLastSynced?: string | null;
  webflowUrl?: string | null;
  webflowLastSynced?: string | null;
  onPublishSuccess?: (url: string) => void;
  // Optional trigger customization
  triggerClassName?: string;
  triggerText?: string;
}

export function UnifiedPublishButton({ articleId, articleTitle, articleStatus, framerUrl, framerLastSynced, wordpressUrl, wordpressLastSynced, webflowUrl, webflowLastSynced, onPublishSuccess, triggerClassName, triggerText }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [framerConnections, setFramerConnections] = useState<any[]>([]);
  const [wordpressConnections, setWordpressConnections] = useState<any[]>([]);
  const [webflowConnections, setWebflowConnections] = useState<any[]>([]);
  const [selectedFramerConnection, setSelectedFramerConnection] = useState<string | null>(null);
  const [selectedWordpressConnection, setSelectedWordpressConnection] = useState<string | null>(null);
  const [selectedWebflowConnection, setSelectedWebflowConnection] = useState<string | null>(null);



  const formatConnectionLabel = (raw?: string | null) => {
    if (!raw) return '';
    try {
      const norm = raw.startsWith('http') ? raw : `https://${raw}`;
      const u = new URL(norm);
      const host = u.host;
      const path = (u.pathname || '').replace(/^\/+/, '');
      if (path) {
        const shortPath = path.length > 30 ? path.slice(0, 27) + '…' : path;
        return `${host}/${shortPath}`;
      }
      return host;
    } catch {
      if (raw.length > 45) return raw.slice(0, 22) + '…' + raw.slice(-20);
      return raw;
    }
  };

  // Checkboxes: default selected if NOT published
  const [publishFramer, setPublishFramer] = useState<boolean>(!Boolean(framerUrl));
  const [publishWordpress, setPublishWordpress] = useState<boolean>(!Boolean(wordpressUrl));
  const [publishWebflow, setPublishWebflow] = useState<boolean>(!Boolean(webflowUrl));
  const [updateFramer, setUpdateFramer] = useState<boolean>(false);
  const [updateWordpress, setUpdateWordpress] = useState<boolean>(false);
  const [updateWebflow, setUpdateWebflow] = useState<boolean>(false);

  // Optionally publish site status (mark as published)
  const [publishSite, setPublishSite] = useState<boolean>(!(articleStatus === 'published'));

  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      // reset selections based on current article state
      setPublishFramer(!Boolean(framerUrl));
      setPublishWordpress(!Boolean(wordpressUrl));
      setPublishWebflow(!Boolean(webflowUrl));
      setUpdateFramer(false);
      setUpdateWordpress(false);
      setUpdateWebflow(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadConnections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const [frRes, wpRes, wfRes] = await Promise.all([
        fetch('/api/framer/connections', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/wordpress/connections', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/webflow/connections', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const frJson = await frRes.json();
      const wpJson = await wpRes.json();
      const wfJson = await wfRes.json();

      if (frRes.ok && frJson.success) {
        setFramerConnections(frJson.connections || []);
        const def = (frJson.connections || []).find((c: any) => c.is_default);
        setSelectedFramerConnection(def?.id || null);
      }

      if (wpRes.ok && wpJson.success) {
        setWordpressConnections(wpJson.connections || []);
        setSelectedWordpressConnection((wpJson.connections || [])[0]?.id || null);
      }

      if (wfRes.ok && wfJson.success) {
        setWebflowConnections(wfJson.connections || []);
        const def = (wfJson.connections || []).find((c: any) => c.is_default);
        setSelectedWebflowConnection(def?.id || null);
      }
    } catch (err) {
      console.error('Failed to load connections for publish modal', err);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsPublishing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.showToast({ title: 'Not signed in', description: 'Please sign in to publish', type: 'error' });
        return;
      }

      const results: { platform: string; success: boolean; url?: string; error?: string }[] = [];

      // Framer publish if selected
      if (publishFramer || updateFramer) {
        if (!selectedFramerConnection && (!process.env.NEXT_PUBLIC_FALLBACK_FRAMER_KEY)) {
          // no connection available and no global fallback
          results.push({ platform: 'framer', success: false, error: 'No Framer connection configured' });
        } else {
          try {
            const res = await fetch('/api/framer/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ articleId, connectionId: selectedFramerConnection }),
            });
            const json = await res.json();
            if (res.ok && json.success) {
              results.push({ platform: 'framer', success: true, url: json.framerUrl });
            } else {
              results.push({ platform: 'framer', success: false, error: json.error || JSON.stringify(json) });
            }
          } catch (err: any) {
            results.push({ platform: 'framer', success: false, error: String(err) });
          }
        }
      }

      // WordPress publish if selected
      if (publishWordpress || updateWordpress) {
        if (!selectedWordpressConnection) {
          results.push({ platform: 'wordpress', success: false, error: 'No WordPress connection configured' });
        } else {
          try {
            const res = await fetch('/api/wordpress/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ articleId, connectionId: selectedWordpressConnection, status: 'publish' }),
            });
            const json = await res.json();
            if (res.ok && json.success) {
              results.push({ platform: 'wordpress', success: true, url: json.wordpressUrl });
            } else {
              results.push({ platform: 'wordpress', success: false, error: json.error || JSON.stringify(json) });
            }
          } catch (err: any) {
            results.push({ platform: 'wordpress', success: false, error: String(err) });
          }
        }
      }

      // Webflow publish if selected
      if (publishWebflow || updateWebflow) {
        if (!selectedWebflowConnection && !process.env.NEXT_PUBLIC_WEBFLOW_SITE_ID && !process.env.WEBFLOW_API_TOKEN) {
          results.push({ platform: 'webflow', success: false, error: 'No Webflow connection configured' });
        } else {
          try {
            const res = await fetch('/api/webflow/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ articleId, connectionId: selectedWebflowConnection }),
            });
            const json = await res.json();
            if (res.ok && json.success) {
              results.push({ platform: 'webflow', success: true, url: json.webflowUrl });
            } else {
              results.push({ platform: 'webflow', success: false, error: json.error || JSON.stringify(json) });
            }
          } catch (err: any) {
            results.push({ platform: 'webflow', success: false, error: String(err) });
          }
        }
      }

      // If site publish requested, attempt to mark article as published
      if (publishSite) {
        try {
          const res = await fetch(`/api/articles?id=${articleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' , Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'published', userId: (await supabase.auth.getUser()).data?.user?.id, autoSlugFromTitle: true }),
          });
          const json = await res.json().catch(() => null);
          if (res.ok && json.success) {
            results.push({ platform: 'site', success: true });
          } else {
            results.push({ platform: 'site', success: false, error: json?.error || JSON.stringify(json) });
          }
        } catch (err: any) {
          results.push({ platform: 'site', success: false, error: String(err) });
        }
      }

      // Show aggregate results
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (succeeded.length > 0) {
        succeeded.forEach(r => {
          toast.showToast({ title: `${r.platform} published`, description: r.url || 'Published', type: 'success' });
          if (r.url && onPublishSuccess) onPublishSuccess(r.url);
        });
      }

      if (failed.length > 0) {
        failed.forEach(r => {
          toast.showToast({ title: `${r.platform} publish failed`, description: r.error || 'Failed', type: 'error' });
        });
      }

      // Close dialog if at least one succeeded
      if (succeeded.length > 0) {
        setIsOpen(false);
      }

    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <Button
        className={triggerClassName ?? "text-[#9162ff] border-[#9162ff]/30 hover:bg-[#9162ff]/10"}
        onClick={() => setIsOpen(true)}
        title={triggerText || `Publish ${articleTitle}`}
      >
        <Send className="mr-2 h-4 w-4" />
        {triggerText || "Publish"}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publish "{articleTitle}"</DialogTitle>
            <DialogDescription className="text-gray-400">Choose which platforms to publish to and review their current state.</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Site publish option */}
            <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={publishSite} onChange={(e) => setPublishSite(e.target.checked)} />
                  <div>
                    <div className="text-sm font-medium">Publish to Site</div>
                    <div className="text-xs text-gray-400">{articleStatus === 'published' ? 'Already published' : 'Mark article as published on your site'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Framer card */}
            <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={publishFramer || updateFramer} onChange={(e) => {
                    if (framerUrl && !e.target.checked) {
                      // user unchecks: disable both publish and update
                      setPublishFramer(false);
                      setUpdateFramer(false);
                    } else if (framerUrl && e.target.checked) {
                      // if already published, toggling check will mark update
                      setUpdateFramer(true);
                    } else {
                      setPublishFramer(e.target.checked);
                    }
                  }} />
                  <div>
                    <div className="text-sm font-medium">Framer</div>
                    <div className="text-xs text-gray-400">{framerUrl ? `Published ${framerLastSynced ? `(${new Date(framerLastSynced).toLocaleString()})` : '(unknown time)'}` : 'Not published'}</div>
                  </div>
                </div>
                {framerUrl && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const raw = framerUrl;
                    let target = ensureAbsoluteUrl(raw) || null;
                    if (!target) {
                      const s = String(raw || '').trim().replace(/^\/+/, '');
                      target = s ? (s.match(/^https?:\/\//i) ? s : `https://${s}`) : 'about:blank';
                    }
                    window.open(target, '_blank');
                  }}>
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="ml-2 hidden sm:inline">Open</span>
                  </Button>
                )}
              </div>

              <div className="mt-3" style={{maxWidth: '50%'}}>
                <Label className="text-xs">Connection</Label>
                {framerConnections.length === 0 ? (
                  <div className="text-xs text-gray-400">No Framer connections. Add one in Settings → Framer or set a global key.</div>
                ) : (
                  <Select value={selectedFramerConnection || undefined} onValueChange={(v) => setSelectedFramerConnection(v || null)}>
                    <SelectTrigger className="w-full h-10 bg-zinc-700 border-zinc-600 text-white overflow-hidden min-w-0 truncate whitespace-nowrap">
                      <SelectValue placeholder="Select connection">
                        {selectedFramerConnection ? (
                          <span className="truncate block" title={framerConnections.find((x) => x.id === selectedFramerConnection)?.project_url}>
                            {formatConnectionLabel(framerConnections.find((x) => x.id === selectedFramerConnection)?.project_url)}
                          </span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger> 
                    <SelectContent className="bg-zinc-800 border-zinc-700 max-w-[28rem] w-full">
                      {framerConnections.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-white hover:bg-zinc-700">
                          <span className="truncate block" title={c.project_url}>{formatConnectionLabel(c.project_url)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Webflow card */}
            <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={publishWebflow || updateWebflow} onChange={(e) => {
                    if (webflowUrl && !e.target.checked) {
                      setPublishWebflow(false);
                      setUpdateWebflow(false);
                    } else if (webflowUrl && e.target.checked) {
                      setUpdateWebflow(true);
                    } else {
                      setPublishWebflow(e.target.checked);
                    }
                  }} />
                  <div>
                    <div className="text-sm font-medium">Webflow</div>
                    <div className="text-xs text-gray-400">{webflowUrl ? `Published ${webflowLastSynced ? `(${new Date(webflowLastSynced).toLocaleString()})` : '(unknown time)'}` : 'Not published'}</div>
                  </div>
                </div>
                {webflowUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(webflowUrl!, '_blank')}>
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="ml-2 hidden sm:inline">Open</span>
                  </Button>
                )}
              </div>

              <div className="mt-3" style={{maxWidth: '50%'}}>
                <Label className="text-xs">Connection</Label>
                {webflowConnections.length === 0 ? (
                  <div className="text-xs text-gray-400">No Webflow connections. Add one in Settings → Webflow or set a global key.</div>
                ) : (
                  <Select value={selectedWebflowConnection || undefined} onValueChange={(v) => setSelectedWebflowConnection(v || null)}>
                    <SelectTrigger className="w-full h-10 bg-zinc-700 border-zinc-600 text-white overflow-hidden min-w-0 truncate whitespace-nowrap">
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 max-w-[28rem] w-full">
                      {webflowConnections.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-white hover:bg-zinc-700"><span className="truncate block" title={c.site_name || c.site_id}>{c.site_name || c.site_id}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* WordPress card */}
            <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={publishWordpress || updateWordpress} onChange={(e) => {
                    if (wordpressUrl && !e.target.checked) {
                      setPublishWordpress(false);
                      setUpdateWordpress(false);
                    } else if (wordpressUrl && e.target.checked) {
                      setUpdateWordpress(true);
                    } else {
                      setPublishWordpress(e.target.checked);
                    }
                  }} />
                  <div>
                    <div className="text-sm font-medium">WordPress</div>
                    <div className="text-xs text-gray-400">{wordpressUrl ? `Published ${wordpressLastSynced ? `(${new Date(wordpressLastSynced).toLocaleString()})` : '(unknown time)'}` : 'Not published'}</div>
                  </div>
                </div>
                {wordpressUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(wordpressUrl!, '_blank')}>
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="ml-2 hidden sm:inline">Open</span>
                  </Button>
                )}
              </div>

              <div className="mt-3">
                <Label className="text-xs">Connection</Label>
                {wordpressConnections.length === 0 ? (
                  <div className="text-xs text-gray-400">No WordPress connections. Add one in Settings → WordPress.</div>
                ) : (
                  <Select value={selectedWordpressConnection || undefined} onValueChange={(v) => setSelectedWordpressConnection(v || null)}>
                    <SelectTrigger className="w-full h-10 bg-zinc-700 border-zinc-600 text-white overflow-hidden min-w-0 truncate whitespace-nowrap">
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 max-w-[28rem] w-full">
                      {wordpressConnections.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-white hover:bg-zinc-700"><span className="truncate block" title={c.site_name}>{c.site_name}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPublishing}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPublishing || !(publishFramer || updateFramer || publishWordpress || updateWordpress || publishWebflow || updateWebflow)} className="bg-[#9162ff] hover:bg-[#6f42d6] text-white">
              {isPublishing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Publishing...</>) : (<><Send className="mr-2 h-4 w-4"/>Publish</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

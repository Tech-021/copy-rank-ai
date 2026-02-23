"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/client";
import { Loader2, Send, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WordPressConnection {
  id: string;
  site_url: string;
  site_name: string;
  is_active: boolean;
}

interface WordPressPublishButtonProps {
  articleId: string;
  articleTitle: string;
  isPublished?: boolean;
  wordpressUrl?: string;
  onPublishSuccess?: (url: string) => void;
}

export function WordPressPublishButton({
  articleId,
  articleTitle,
  isPublished = false,
  wordpressUrl,
  onPublishSuccess,
}: WordPressPublishButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [connections, setConnections] = useState<WordPressConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [publishStatus, setPublishStatus] = useState<"draft" | "publish">("publish");

  useEffect(() => {
    if (isOpen) {
      fetchConnections();
    }
  }, [isOpen]);

  const fetchConnections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      const response = await fetch("/api/wordpress/connections", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.connections) {
        const activeConnections = data.connections.filter((c: WordPressConnection) => c.is_active);
        setConnections(activeConnections);
        if (activeConnections.length > 0) {
          setSelectedConnection(activeConnections[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    }
  };

  const handlePublish = async () => {
    if (!selectedConnection) {
      alert("Please select a WordPress site");
      return;
    }

    try {
      setIsPublishing(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert("Please log in to publish");
        return;
      }

      const response = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          articleId,
          connectionId: selectedConnection,
          status: publishStatus,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Article ${publishStatus === 'publish' ? 'published' : 'saved as draft'} to WordPress!`);
        setIsOpen(false);
        if (onPublishSuccess && data.wordpressUrl) {
          onPublishSuccess(data.wordpressUrl);
        }
      } else {
        throw new Error(data.error || "Publishing failed");
      }
    } catch (error) {
      console.error("WordPress publish error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to publish to WordPress. Please try again."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (isPublished && wordpressUrl) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-green-400 border-green-400/30 hover:bg-green-950/20"
        onClick={() => window.open(wordpressUrl, '_blank')}
      >
        <CheckCircle className="mr-2 h-4 w-4" />
        View on WordPress
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-[#0073aa] border-[#0073aa]/30 hover:bg-[#0073aa]/10"
        onClick={() => setIsOpen(true)}
      >
        <Send className="mr-2 h-4 w-4" />
        Publish to WordPress
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Publish to WordPress</DialogTitle>
            <DialogDescription className="text-gray-400">
              Publish "{articleTitle}" to your WordPress site
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {connections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">
                  No WordPress sites connected yet
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    // Redirect to settings
                    window.location.href = "/dashboard/settings";
                  }}
                >
                  Connect WordPress Site
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="site" className="text-white">
                    WordPress Site
                  </Label>
                  <Select
                    value={selectedConnection}
                    onValueChange={setSelectedConnection}
                  >
                    <SelectTrigger id="site" className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {connections.map((connection) => (
                        <SelectItem
                          key={connection.id}
                          value={connection.id}
                          className="text-white hover:bg-zinc-700"
                        >
                          {connection.site_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-white">
                    Publish Status
                  </Label>
                  <Select
                    value={publishStatus}
                    onValueChange={(value) => setPublishStatus(value as "draft" | "publish")}
                  >
                    <SelectTrigger id="status" className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="publish" className="text-white hover:bg-zinc-700">
                        Publish Immediately
                      </SelectItem>
                      <SelectItem value="draft" className="text-white hover:bg-zinc-700">
                        Save as Draft
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {connections.length > 0 && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !selectedConnection}
                className="bg-[#0073aa] hover:bg-[#005a87] text-white"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {publishStatus === 'publish' ? 'Publish Now' : 'Save as Draft'}
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

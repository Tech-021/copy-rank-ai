"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/client";
import { Loader2, Check, ExternalLink, Trash2 } from "lucide-react";

interface WordPressConnection {
  id: string;
  site_url: string;
  site_name: string;
  is_active: boolean;
  last_sync_at: string;
  created_at: string;
}

export function WordPressConnectButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connections, setConnections] = useState<WordPressConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConnections();
    
    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search);
    if (params.get('wordpress') === 'connected') {
      const siteName = params.get('site');
      if (typeof window !== 'undefined') {
        // Show success message
        setTimeout(() => {
          alert(`Successfully connected to ${siteName || 'WordPress'}!`);
        }, 100);
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        fetchConnections();
      }
    } else if (params.get('error')) {
      const error = params.get('error');
      if (typeof window !== 'undefined') {
        alert(`WordPress connection failed: ${error}`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const fetchConnections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/wordpress/connections", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.connections) {
        setConnections(data.connections);
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert("Please log in to connect WordPress");
        setIsConnecting(false);
        return;
      }

      const response = await fetch("/api/wordpress/connect", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.authUrl) {
        // Redirect to WordPress OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "Failed to get authorization URL");
      }
    } catch (error) {
      console.error("WordPress connection error:", error);
      alert("Failed to connect to WordPress. Please try again.");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect this WordPress site?")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert("Please log in to disconnect WordPress");
        return;
      }

      const response = await fetch(`/api/wordpress/connections?id=${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        alert("WordPress site disconnected successfully");
        fetchConnections();
      } else {
        throw new Error(data.error || "Failed to disconnect");
      }
    } catch (error) {
      console.error("WordPress disconnect error:", error);
      alert("Failed to disconnect WordPress site. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading connections...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {connections.length > 0 && (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-medium text-white">Connected Sites</h4>
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-[#0073aa] rounded">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {connection.site_name}
                  </p>
                  <a
                    href={connection.site_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-gray-300 flex items-center space-x-1"
                  >
                    <span>{connection.site_url}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <Button
                onClick={() => handleDisconnect(connection.id)}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="bg-[#0073aa] hover:bg-[#005a87] text-white"
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting to WordPress...
          </>
        ) : (
          <>
            {connections.length > 0 ? "Connect Another Site" : "Connect WordPress"}
          </>
        )}
      </Button>

      <p className="text-xs text-gray-400">
        Connect your WordPress.com site to publish articles directly from this app
      </p>
    </div>
  );
}

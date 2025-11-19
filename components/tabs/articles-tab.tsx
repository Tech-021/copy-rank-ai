"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Eye, Trash2, Edit2, BarChart3, Clock, Target, RefreshCw } from "lucide-react"
import { getUser } from "@/lib/auth"

interface Article {
  id: string
  title: string
  content: string
  keyword: string
  status: "draft" | "scheduled" | "published"
  date: string
  preview: string
  wordCount: number
  metaTitle?: string
  metaDescription?: string
  slug?: string
  focusKeyword?: string
  readingTime?: string
  contentScore?: number
  keywordDensity?: number
  tags?: string[]
  category?: string
  generatedAt?: string
  estimatedTraffic?: number
}

interface ArticlesTabProps {
  generatedArticles?: Article[]
  onArticlesUpdate?: (articles: Article[]) => void
  websiteId?: string
}

export function ArticlesTab({ generatedArticles, onArticlesUpdate, websiteId }: ArticlesTabProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [newArticleKeyword, setNewArticleKeyword] = useState("")
  const [newArticleDate, setNewArticleDate] = useState("")
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Get current user on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: user } = await getUser()
      setCurrentUser(user)
    }
    getCurrentUser()
  }, [])

  // Fetch articles from database
  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true)
      
      if (!currentUser) {
        console.log('No current user found')
        return
      }
      
      const url = websiteId 
        ? `/api/articles?websiteId=${websiteId}&userId=${currentUser.id}`
        : `/api/articles?userId=${currentUser.id}`
      
      console.log('Fetching from URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', response.status, errorText)
        throw new Error(`Failed to fetch articles: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setArticles(data.articles || [])
      } else {
        throw new Error(data.error || 'Failed to fetch articles')
      }
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUser, websiteId])

  // Load articles when currentUser is available
  useEffect(() => {
    if (currentUser) {
      fetchArticles()
    }
  }, [currentUser, websiteId])

  // Process pending article jobs (client-side polling for Hobby plan)
  // This replaces Vercel cron jobs which are limited on Hobby plan
  useEffect(() => {
    if (!currentUser) return;

    // Process pending jobs when user visits articles tab
    const processPendingJobs = async () => {
      try {
        // Trigger job processing (fire and forget)
        await fetch('/api/article-jobs/trigger', {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error triggering job processing:', error);
      }
    };

    // Process jobs immediately on mount
    processPendingJobs()

    // Then poll every 30 seconds to process more jobs
    const interval = setInterval(() => {
      processPendingJobs()
      // Refresh articles to show newly generated ones
      fetchArticles()
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentUser, websiteId, fetchArticles])

  // Update articles when new generated articles come in
  useEffect(() => {
    if (generatedArticles && generatedArticles.length > 0) {
      setArticles(prev => [...generatedArticles, ...prev])
      if (onArticlesUpdate) {
        onArticlesUpdate([...generatedArticles, ...prev])
      }
    }
  }, [generatedArticles, onArticlesUpdate])

  const handleGenerateArticle = async () => {
    if (!newArticleKeyword.trim() || !newArticleDate || !currentUser) return

    setIsGenerating(true)

    try {
      const response = await fetch('/api/test-generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: newArticleKeyword,
          websiteId: websiteId,
          userId: currentUser.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate article')
      }

      const data = await response.json()
      
      if (data.success && data.article) {
        // Refresh articles from database to get the saved one
        await fetchArticles()
        setNewArticleKeyword("")
        setNewArticleDate("")
        alert('Article generated successfully!')
      }
    } catch (error) {
      console.error('Error generating article:', error)
      alert('Failed to generate article. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?') || !currentUser) return

    try {
      const response = await fetch(`/api/articles?id=${id}&userId=${currentUser.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from local state
        setArticles(prev => prev.filter(article => article.id !== id))
        alert('Article deleted successfully!')
      } else {
        throw new Error('Failed to delete article')
      }
    } catch (error) {
      console.error('Error deleting article:', error)
      alert('Failed to delete article. Please try again.')
    }
  }

 const handleUpdateStatus = async (id: string, newStatus: "draft" | "scheduled" | "published") => {
  if (!currentUser) {
    alert('Please log in to update article status')
    return
  }

  setUpdatingStatus(id)

  try {
    console.log(`Updating article ${id} to status: ${newStatus}`)

    const response = await fetch(`/api/articles?id=${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: newStatus,
        userId: currentUser.id
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('API Error response:', data)
      throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }

    if (data.success) {
      // Update local state with the returned article data
      setArticles(prev => 
        prev.map(article => 
          article.id === id ? { 
            ...article, 
            status: newStatus,
            // Update date if publishing for the first time
            ...(newStatus === 'published' && article.status !== 'published' && { 
              date: new Date().toISOString().split('T')[0] 
            })
          } : article
        )
      )
      console.log(`✅ Article status updated to ${newStatus}`)
    } else {
      throw new Error(data.error || 'Failed to update article status')
    }
  } catch (error) {
    console.error('❌ Error updating article status:', error)
    alert(`Failed to update article status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    // Revert optimistic update by refreshing from server
    await fetchArticles()
  } finally {
    setUpdatingStatus(null)
  }
}

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 border-green-200"
      case "scheduled":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case "published":
        return "Published"
      case "scheduled":
        return "Scheduled"
      case "draft":
        return "Draft"
      default:
        return status
    }
  }

  const getContentScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === "published").length,
    scheduled: articles.filter((a) => a.status === "scheduled").length,
    draft: articles.filter((a) => a.status === "draft").length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading articles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Articles</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Published</p>
              <p className="text-2xl font-bold text-green-600">{stats.published}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
              <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">

{/* 
        <Dialog>
          <DialogTrigger asChild>
            <Button className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <Plus className="w-4 h-4" />
              Generate New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate New Article</DialogTitle>
              <DialogDescription>Create a new SEO-optimized article for a keyword</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Keyword</label>
                <Input
                  placeholder="Enter target keyword"
                  value={newArticleKeyword}
                  onChange={(e) => setNewArticleKeyword(e.target.value)}
                  className="mt-1 bg-input border-border/40"
                />
              </div>
              {/* <div>
                <label className="text-sm font-medium text-foreground">Publish Date</label>
                <Input
                  type="date"
                  value={newArticleDate}
                  onChange={(e) => setNewArticleDate(e.target.value)}
                  className="mt-1 bg-input border-border/40"
                />
              </div> */}
              {/* <Button
                onClick={handleGenerateArticle}
                disabled={isGenerating || !newArticleKeyword.trim() || !newArticleDate}
                className="cursor-pointer w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Article"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog> */}


        <Button 
          variant="outline" 
          onClick={fetchArticles}
          className="cursor-pointer gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Articles List */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Generated Articles</CardTitle>
          <CardDescription>SEO-optimized articles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {articles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No articles found.</p>
                <p className="text-sm mt-2">Generate your first article using the button above.</p>
              </div>
            ) : (
              articles.map((article) => (
                <div
                  key={article.id}
                  className="p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-background/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{article.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{article.preview}</p>
                      
                      {/* Enhanced SEO Metrics */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <span>Keyword: <strong>{article.keyword}</strong></span>
                        <span>•</span>
                        <span>{article.wordCount.toLocaleString()} words</span>
                        <span>•</span>
                        <span>{article.date}</span>
                        {article.readingTime && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {article.readingTime}
                            </span>
                          </>
                        )}
                        {article.contentScore && (
                          <>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${getContentScoreColor(article.contentScore)}`}>
                              <BarChart3 className="w-3 h-3" />
                              Score: {article.contentScore}%
                            </span>
                          </>
                        )}
                        {article.estimatedTraffic && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Est. traffic: {article.estimatedTraffic}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Tags */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {article.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{article.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge className={`${getStatusStyles(article.status)} border`}>
                      {getStatusDisplayText(article.status)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer text-muted-foreground hover:text-foreground gap-2"
                          onClick={() => setSelectedArticle(article)}
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{article.title}</DialogTitle>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <span>Keyword: <strong>{article.keyword}</strong></span>
                              {article.readingTime && <span>Reading Time: {article.readingTime}</span>}
                              {article.wordCount && <span>Words: {article.wordCount}</span>}
                              {article.contentScore && (
                                <span className={getContentScoreColor(article.contentScore)}>
                                  Content Score: {article.contentScore}%
                                </span>
                              )}
                            </div>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* SEO Metadata Preview */}
                          {(article.metaTitle || article.metaDescription) && (
                            <div className="p-4 bg-muted/30 rounded-lg">
                              <h4 className="font-semibold mb-2">SEO Preview</h4>
                              {article.metaTitle && (
                                <p className="text-blue-600 font-medium text-lg mb-1">{article.metaTitle}</p>
                              )}
                              {article.metaDescription && (
                                <p className="text-gray-600 text-sm">{article.metaDescription}</p>
                              )}
                            </div>
                          )}

                          {/* Article Content */}
                          <div 
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: article.content }}
                          />
                          
                          <div className="flex gap-2 pt-4 border-t border-border/40">
                            <Button variant="outline" className="cursor-pointer border-border/40 bg-transparent flex-1">
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button 
                              className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
                              onClick={() => handleUpdateStatus(article.id, 'published')}
                            >
                              Publish Now
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Select
                      value={article.status}
                      onValueChange={(value) =>
                        handleUpdateStatus(article.id, value as "draft" | "scheduled" | "published")
                      }
                      disabled={updatingStatus === article.id}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs bg-input border-border/40">
                        <SelectValue>
                          {updatingStatus === article.id ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            getStatusDisplayText(article.status)
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteArticle(article.id)}
                      disabled={updatingStatus === article.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
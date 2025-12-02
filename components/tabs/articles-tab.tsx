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
import { Loader2, Plus, Eye, Trash2, Edit2, BarChart3, Clock, Target, RefreshCw, ArrowUpRight, Image as ImageIcon } from "lucide-react"
import { getUser } from "@/lib/auth"
import { getUserPackage } from "@/lib/articleLimits"
import { createCheckout } from "@/lib/lemonSqueezy"
import { useRouter } from "next/navigation"

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
  generatedImages?: string[]
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
  const [userPackage, setUserPackage] = useState<'free' | 'pro' | 'premium' | null>(null)
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [selectedPlanVariantId, setSelectedPlanVariantId] = useState<string | null>(null)
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false)
  const router = useRouter()

  // Insert generated images between article paragraphs
  function renderContentWithImages(content: string, images: string[], maxImagesToInsert = 3) {
    if (!content) return null;
    const imgs = images || [];
    const paragraphs = content
      .split(/<\/p>/i)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.endsWith('</p>') ? s : s + '</p>');

    if (paragraphs.length === 0) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }

    const imagesToInsert = imgs.slice(0, Math.min(maxImagesToInsert, imgs.length));
    const interval = Math.max(1, Math.floor(paragraphs.length / (imagesToInsert.length + 1)));

    const nodes: JSX.Element[] = [];
    let imgIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      nodes.push(
        <div key={`p-${i}`} dangerouslySetInnerHTML={{ __html: paragraphs[i] }} />
      );
      if (imgIndex < imagesToInsert.length && (i + 1) % interval === 0) {
        nodes.push(
          <div key={`img-${imgIndex}`} className="mb-6 rounded-lg overflow-hidden border border-border/40 shadow-md">
            <img 
              src={imagesToInsert[imgIndex]} 
              alt={`Generated image ${imgIndex + 1}`} 
              className="w-full h-auto max-h-[400px] object-cover"
              loading="lazy"
            />
            
          </div>
        );
        imgIndex++;
      }
    }
    // append remaining images if any
    while (imgIndex < imagesToInsert.length) {
      nodes.push(
        <div key={`img-end-${imgIndex}`} className="mb-6 rounded-lg overflow-hidden border border-border/40 shadow-md">
          <img 
            src={imagesToInsert[imgIndex]} 
            alt={`Generated image ${imgIndex + 1}`} 
            className="w-full h-auto max-h-[400px] object-cover"
            loading="lazy"
          />
          
        </div>
      );
      imgIndex++;
    }
    return <div className="prose prose-sm max-w-none">{nodes}</div>;
  }

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: user } = await getUser()
      setCurrentUser(user)
      
      if (user?.id) {
        const packageType = await getUserPackage(user.id)
        setUserPackage(packageType)
      }
    }
    getCurrentUser()
  }, [])

 // ...existing code...
  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true)
      
      if (!currentUser) return
      
      const url = websiteId 
        ? `/api/articles?websiteId=${websiteId}&userId=${currentUser.id}`
        : `/api/articles?userId=${currentUser.id}`
      
      console.log('📡 Fetching articles from:', url)
      
      const response = await fetch(url)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch articles: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('📊 Articles API response:', {
        success: data.success,
        count: data.articles?.length || 0,
        firstArticle: data.articles?.[0] ? {
          id: data.articles[0].id,
          title: data.articles[0].title,
          generatedImages: data.articles[0].generatedImages,
          generatedImagesCount: data.articles[0].generatedImages?.length || 0
        } : null
      })
      
      if (data.success) {
        // normalize snake_case fields to camelCase so the UI can read them
        const normalizedArticles = (data.articles || []).map((a: any) => {
          const rawImages = a.generatedImages ?? a.generated_images ?? a.generated_images_urls ?? a.generated_images_url ?? a.images ?? []
          const parsedImages = typeof rawImages === 'string' ? (() => {
            try { return JSON.parse(rawImages) } catch { return rawImages ? [rawImages] : [] }
          })() : rawImages ?? []
          return { ...a, generatedImages: parsedImages }
        })

        console.log('🐞 Normalized first article images count:', normalizedArticles[0]?.generatedImages?.length ?? 0)
        setArticles(normalizedArticles)
        console.log(`✅ Loaded ${normalizedArticles.length} articles`)
      } else {
        throw new Error(data.error || 'Failed to fetch articles')
      }
    } catch (error) {
      console.error('❌ Error fetching articles:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUser, websiteId])
// ...existing code...

  useEffect(() => {
    if (currentUser) fetchArticles()
  }, [currentUser, websiteId])

  useEffect(() => {
    if (!currentUser) return
    const interval = setInterval(() => fetchArticles(), 30000)
    return () => clearInterval(interval)
  }, [currentUser, websiteId, fetchArticles])

  useEffect(() => {
    if (generatedArticles && generatedArticles.length > 0) {
      setArticles(prev => [...generatedArticles, ...prev])
      if (onArticlesUpdate) onArticlesUpdate([...generatedArticles, ...prev])
    }
  }, [generatedArticles, onArticlesUpdate])

  const handleGenerateArticle = async () => {
    if (!newArticleKeyword.trim() || !currentUser) return

    setIsGenerating(true)

    try {
      const requestBody = {
        keyword: newArticleKeyword.trim(),
        websiteId, 
        userId: currentUser.id,
        generateImages: true,
        imageCount: 2,
      };

      console.log('🔄 Sending API request with:', requestBody);

      const response = await fetch('/api/test-generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json();
      
      console.log('📨 API Response:', {
        success: result.success,
        articleId: result.article?.id,
        imagesGenerated: result.images?.generated || result.article?.generatedImages?.length || 0,
        imageUrls: result.article?.generatedImages
      });

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate article');
      }

      if (result.success && result.article) {
        console.log('✅ Article generated successfully!');
        console.log('📊 Word count:', result.article.wordCount);
        console.log('🖼️ Images generated:', result.images?.generated || 0);
        
        await fetchArticles();
        setNewArticleKeyword("");
        setNewArticleDate("");
        alert(`Article generated successfully! ${result.images?.generated ? `(${result.images.generated} images created)` : ''}`);
      }
    } catch (error) {
      console.error('❌ Error generating article:', error);
      alert(`Failed to generate article: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?') || !currentUser) return
    try {
      const response = await fetch(`/api/articles?id=${id}&userId=${currentUser.id}`, { method: 'DELETE' })
      if (response.ok) {
        setArticles(prev => prev.filter(article => article.id !== id))
        alert('Article deleted successfully!')
      } else throw new Error('Failed to delete article')
    } catch (error) {
      console.error('Error deleting article:', error)
      alert('Failed to delete article. Please try again.')
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: "draft" | "scheduled" | "published") => {
    if (!currentUser) { alert('Please log in to update article status'); return }
    setUpdatingStatus(id)

    try {
      const response = await fetch(`/api/articles?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, userId: currentUser.id }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update article status')

      if (data.success) {
        setArticles(prev => 
          prev.map(article => 
            article.id === id ? { ...article, status: newStatus, ...(newStatus === 'published' && article.status !== 'published' && { date: new Date().toISOString().split('T')[0] }) } : article
          )
        )
      } else throw new Error(data.error || 'Failed to update article status')
    } catch (error) {
      console.error('Error updating article status:', error)
      alert(`Failed to update article status: ${error instanceof Error ? error.message : 'Unknown error'}`)
      await fetchArticles()
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "published": return "bg-green-100 text-green-700 border-green-200"
      case "scheduled": return "bg-blue-100 text-blue-700 border-blue-200"
      case "draft": return "bg-gray-100 text-gray-700 border-gray-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case "published": return "Published"
      case "scheduled": return "Scheduled"
      case "draft": return "Draft"
      default: return status
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
      {userPackage === 'free' && (
        <Card className="border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Upgrade Your Plan to Generate More Articles</h3>
                <p className="text-sm text-blue-700">You're currently on the free plan (3 articles).</p>
              </div>
              <div>
                <Button onClick={() => setIsPlanDialogOpen(true)} variant="secondary">Update Plan</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="flex gap-4">
        <Button variant="outline" onClick={fetchArticles} className="cursor-pointer gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
        {/* Update Plan Button - only show if user is not premium */}
        {userPackage !== 'premium' && (
          <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
            <DialogTrigger asChild>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Your Plan</DialogTitle>
                <DialogDescription>Choose a plan to upgrade your account. After selecting, you'll be redirected to LemonSqueezy to complete the purchase.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Plan</label>
                  <Select onValueChange={(value) => setSelectedPlanVariantId(value)}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Variant IDs: prefer env via NEXT_PUBLIC_LEMON_VARIANT_PRO/PREMIUM, fallback to known 1087280/1087281 */}
                      <SelectItem value={process.env?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15 || "" }>Pro — 15 articles</SelectItem>
                      <SelectItem value={process.env?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || ""}>Premium — 30 articles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setIsPlanDialogOpen(false)}>Cancel</Button>
                  <Button disabled={isCreatingCheckout} onClick={async () => {
                    if (!currentUser) {
                      alert('Please sign in to update your plan.');
                      return setIsPlanDialogOpen(false);
                    }
                    if (!selectedPlanVariantId) {
                      alert('Please select a plan.');
                      return;
                    }
                    try {
                      setIsCreatingCheckout(true)
                      window.location.href = selectedPlanVariantId ?? null;
                      return // fallback in case popup is blocked
                      const checkout = await createCheckout(selectedPlanVariantId, currentUser.email, currentUser.user_metadata?.full_name || currentUser.name, currentUser.id);
                      if (checkout?.url) {
                        // open the checkout in a new tab
                        window.open(checkout.url, '_blank')
                        setIsPlanDialogOpen(false)
                        // Try to refresh user's package after a short delay in case webhook has already fired
                        setTimeout(async () => {
                          try {
                            const packageType = await getUserPackage(currentUser.id)
                            setUserPackage(packageType)
                          } catch (e) {
                            // ignore
                          }
                        }, 5000)
                      } else {
                        alert('Failed to create checkout session. Please try again.')
                      }
                    } catch (err: any) {
                      console.error('Create checkout failed', err)
                      const message = err?.message || err?.error || 'Failed to create checkout session. You can try the public checkout URL instead.'
                      // Try static public fallback URLs if available
                      const proVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_PRO || '1087280';
                      const premVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_PREMIUM || '1087281';
                      const fallbackUrl15 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15;
                      const fallbackUrl30 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30;
                      let fallbackUrl: string | null = null
                      const selected = String(selectedPlanVariantId)
                      if (selected === String(proVar) && fallbackUrl15) fallbackUrl = fallbackUrl15
                      if (selected === String(premVar) && fallbackUrl30) fallbackUrl = fallbackUrl30
                      // If selected variant matches silver monthly, we can use the 15 article URL as default
                      const silverVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY || ''
                      if (!fallbackUrl && selected === String(silverVar) && fallbackUrl15) fallbackUrl = fallbackUrl15

                      if (fallbackUrl) {
                        if (confirm(`${message}\n\nWould you like to open the public checkout URL?`)) {
                          window.open(fallbackUrl, '_blank')
                          setIsPlanDialogOpen(false)
                        }
                      } else {
                        alert(message)
                      }
                    }
                    finally {
                      setIsCreatingCheckout(false)
                    }
                  }}>Proceed</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Generated Articles</CardTitle>
          <CardDescription>SEO-optimized articles with AI-generated images</CardDescription>
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
                <div key={article.id} className="p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-background/50">
                  <div className="flex flex-col items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{article.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{article.preview}</p>

                      <div className="flex flex-row flex-wrap items-center gap-4 text-xs text-muted-foreground mb-2">
                        <span className="w-full md:w-auto">Keyword: <strong>{article.keyword}</strong></span>
                        <span className="w-full md:w-auto order-last md:order-0">{article.wordCount.toLocaleString()} words</span>
                        <span className="w-full md:w-auto">{article.date}</span>
                        {article.readingTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {article.readingTime}
                          </span>
                        )}
                        {article.contentScore && (
                          <span className={`flex items-center gap-1 ${getContentScoreColor(article.contentScore)}`}>
                            <BarChart3 className="w-3 h-3" /> Score: {article.contentScore}%
                          </span>
                        )}
                        {article.estimatedTraffic && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" /> Est. traffic: {article.estimatedTraffic}
                          </span>
                        )}
                      </div>

                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                          {article.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{article.tags.length - 3} more</Badge>
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
                        <Button variant="ghost" size="sm" className="cursor-pointer text-muted-foreground hover:text-foreground gap-2" onClick={() => setSelectedArticle(article)}>
                          <Eye className="w-4 h-4" /> Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[880px] max-h-[80vh] overflow-y-scroll [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <DialogHeader>
                          <DialogTitle>{article.title}</DialogTitle>
                          <div className="flex flex-wrap gap-4 text-sm">
                            <span>Keyword: <strong>{article.keyword}</strong></span>
                            {article.readingTime && <span>Reading Time: {article.readingTime}</span>}
                            {article.wordCount && <span>Words: {article.wordCount}</span>}
                            {article.contentScore && (
                              <span className={getContentScoreColor(article.contentScore)}>Content Score: {article.contentScore}%</span>
                            )}
                          </div>
                        </DialogHeader>
                        <div className="space-y-4">
                          

                          {(article.metaTitle || article.metaDescription) && (
                            <div className="p-4 bg-muted/30 rounded-lg">
                              <h4 className="font-semibold mb-2">SEO Preview</h4>
                              {article.metaTitle && <p className="text-blue-600 font-medium text-lg mb-1">{article.metaTitle}</p>}
                              {article.metaDescription && <p className="text-gray-600 text-sm">{article.metaDescription}</p>}
                            </div>
                          )}
                          
                          {/* Use the new function to render content with images inserted */}
                          {renderContentWithImages(article.content, article.generatedImages || [])}
                          
                          <div className="flex gap-2 pt-4 border-t border-border/40">
                            <Button variant="outline" className="cursor-pointer border-border/40 bg-transparent flex-1">
                              <Edit2 className="w-4 h-4 mr-2" /> Edit
                            </Button>
                            <Button className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground flex-1" onClick={() => handleUpdateStatus(article.id, 'published')}>
                              Publish Now
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Select value={article.status} onValueChange={(value) => handleUpdateStatus(article.id, value as "draft" | "scheduled" | "published")} disabled={updatingStatus === article.id}>
                      <SelectTrigger className="w-32 h-8 text-xs bg-input border-border/40">
                        <SelectValue>
                          {updatingStatus === article.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : getStatusDisplayText(article.status)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="ghost" size="sm" className="cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => handleDeleteArticle(article.id)} disabled={updatingStatus === article.id}>
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
"use client"

import { useState } from "react"
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
import { Loader2, Plus, Eye, Trash2, Edit2 } from "lucide-react"

interface Article {
  id: string
  title: string
  keyword: string
  status: "Published" | "Scheduled" | "Draft"
  date: string
  preview: string
  wordCount: number
}

export function ArticlesTab() {
  const [articles, setArticles] = useState<Article[]>([
    {
      id: "1",
      title: "The Complete Guide to AI Content Generation",
      keyword: "AI content generation",
      status: "Published",
      date: "Oct 20, 2025",
      preview:
        "Discover how AI-powered content generation is revolutionizing the way businesses create marketing materials...",
      wordCount: 2500,
    },
    {
      id: "2",
      title: "How to Choose the Best SEO Automation Tool",
      keyword: "SEO automation tools",
      status: "Scheduled",
      date: "Oct 25, 2025",
      preview:
        "In this comprehensive guide, we'll explore the top SEO automation tools available and help you choose the right one...",
      wordCount: 2200,
    },
    {
      id: "3",
      title: "Blog Post Generators: A Comprehensive Review",
      keyword: "blog post generator",
      status: "Draft",
      date: "Oct 22, 2025",
      preview:
        "We've tested the leading blog post generators to help you find the perfect tool for your content needs...",
      wordCount: 1800,
    },
  ])

  const [isGenerating, setIsGenerating] = useState(false)
  const [newArticleKeyword, setNewArticleKeyword] = useState("")
  const [newArticleDate, setNewArticleDate] = useState("")
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  const handleGenerateArticle = async () => {
    if (!newArticleKeyword.trim() || !newArticleDate) return

    setIsGenerating(true)

    // Simulate API call to generate article
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const newArticle: Article = {
      id: Math.random().toString(),
      title: `The Ultimate Guide to ${newArticleKeyword}`,
      keyword: newArticleKeyword,
      status: "Draft",
      date: newArticleDate,
      preview: `Explore everything you need to know about ${newArticleKeyword}. This comprehensive guide covers best practices, strategies, and actionable tips...`,
      wordCount: Math.floor(Math.random() * 1500) + 1500,
    }

    setArticles([...articles, newArticle])
    setNewArticleKeyword("")
    setNewArticleDate("")
    setIsGenerating(false)
  }

  const handleDeleteArticle = (id: string) => {
    setArticles(articles.filter((article) => article.id !== id))
  }

  const handleUpdateStatus = (id: string, newStatus: "Published" | "Scheduled" | "Draft") => {
    setArticles(articles.map((article) => (article.id === id ? { ...article, status: newStatus } : article)))
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "Published":
        return "bg-green-100 text-green-700"
      case "Scheduled":
        return "bg-blue-100 text-blue-700"
      case "Draft":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === "Published").length,
    scheduled: articles.filter((a) => a.status === "Scheduled").length,
    draft: articles.filter((a) => a.status === "Draft").length,
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

      {/* Generate Article Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
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
            <div>
              <label className="text-sm font-medium text-foreground">Publish Date</label>
              <Input
                type="date"
                value={newArticleDate}
                onChange={(e) => setNewArticleDate(e.target.value)}
                className="mt-1 bg-input border-border/40"
              />
            </div>
            <Button
              onClick={handleGenerateArticle}
              disabled={isGenerating || !newArticleKeyword.trim() || !newArticleDate}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
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
      </Dialog>

      {/* Articles List */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Generated Articles</CardTitle>
          <CardDescription>SEO-optimized articles scheduled for publication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {articles.map((article) => (
              <div
                key={article.id}
                className="p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">{article.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{article.preview}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Keyword: {article.keyword}</span>
                      <span>•</span>
                      <span>{article.wordCount.toLocaleString()} words</span>
                      <span>•</span>
                      <span>{article.date}</span>
                    </div>
                  </div>
                  <Badge className={getStatusStyles(article.status)}>{article.status}</Badge>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground gap-2"
                        onClick={() => setSelectedArticle(article)}
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{article.title}</DialogTitle>
                        <DialogDescription>{article.keyword}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="prose prose-sm max-w-none">
                          <p>{article.preview}</p>
                          <p>
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                            labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
                            laboris nisi ut aliquip ex ea commodo consequat.
                          </p>
                          <p>
                            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
                            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                            mollit anim id est laborum.
                          </p>
                        </div>
                        <div className="flex gap-2 pt-4 border-t border-border/40">
                          <Button variant="outline" className="border-border/40 bg-transparent flex-1">
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1">
                            Publish Now
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Select
                    value={article.status}
                    onValueChange={(value) =>
                      handleUpdateStatus(article.id, value as "Published" | "Scheduled" | "Draft")
                    }
                  >
                    <SelectTrigger className="w-32 h-8 text-xs bg-input border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteArticle(article.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

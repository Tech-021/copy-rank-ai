"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Zap, TrendingUp, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={"/"}><Image src="/topicanalyzer-logo.png" alt="" width={120} height={30} /></Link>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={onSignIn}
              className="cursor-pointer bg-white border border-[#dbdadd] hover:bg-white hover:text-[#838383] text-foreground text-sm rounded-full shadow-[inset_0_0_4px_2px_rgba(255,255,255,0.3),0_0_10px_2px_rgba(0,0,0,0.4)] transition"
            >
              Sign In
            </Button>
            <Button
              onClick={onSignUp}
              className="cursor-pointer bg-blue-700 hover:bg-blue-700 text-primary-foreground rounded-full shadow-[inset_0_0_4px_2px_rgba(255,255,255,0.2),0_0_8px_1px_rgba(36,101,255,0.8)] opacity-100 will-change-auto hover:bg-blue-700 transition text-sm"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-[74px] font-bold text-foreground mb-6 text-balance">
            AI-Powered SEO Content <br />
            at Scale
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Analyze your website, discover low-competition keywords, and
            generate 30 SEO-optimized articles per month automatically.
          </p>
          <Button
            onClick={onSignUp}
            size="lg"
            className="cursor-pointer bg-blue-700 text-primary-foreground gap-2 rounded-full border-0 shadow-[inset_0_0_4px_2px_rgba(255,255,255,0.2),0_0_8px_1px_rgba(36,101,255,0.8)] opacity-100 will-change-auto hover:bg-blue-700 transition text-sm"
          >
            Try Viral SEO Free <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-20">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-[#2469fe1a] flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#2469fe]" />
              </div>
              <CardTitle className="card-heading">Instant Analysis</CardTitle>
              <CardDescription>
                Analyze any website to detect niche and topic in seconds
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-[#2469fe1a] flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[#2469fe]" />
              </div>
              <CardTitle className="card-heading">Keyword Discovery</CardTitle>
              <CardDescription>
                Find low-competition, high-volume keywords automatically
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-[#2469fe1a] flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-[#2469fe]" />
              </div>
              <CardTitle className="card-heading">
                AI Article Generation
              </CardTitle>
              <CardDescription>
                Generate SEO-optimized articles with Qwen AI
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}


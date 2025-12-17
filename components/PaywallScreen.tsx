// components/PaywallScreen.tsx
"use client";

import React from 'react';
import { useState } from 'react';
import { CreditCard, Shield, Zap, Search, FileText, TrendingUp, Check } from 'lucide-react';

interface PaywallScreenProps {
  userEmail?: string;
  userId?: string;
}

const PaywallScreen: React.FC<PaywallScreenProps> = ({
  userId,
  userEmail
}) => {
  // Environment variables for checkout URLs
  const checkoutUrl15 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15 || '';
  const checkoutUrl30 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || '';

  const handleCheckout = async (checkoutUrl: string, userEmail: string, userId: string) => {
    if (!checkoutUrl) {
      console.error("No checkout URL found");
      return;
    }

    if (!userEmail || !userId) {
      console.error("User email or ID is missing");
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const successUrl = `${baseUrl}/payment/callback`;
    
    const fullCheckoutUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(userEmail)}&checkout[custom][user_id]=${encodeURIComponent(userId)}&checkout[product_options][redirect_url]=${encodeURIComponent(successUrl)}`;
    
    window.location.href = fullCheckoutUrl;
  };

  const features = [
    {
      icon: <Search className="w-5 h-5" />,
      text: "Website niche analysis"
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      text: "AI-powered keyword research"
    },
    {
      icon: <FileText className="w-5 h-5" />,
      text: "SEO-optimized article generation"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      text: "Competitor content analysis"
    }
  ];

  const plans = [
    {
      id: '15',
      name: 'Starter',
      articles: 15,
      price: 58,
      checkoutUrl: checkoutUrl15,
      popular: false
    },
    {
      id: '30',
      name: 'Professional',
      articles: 30,
      price: 78,
      checkoutUrl: checkoutUrl30,
      popular: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Start your 3-day free trial. No credit card required.
          </p>
          {userEmail && (
            <p className="text-sm text-gray-500">
              Signed in as: <span className="font-medium">{userEmail}</span>
            </p>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl ${
                plan.popular
                  ? 'ring-4 ring-blue-500 scale-105 md:scale-110'
                  : 'border-2 border-gray-200'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Card Header */}
              <div className={`p-8 text-center ${
                plan.popular
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700 rounded-t-2xl'
                  : 'bg-gradient-to-r from-gray-700 to-gray-800 rounded-t-2xl'
              } text-white`}>
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <div className="flex items-baseline justify-center mb-4">
                  <span className="text-5xl font-bold">${plan.price}</span>
                  <span className="text-gray-300 ml-2">/month</span>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg py-2 px-4 inline-block">
                  <span className="text-sm font-semibold">
                    {plan.articles} Articles Per Month
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-8">
                {/* Features List */}
                <div className="space-y-4 mb-8">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className={`shrink-0 ${
                        plan.popular ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        <Check className="w-5 h-5" />
                      </div>
                      <span className="text-gray-700">{feature.text}</span>
                    </div>
                  ))}
                  <div className="flex items-center space-x-3 pt-2 border-t border-gray-200">
                    <div className={`shrink-0 ${
                      plan.popular ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      <Check className="w-5 h-5" />
                    </div>
                    <span className="text-gray-700 font-semibold">
                      {plan.articles} AI-generated articles per month
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleCheckout(plan.checkoutUrl, userEmail || '', userId || '')}
                  disabled={!plan.checkoutUrl || !userEmail || !userId}
                  className={`cursor-pointer w-full font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-800 hover:bg-gray-900 text-white'
                  }`}
                >
                  try for $1
                  <CreditCard className="w-5 h-5 ml-2" />
                </button>

                {/* Free Trial Info */}
                <p className="text-center text-sm text-gray-500 mt-4">
                  3 days for $1 • Cancel anytime
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Security Badge */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center text-gray-600 text-sm bg-white px-6 py-3 rounded-full shadow-md">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Secure payment powered by LemonSqueezy
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center max-w-2xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              What's included in your free trial?
            </h3>
            <p className="text-gray-600">
              Get full access to all features for 3 days. No credit card required to start.
              You can cancel anytime during the trial period with no charges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaywallScreen;
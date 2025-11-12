// components/PaywallScreen.tsx
"use client";

import React from 'react';
import { useState } from 'react';
import { CreditCard, Shield, Zap, Search, FileText, TrendingUp } from 'lucide-react';

interface PaywallScreenProps {
  userEmail?: string;
  userId?: string;
}

const PaywallScreen: React.FC<PaywallScreenProps> = ({
  userId,
  userEmail
}) => {

const url = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL || '';

const handleCheckout = async (checkoutUrl: string, userEmail : string , userId : string) => {
    if (checkoutUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const successUrl = `${baseUrl}/payment/callback`;
      // console.log("Redirecting to checkout URL:", checkoutUrl+`?checkout[email]=${userEmail}&checkout[custom][user_id]=${userId}`);
     window.location.href = checkoutUrl+`?checkout[email]=${userEmail}&checkout[custom][user_id]=${userId}&checkout[product_options][redirect_url]=${encodeURIComponent(successUrl)}`; 

  } else {
    console.error("No checkout URL found");
  }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white">
          <h1 className="text-3xl font-bold mb-2">Start Your 3-Day Free Trial</h1>
          <p className="text-blue-100 opacity-90">
            Unlock full Viral SEO capabilities. No credit card required.
          </p>
          {userEmail && (
            <p className="text-blue-200 text-sm mt-2">
              Signed in as: {userEmail}
            </p>
          )}
        </div>

        {/* Pricing Card */}
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center items-baseline mb-4">
              <span className="text-4xl font-bold text-gray-900">$29</span>
              <span className="text-gray-600 ml-2">/month</span>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg py-2 px-4 inline-block">
              <span className="text-green-700 font-semibold">
                3 days free • Cancel anytime
              </span>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-4 mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="text-blue-600">
                  {feature.icon}
                </div>
                <span className="text-gray-700">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => handleCheckout(url, userEmail || '', userId || '')}
              className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:cursor-not-allowed"
            >Start Your Free Trial
              <CreditCard className="w-5 h-5 ml-2" />
            </button>
          </div>

          {/* Security Badge */}
          <div className="text-center mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center text-gray-500 text-sm">
              <Shield className="w-4 h-4 mr-2" />
              Secure payment powered by LemonSqueezy
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaywallScreen;
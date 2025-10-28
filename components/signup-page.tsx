"use client";

import { useState, useEffect } from "react";
import { signUp, signUpWithGoogle } from "../lib/auth";
import { useToast } from "./ui/toast";
import { Eye, EyeOff, Check, Info } from "lucide-react"; // Added Info icon
import Image from "next/image";

interface SignUpPageProps {
  onSignUpSuccess: (email: string) => void;
  onBackToLanding: () => void;
  onToggleLogin: () => void;
}

const testimonials = [
  {
    id: 1,
    quote:
      "With Salestable, I can ensure that our sales team is equipped with in-depth knowledge of the various aspects of plastic injection molding required to be an effective sales professional",
    author: "Rob L",
    title: "Director, Sales Operations @ HiTech Plastics & Molds",
    rating: 5,
  },
  {
    id: 2,
    quote:
      "Salestable has been a great partner for ContentBacon. We've gone from being a company where the founders are driving the sales to an organization with an effective sales team that is growing and thriving",
    author: "Wendy L",
    title: "Co-founder - ContentBacon",
    rating: 5,
  },
];

export function SignUpPage({
  onSignUpSuccess,
  onBackToLanding,
  onToggleLogin,
}: SignUpPageProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); // Add separate state for info/success messages
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const toast = useToast();

  // Auto-cycle testimonials every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrevTestimonial = () => {
    setCurrentTestimonial(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length
    );
  };

  const passwordRequirements = [
    { label: "At least 8 characters", met: formData.password.length >= 8 },
    {
      label: "Contains uppercase letter",
      met: /[A-Z]/.test(formData.password),
    },
    {
      label: "Contains lowercase letter",
      met: /[a-z]/.test(formData.password),
    },
    { label: "Contains number", met: /\d/.test(formData.password) },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear messages when user starts typing
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage(""); // Clear previous messages

    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions");
      return;
    }

    setIsLoading(true);
    const { data, error } = await signUp(formData.email, formData.password);
    setIsLoading(false);

    if (error) {
      const msg =
        (error as any).message ?? String(error) ?? "Error creating account";
      setError(msg);
      try {
        toast.showToast({
          title: "Sign up failed",
          description: msg,
          type: "error",
        });
      } catch {}
      return;
    }

    const session = (data as any)?.session ?? null;
    if (!session) {
      const msg =
        "Please check your email to confirm your account before signing in.";
      setMessage(msg); // Use message state instead of error for info messages
      try {
        toast.showToast({
          title: "Confirm your email",
          description: msg,
          type: "info",
        });
      } catch {
        /* ignore */
      }
      // Don't set this as an error - it's a success that requires email confirmation
      return;
    }

    try {
      toast.showToast({
        title: "Account created",
        description: "Welcome! You are now signed in.",
        type: "success",
      });
    } catch {}

    onSignUpSuccess(formData.email);
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError("");
    setMessage(""); // Clear messages

    const { data, error } = await signUpWithGoogle();
    setGoogleLoading(false);

    if (error) {
      const msg =
        (error as any).message ??
        String(error) ??
        "Error signing up with Google";
      setError(msg);
      try {
        toast.showToast({
          title: "Google sign up failed",
          description: msg,
          type: "error",
        });
      } catch {}
    }
  };

  // const testimonial = testimonials[currentTestimonial]

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#2469fe] rounded-3xl m-4 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center">
          <h2 className="text-white text-3xl font-semibold mb-12"></h2>
          <div className="space-y-6">
            <div className="text-white text-5xl"></div>
            <p className="text-white text-lg leading-relaxed font-light"></p>
            <div className="flex justify-center gap-1">
              {/* {[...Array(testimonial.rating)].map((_, i) => (
                <span key={i} className="text-yellow-300 text-xl">★</span>
              ))} */}
            </div>
            <div className="flex flex-col items-center justify-center">
              {/* <p className="text-white font-semibold text-lg">{testimonial.author}</p>
              <p className="text-blue-100 text-sm">{testimonial.title}</p> */}
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-center gap-2 mt-12">
          {/* <button onClick={handlePrevTestimonial} className="text-white hover:text-blue-100 transition">◀</button>
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentTestimonial(index)}
              className={`h-1 rounded-full transition-all ${index === currentTestimonial ? "bg-white w-8" : "bg-blue-300 w-2"}`}
            />
          ))} */}
          {/* <button onClick={handleNextTestimonial} className="text-white hover:text-blue-100 transition">▶</button> */}
        </div>
      </div>

      {/* Right Side - SignUp Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-16">
        <div>
          {/* <div className="mb-12">
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">⚡</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">salestable</span>
            </div>
          )}

          {/* Info/Success message */}
          {message && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <p className="text-blue-400 text-sm">{message}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name field */}
            <div>
              {/* Link to Sign In */}
              <div className="flex flex-col gap-4 mb-4 justify-start items-start text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  Create an Account
                </h2>
                <p className="text-gray-600 ">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={onToggleLogin}
                    className="text-blue-500 hover:text-blue-600 font-medium"
                  >
                    Sign In
                  </button>
                </p>
              </div>
              {error && <p className="text-red-500">{error}</p>}
              <p>Full Name</p>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>

            {/* Email */}
            <div>
              <p>Email Address</p>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <p>Password</p>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="mb-15" size={20} />
                ) : (
                  <Eye className="mb-15" size={20} />
                )}
              </button>

              {/* Password requirements */}
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.label}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        req.met
                          ? "bg-green-500/20 border border-green-500/50"
                          : "bg-gray-200/30 border border-gray-300"
                      }`}
                    >
                      {req.met && (
                        <Check size={12} className="text-green-400" />
                      )}
                    </div>
                    <span
                      className={req.met ? "text-green-400" : "text-gray-400"}
                    >
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rest of your component remains the same... */}
            {/* Confirm password field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-black mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-5 h-5 border border-gray-300 rounded cursor-pointer checked:bg-blue-500 checked:border-blue-500"
              />
              <span className="text-gray-600 text-sm">
                I agree to the{" "}
                <a href="#" className="text-blue-500 hover:text-blue-600">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-500 hover:text-blue-600">
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>

            {/* Social Buttons */}
            <div className="flex gap-5 mt-4">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={googleLoading}
                className="border border-gray-300 rounded-lg py-3 w-full flex items-center justify-center gap-2 hover:bg-gray-50 transition"
              >
                <Image src="/google.png" width={30} height={30} alt="Google" />
                <span className="text-gray-700 font-medium">Google</span>
              </button>
              {/* <button className="border border-gray-300 rounded-lg py-3 w-full flex items-center justify-center gap-2 hover:bg-gray-50 transition">
                <Image src="/linked.png" width={30} height={30} alt="LinkedIn" />
                <span className="text-gray-700 font-medium">LinkedIn</span>
              </button> */}
            </div>
          </form>
        </div>

        {/* Footer */}
        {/* <div className="text-center text-gray-500 text-sm space-y-1 mt-8">
          <p>© 2025 Salestable Inc. All rights reserved.</p>
          <div className="flex items-center justify-center gap-2">
            <a href="#" className="text-blue-500 hover:text-blue-600">Terms & Conditions</a>
            <span>and</span>
            <a href="#" className="text-blue-500 hover:text-blue-600">Privacy Policy</a>
          </div>
        </div> */}
      </div>
    </div>
  );
}

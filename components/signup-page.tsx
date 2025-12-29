// "use client";

// import { useState, useEffect } from "react";
// import { signUp, signUpWithGoogle } from "../lib/auth";
// import { useToast } from "./ui/toast";
// import { Eye, EyeOff, Check, Info } from "lucide-react"; // Added Info icon
// import Image from "next/image";

// interface SignUpPageProps {
//   onSignUpSuccess: (email: string) => void;
//   onBackToLanding: () => void;
//   onToggleLogin: () => void;
// }

// const testimonials = [
//   {
//     id: 1,
//     quote:
//       "With Salestable, I can ensure that our sales team is equipped with in-depth knowledge of the various aspects of plastic injection molding required to be an effective sales professional",
//     author: "Rob L",
//     title: "Director, Sales Operations @ HiTech Plastics & Molds",
//     rating: 5,
//   },
//   {
//     id: 2,
//     quote:
//       "Salestable has been a great partner for ContentBacon. We've gone from being a company where the founders are driving the sales to an organization with an effective sales team that is growing and thriving",
//     author: "Wendy L",
//     title: "Co-founder - ContentBacon",
//     rating: 5,
//   },
// ];

// export function SignUpPage({
//   onSignUpSuccess,
//   onBackToLanding,
//   onToggleLogin,
// }: SignUpPageProps) {
//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     password: "",
//     confirmPassword: "",
//   });
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [googleLoading, setGoogleLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [message, setMessage] = useState(""); // Add separate state for info/success messages
//   const [agreedToTerms, setAgreedToTerms] = useState(false);
//   const [currentTestimonial, setCurrentTestimonial] = useState(0);
//   const toast = useToast();

//   // Auto-cycle testimonials every 5 seconds
//   useEffect(() => {
//     const interval = setInterval(() => {
//       setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
//     }, 5000);
//     return () => clearInterval(interval);
//   }, []);

//   const handleNextTestimonial = () => {
//     setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
//   };

//   const handlePrevTestimonial = () => {
//     setCurrentTestimonial(
//       (prev) => (prev - 1 + testimonials.length) % testimonials.length
//     );
//   };

//   const passwordRequirements = [
//     { label: "At least 8 characters", met: formData.password.length >= 8 },
//     {
//       label: "Contains uppercase letter",
//       met: /[A-Z]/.test(formData.password),
//     },
//     {
//       label: "Contains lowercase letter",
//       met: /[a-z]/.test(formData.password),
//     },
//     { label: "Contains number", met: /\d/.test(formData.password) },
//   ];

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//     // Clear messages when user starts typing
//     setError("");
//     setMessage("");
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");
//     setMessage(""); // Clear previous messages

//     if (
//       !formData.name ||
//       !formData.email ||
//       !formData.password ||
//       !formData.confirmPassword
//     ) {
//       setError("Please fill in all fields");
//       return;
//     }

//     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
//       setError("Please enter a valid email address");
//       return;
//     }

//     if (formData.password.length < 8) {
//       setError("Password must be at least 8 characters");
//       return;
//     }

//     if (formData.password !== formData.confirmPassword) {
//       setError("Passwords do not match");
//       return;
//     }

//     if (!agreedToTerms) {
//       setError("Please agree to the terms and conditions");
//       return;
//     }

//     setIsLoading(true);
//     const { data, error } = await signUp(formData.email, formData.password);
//     setIsLoading(false);

//     if (error) {
//       const msg =
//         (error as any).message ?? String(error) ?? "Error creating account";
//       setError(msg);
//       try {
//         toast.showToast({
//           title: "Sign up failed",
//           description: msg,
//           type: "error",
//         });
//       } catch {}
//       return;
//     }

//     const session = (data as any)?.session ?? null;
//     if (!session) {
//       const msg =
//         "Please check your email to confirm your account before signing in.";
//       setMessage(msg); // Use message state instead of error for info messages
//       try {
//         toast.showToast({
//           title: "Confirm your email",
//           description: msg,
//           type: "info",
//         });
//       } catch {
//         /* ignore */
//       }
//       // Don't set this as an error - it's a success that requires email confirmation
//       return;
//     }

//     try {
//       toast.showToast({
//         title: "Account created",
//         description: "Welcome! You are now signed in.",
//         type: "success",
//       });
//     } catch {}

//     onSignUpSuccess(formData.email);
//   };

//   const handleGoogleSignUp = async () => {
//     setGoogleLoading(true);
//     setError("");
//     setMessage(""); // Clear messages

//     const { data, error } = await signUpWithGoogle();
//     setGoogleLoading(false);

//     if (error) {
//       const msg =
//         (error as any).message ??
//         String(error) ??
//         "Error signing up with Google";
//       setError(msg);
//       try {
//         toast.showToast({
//           title: "Google sign up failed",
//           description: msg,
//           type: "error",
//         });
//       } catch {}
//     }
//   };

//   // const testimonial = testimonials[currentTestimonial]

//   return (
//     <div className="h-screen w-screen flex overflow-hidden bg-white">
//       {/* Left Side - Testimonials */}
//       <div className="hidden lg:flex lg:w-1/2 bg-[#2469fe] rounded-none p-12 flex-col justify-between relative overflow-hidden">
//         <div className="absolute inset-0 opacity-10">
//           <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
//         </div>
//         <div className="relative z-10 text-center">
//           <h2 className="text-white text-3xl font-semibold mb-12"></h2>
//           <div className="space-y-6">
//             <div className="text-white text-5xl"></div>
//             <p className="text-white text-lg leading-relaxed font-light"></p>
//             <div className="flex justify-center gap-1"></div>
//             <div className="flex flex-col items-center justify-center"></div>
//           </div>
//         </div>
//         <div className="relative z-10 flex items-center justify-center gap-2 mt-12"></div>
//       </div>

//       {/* Right Side - SignUp Form */}
//       <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-16">
//         <div>
//           {/* Info/Success message */}
//           {message && (
//             <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
//               <div className="flex items-center gap-2">
//                 <Info className="w-4 h-4 text-blue-400" />
//                 <p className="text-blue-400 text-sm">{message}</p>
//               </div>
//             </div>
//           )}

//           {/* Form */}
//           <form onSubmit={handleSubmit} className="space-y-5">
//             {/* Name field */}
//             <div>
//               {/* Link to Sign In */}
//               <div className="flex flex-col gap-4 mb-4 justify-start items-start text-center">
//                 <h2 className="text-2xl font-bold text-gray-900">
//                   Create an Account
//                 </h2>
//                 <p className="text-gray-600 ">
//                   Already have an account?{" "}
//                   <button
//                     type="button"
//                     onClick={onToggleLogin}
//                     className="cursor-pointer text-blue-500 hover:text-blue-600 font-medium"
//                   >
//                     Sign In
//                   </button>
//                 </p>
//               </div>
//               {error && <p className="text-red-500">{error}</p>}
//               <p>Full Name</p>
//               <input
//                 type="text"
//                 name="name"
//                 value={formData.name}
//                 onChange={handleChange}
//                 placeholder="John Doe"
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
//               />
//             </div>

//             {/* Email */}
//             <div>
//               <p>Email Address</p>
//               <input
//                 type="email"
//                 name="email"
//                 value={formData.email}
//                 onChange={handleChange}
//                 placeholder="you@example.com"
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
//               />
//             </div>

//             {/* Password */}
//             <div className="relative">
//               <p>Password</p>
//               <input
//                 type={showPassword ? "text" : "password"}
//                 name="password"
//                 value={formData.password}
//                 onChange={handleChange}
//                 placeholder="••••••••"
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowPassword(!showPassword)}
//                 className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
//               >
//                 {showPassword ? (
//                   <EyeOff className="mb-15" size={20} />
//                 ) : (
//                   <Eye className="mb-15" size={20} />
//                 )}
//               </button>

//               {/* Password requirements */}
//               <div className="mt-2 space-y-1">
//                 {passwordRequirements.map((req) => (
//                   <div
//                     key={req.label}
//                     className="flex items-center gap-2 text-xs"
//                   >
//                     <div
//                       className={`w-4 h-4 rounded-full flex items-center justify-center ${
//                         req.met
//                           ? "bg-green-500/20 border border-green-500/50"
//                           : "bg-gray-200/30 border border-gray-300"
//                       }`}
//                     >
//                       {req.met && (
//                         <Check size={12} className="text-green-400" />
//                       )}
//                     </div>
//                     <span
//                       className={req.met ? "text-green-400" : "text-gray-400"}
//                     >
//                       {req.label}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div>
//               <label
//                 htmlFor="confirmPassword"
//                 className="block text-sm font-medium text-black mb-2"
//               >
//                 Confirm Password
//               </label>
//               <div className="relative">
//                 <input
//                   id="confirmPassword"
//                   type={showConfirmPassword ? "text" : "password"}
//                   name="confirmPassword"
//                   value={formData.confirmPassword}
//                   onChange={handleChange}
//                   placeholder="••••••••"
//                   className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowConfirmPassword(!showConfirmPassword)}
//                   className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
//                 >
//                   {showConfirmPassword ? (
//                     <EyeOff className="w-5 h-5" />
//                   ) : (
//                     <Eye className="w-5 h-5" />
//                   )}
//                 </button>
//               </div>
//             </div>

//             {/* Terms */}
//             <label className="flex items-center gap-2 cursor-pointer">
//               <input
//                 type="checkbox"
//                 checked={agreedToTerms}
//                 onChange={(e) => setAgreedToTerms(e.target.checked)}
//                 className="w-5 h-5 border border-gray-300 rounded cursor-pointer checked:bg-blue-500 checked:border-blue-500"
//               />
//               <span className="text-gray-600 text-sm">
//                 I agree to the{" "}
//                 <a href="#" className="text-blue-500 hover:text-blue-600">
//                   Terms of Service
//                 </a>{" "}
//                 and{" "}
//                 <a href="#" className="text-blue-500 hover:text-blue-600">
//                   Privacy Policy
//                 </a>
//               </span>
//             </label>

//             {/* Submit */}
//             <button
//               type="submit"
//               disabled={isLoading}
//               className="cursor-pointer w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition"
//             >
//               {isLoading ? "Creating account..." : "Sign Up"}
//             </button>

//             {/* Social Buttons */}
//             <div className="flex gap-5 mt-4">
//               <button
//                 type="button"
//                 onClick={handleGoogleSignUp}
//                 disabled={googleLoading}
//                 className="cursor-pointer border border-gray-300 rounded-lg py-3 w-full flex items-center justify-center gap-2 hover:bg-gray-50 transition"
//               >
//                 <Image src="/google.png" width={30} height={30} alt="Google" />
//                 <span className="text-gray-700 font-medium">Google</span>
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { signUpWithGoogle } from "../lib/auth";
import { useToast } from "./ui/toast";
import { ArrowLeft, Info } from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

// Testimonials data
const testimonials = [
  {
    name: "Soufyane Benguemra",
    handle: "@SoufyaneBenguemra",
    text: "best tool ever",
    image: "/pic3.jpg",
  },
  {
    name: "Rehman Abdur",
    handle: "@RehmanAbdur",
    text: "Great for SEO research.",
    image: "/pic1.png",
  },
  {
    name: "Praveen Anantharaman",
    handle: "@PraveenAnantharaman",
    text: "Adds value for reaching your ICP, providing information for positioning and marketing efficiency!",
    image: "/pic4.jpg",
  },
  {
    name: "Alexander Bastien",
    handle: "@AlexanderBastien",
    text: "Very useful SEO tool!",
    image: "/pic5.jpg",
  },
  {
    name: "Mike D.",
    handle: "@mikedevstudio",
    text: "As a startup, we needed proven results from companies using Viral SEO.",
    image: "/pic6.jpg",
  },
  {
    name: "Philippe Varin",
    handle: "@PhilippeVarin",
    text: "Great tool to find ranking content ideas!..",
    image: "/pic2.jpg",
  },
];

// Split testimonials for animation columns
const column1 = testimonials.filter((_, i) => i % 2 === 0);
const column2 = testimonials.filter((_, i) => i % 2 === 1);

// Testimonial Card
const TestimonialCard = ({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) => (
  <div className="bg-white rounded-xl p-5 mb-4 border border-gray-200/60 hover:border-gray-300 transition-colors">
    <div className="flex items-start gap-3 mb-3">
      <img
        src={testimonial.image}
        alt={testimonial.name}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 text-[15px] leading-tight">
          {testimonial.name}
        </h4>
        <p className="text-[13px] text-gray-500 leading-tight">
          {testimonial.handle}
        </p>
      </div>
    </div>
    <p className="text-gray-700 text-[14px] leading-relaxed">
      "{testimonial.text}"
    </p>
  </div>
);

interface SignUpPageProps {
  onSignUpSuccess: (email: string) => void;
  onBackToLanding: () => void;
  onToggleLogin: () => void;
}

export function SignUpPage({
  onSignUpSuccess,
  onBackToLanding,
  onToggleLogin,
}: SignUpPageProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const toast = useToast();

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError("");
    setMessage("");

    const { data, error } = await signUpWithGoogle();
    setGoogleLoading(false);

    if (error) {
      const msg =
        (error as any).message ?? String(error) ?? "Error signing up with Google";
      setError(msg);
      try {
        toast.showToast({
          title: "Google sign up failed",
          description: msg,
          type: "error",
        });
      } catch {}
    } else {
      setMessage("");
      if (data?.email) onSignUpSuccess(data.email);
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-black">
      {/* Left Side - Sign Up Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Back Button */}
        <div className="pt-6 pl-6">
          <Link href="/">
            <Button className="bg-[#5AFF78] hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-full px-5 py-2.5 text-[14px] font-medium hover:text-gray-900 cursor-pointer flex items-center gap-2 transition-colors">
              <ArrowLeft size={16} /> Go to Home
            </Button>
          </Link>
        </div>

        {/* Sign Up Form Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 lg:px-16">
          <div className="max-w-md w-full">
            {/* Info Message */}
            {message && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <p className="text-blue-600 text-sm">{message}</p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-[32px] font-bold text-white mb-3">
                Create your free Account
              </h2>
              <p className="text-gray-400 text-[14px] leading-relaxed">
                Join for free to see what drives your competitors' SEO traffic,
                create better content on autopilot, and rank higher in AI search
                results.
              </p>
              <p className="text-gray-400 text-[16px] mt-3">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={onToggleLogin}
                  className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Google Sign Up */}
            <div className="space-y-4">
              <button
                onClick={handleGoogleSignUp}
                disabled={googleLoading}
                className="cursor-pointer  bg-[#5AFF78] rounded-lg py-3.5 px-6 w-full flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Image src="/google.png" width={24} height={24} alt="Google" />
                <span className="text-gray-700 font-medium text-[15px]">
                  {googleLoading ? "Signing up..." : "Sign up with Google"}
                </span>
              </button>

              <p className="text-gray-400 text-[13px] text-center leading-relaxed px-4">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Animated Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 bg-white relative overflow-hidden">
        {/* Subtle pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 w-full px-12 py-16">
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-[32px] font-bold text-gray-900 mb-3 leading-tight">
              Proven results from companies
              <br />
              using Viral SEO.
            </h2>
          </div>

          {/* Two Column Animated Scroll */}
          <div className="flex gap-5 h-[calc(100vh-220px)]">
            {/* Column 1 - Moves Down */}
            <div className="flex-1 overflow-hidden relative">
              <motion.div
                animate={{ y: [0, -100 * column1.length * 2] }}
                transition={{
                  duration: 30,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {[...column1, ...column1, ...column1].map(
                  (testimonial, index) => (
                    <TestimonialCard
                      key={`col1-${index}`}
                      testimonial={testimonial}
                    />
                  )
                )}
              </motion.div>
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
            </div>

            {/* Column 2 - Moves Up */}
            <div className="flex-1 overflow-hidden relative">
              <motion.div
                animate={{ y: [-100 * column2.length * 2, 0] }}
                transition={{
                  duration: 30,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {[...column2, ...column2, ...column2].map(
                  (testimonial, index) => (
                    <TestimonialCard
                      key={`col2-${index}`}
                      testimonial={testimonial}
                    />
                  )
                )}
              </motion.div>
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
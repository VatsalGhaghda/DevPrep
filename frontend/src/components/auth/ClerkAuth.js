import { SignIn, SignUp, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ClerkAuth() {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && user) {
      navigate('/dashboard');
    }
  }, [isSignedIn, user, navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-12">
        {/* Left side - Branding */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent mb-6">
            DevPrep
          </h1>
          <p className="text-lg lg:text-xl text-slate-300 mb-8">
            AI-powered interview preparation platform
          </p>
          <div className="flex flex-col gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Mock interviews with real-time AI feedback</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Technical assessments & coding challenges</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Resume analysis & optimization tips</span>
            </div>
          </div>
        </div>

        {/* Right side - Clerk Auth */}
        <div className="w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-slate-400 mt-2">Sign in to your account</p>
            </div>

            <SignIn
              path="/sign-in"
              routing="path"
              signUpUrl="/sign-up"
              redirectUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent border-0 shadow-none',
                  headerTitle: 'text-white text-xl font-semibold',
                  headerSubtitle: 'text-slate-400',
                  socialButtonsBlockButton: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
                  formFieldLabel: 'text-slate-300',
                  formFieldInput: 'bg-white/5 border border-white/10 text-white placeholder-slate-500',
                  formFieldInputShowPasswordButton: 'text-slate-200 hover:text-white',
                  formFieldInputShowPasswordIcon: 'text-slate-200',
                  formButtonPrimary: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700',
                  footerActionLink: 'text-cyan-400 hover:text-cyan-300',
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClerkSignUp() {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && user) {
      navigate('/dashboard');
    }
  }, [isSignedIn, user, navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-12">
        {/* Left side - Branding */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent mb-6">
            Join DevPrep
          </h1>
          <p className="text-lg lg:text-xl text-slate-300 mb-8">
            Start your journey to interview success
          </p>
          <div className="flex flex-col gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Mock interviews with real-time AI feedback</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Technical assessments & coding challenges</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Resume analysis & optimization tips</span>
            </div>
          </div>
        </div>

        {/* Right side - Clerk Sign Up */}
        <div className="w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Create your account</h2>
              <p className="text-slate-400 mt-2">Get started in minutes</p>
            </div>

            <SignUp
              path="/sign-up"
              routing="path"
              signInUrl="/sign-in"
              redirectUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent border-0 shadow-none',
                  headerTitle: 'text-white text-xl font-semibold',
                  headerSubtitle: 'text-slate-400',
                  socialButtonsBlockButton: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
                  formFieldInputShowPasswordButton: 'text-slate-200 hover:text-white',
                  formFieldInputShowPasswordIcon: 'text-slate-200',
                  formFieldLabel: 'text-slate-300',
                  formFieldInput: 'bg-white/5 border border-white/10 text-white placeholder-slate-500',
                  formButtonPrimary: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700',
                  footerActionLink: 'text-cyan-400 hover:text-cyan-300',
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

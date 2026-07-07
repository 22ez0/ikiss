import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth";
import { useEffect } from "react";
import { SiteBackground } from "@/components/SiteBackground";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import EditProfile from "@/pages/dashboard/edit";
import Comunidade from "@/pages/dashboard/comunidade";
import Discover from "@/pages/discover";
import ProfilePage from "@/pages/profile";
import DevKeefnow from "@/pages/devkeefnow";
import Support from "@/pages/support";
import EmailsNoah from "@/pages/emailsnoah";
import VerifyEmail from "@/pages/verify-email";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Handles SPA reload on GitHub Pages / static hosts.
 * 404.html saves the original path in sessionStorage ("ikiss:redirect")
 * and redirects to "/". This component reads it back and navigates
 * to the correct route immediately on mount — before the user sees anything.
 */
function SpaRedirectHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const stored = sessionStorage.getItem("ikiss:redirect");
    if (!stored || stored === "/") return;
    sessionStorage.removeItem("ikiss:redirect");
    // Replace current history entry so the back button doesn't loop
    setLocation(stored, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/suporte" component={Support} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/edit" component={EditProfile} />
      <Route path="/dashboard/comunidade" component={Comunidade} />
      <Route path="/discover" component={Discover} />
      <Route path="/devkeefnow" component={DevKeefnow} />
      <Route path="/keefaren" component={DevKeefnow} />
      <Route path="/emailsnoah" component={EmailsNoah} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/:username" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Keep Render warm — ping every 4 min when tab is visible
  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    if (!apiUrl) return;
    const ping = () => {
      try {
        fetch(`${apiUrl}/api/healthz`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(8000) }).catch(() => {});
      } catch {}
    };
    ping();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') ping();
    }, 4 * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SpaRedirectHandler />
          <AuthProvider>
            <SiteBackground />
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

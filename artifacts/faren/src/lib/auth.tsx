import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, User, setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";

function getCookieToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)ikiss_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieToken(token: string) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 90);
  document.cookie = `ikiss_token=${encodeURIComponent(token)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function clearCookieToken() {
  document.cookie = "ikiss_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function getStoredToken(): string | null {
  return localStorage.getItem("token") || getCookieToken();
}

setAuthTokenGetter(() => getStoredToken());

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [, setLocation] = useLocation();

  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      setCookieToken(token);
    } else {
      localStorage.removeItem("token");
      clearCookieToken();
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setCookieToken(newToken);
    setToken(newToken);
    setTimeout(() => refetch(), 0);
  };

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: token ? isLoading : false,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

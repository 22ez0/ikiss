import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const githubPagesRedirect = sessionStorage.getItem("ikiss:redirect");
if (githubPagesRedirect) {
  sessionStorage.removeItem("ikiss:redirect");
  window.history.replaceState(null, "", githubPagesRedirect);
}

setBaseUrl(import.meta.env.VITE_API_URL || null);

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);

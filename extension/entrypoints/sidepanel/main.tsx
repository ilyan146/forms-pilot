import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import "@/assets/styles.css";
import { configureApiClient } from "@/lib/api";

import { App } from "./App";

configureApiClient();

const queryClient = new QueryClient({
  // A failed scan means "not the form page"; retrying only delays saying so.
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

ReactDOM.createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

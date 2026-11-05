import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import "@/assets/styles.css";

import { App } from "./App";

ReactDOM.createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

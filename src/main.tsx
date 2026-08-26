import { createRoot } from "react-dom/client";

import "./styles.css";
import { App } from "./client/App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Dashboard root element not found");
}

createRoot(root).render(<App />);

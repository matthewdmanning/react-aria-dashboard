import { createRoot } from "react-dom/client";

import "./styles.css";

import {
  messageComponentDefinition,
  renderComponent,
} from "./dashboard/index";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Dashboard root element not found");
}

createRoot(root).render(
  renderComponent(messageComponentDefinition, {
    message: "Dashboard component contract is ready.",
  }),
);

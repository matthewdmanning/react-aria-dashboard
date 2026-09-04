import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DashboardCardsPrototype } from "./dashboard-cards.prototype";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardCardsPrototype />
  </StrictMode>,
);

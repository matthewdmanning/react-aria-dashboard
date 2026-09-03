import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EisenhowerMatrix } from "./EisenhowerMatrix.prototype";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EisenhowerMatrix />
  </StrictMode>,
);

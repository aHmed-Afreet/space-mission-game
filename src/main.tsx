import React from "react";
import { createRoot } from "react-dom/client";
import ModeSelect from "./ModeSelect";
import "./commander/commander.css";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ModeSelect />
  </React.StrictMode>,
);

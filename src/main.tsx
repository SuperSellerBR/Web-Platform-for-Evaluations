import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./utils/theme";
import "./styles/globals.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
  

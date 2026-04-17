import { useEffect } from "react";

import { AppRouter } from "./routes/AppRouter";
import { useAuthBootstrap } from "./hooks/useAuthBootstrap";
import logo from "./public/Logo.png";

export default function App() {
  const bootstrap = useAuthBootstrap();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    document.title = "Fintrix";

    let favicon = document.querySelector("link[rel='icon']");

    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      document.head.appendChild(favicon);
    }

    favicon.setAttribute("type", "image/png");
    favicon.setAttribute("href", logo);
  }, []);

  return <AppRouter />;
}

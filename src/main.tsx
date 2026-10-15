import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { CloudApp } from "./app/CloudApp";
import "./index.css";
const root = createRoot(document.getElementById("root")!);
fetch("/api/config", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw Error();
    return r.json();
  })
  .then((config) => {
    root.render(
      config.cloudMode ? <CloudApp config={config.firebase} /> : <App />,
    );
  })
  .catch(() =>
    root.render(
      <p style={{ padding: 24 }}>
        The server is unavailable. Reconnect and reload to continue.
      </p>,
    ),
  );

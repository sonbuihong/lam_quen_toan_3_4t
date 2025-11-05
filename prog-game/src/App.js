import { useEffect, useRef } from "react";
import "./App.css";
import GameCanvas from "./components/GameCanvas";
import RotateNotice from "./components/RotateNotice";

export default function App() {
  const irukaHost = useRef(null);
  useEffect(() => {
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "INIT") {
        console.log("[Math Blitz] Received INIT:", e.data.payload);

        // Create host bridge
        irukaHost.current = {
          ready: () => {
            window.parent.postMessage(
              {
                sdkVersion: "1.0.0",
                source: "game",
                type: "READY",
              },
              ""
            );
          },
          reportScore: (newScore, delta) => {
            window.parent.postMessage(
              {
                sdkVersion: "1.0.0",
                source: "game",
                type: "SCORE_UPDATE",
                payload: { score: newScore, delta },
              },
              ""
            );
          },
          complete: (data) => {
            window.parent.postMessage(
              {
                sdkVersion: "1.0.0",
                source: "game",
                type: "COMPLETE",
                payload: data,
              },
              "*"
            );
          },
        };

        // Send READY
        irukaHost.current.ready();
      } else if (e.data && e.data.type === "START") {
      }
    });
  });
  return (
    <div className="flex items-center justify-center h-screen bg-blue-200">
      <GameCanvas />
      <RotateNotice />
    </div>
  );
}

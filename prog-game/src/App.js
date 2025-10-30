import "./App.css";
import GameCanvas from "./components/GameCanvas";
import RotateNotice from "./components/RotateNotice";

export default function App() {
  return (
    <div className="flex items-center justify-center h-screen bg-blue-200">
      <GameCanvas />
      <RotateNotice />
    </div>
  );
}

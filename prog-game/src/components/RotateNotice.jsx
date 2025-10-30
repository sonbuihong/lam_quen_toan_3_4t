import { useEffect, useState } from "react";

export default function RotateNotice() {
  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-center z-50">
      <h2 className="text-3xl font-semibold mb-[20px]">Thông báo</h2>
      <p className="text-xl font-semibold">
        Vui lòng xoay ngang màn hình để chơi game 🎮
      </p>
    </div>
  );
}

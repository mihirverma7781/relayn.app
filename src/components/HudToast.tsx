import {useEffect, useState} from 'react';

interface HudToastProps {
  message: string | null;
  onClear: () => void;
}

export default function HudToast({message, onClear}: HudToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClear, 250);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [message, onClear]);

  if (!message && !visible) return null;

  return (
    <div className={`hud-toast-container ${visible ? 'is-visible' : 'is-fading'}`}>
      <div className="hud-toast-pill">
        <span>{message}</span>
      </div>
    </div>
  );
}

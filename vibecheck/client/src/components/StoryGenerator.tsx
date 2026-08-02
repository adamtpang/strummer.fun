import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface StoryGeneratorProps {
  user: { display_name: string; id: string };
  topTracks?: Array<{
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
  }>;
  vibeLabel: string;
  gradient?: string;
  onClose: () => void;
}

export default function StoryGenerator({ user, topTracks = [], vibeLabel, onClose }: StoryGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateStory = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#0a0a0a');
    bg.addColorStop(0.5, '#1a1a2e');
    bg.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grain
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }
    ctx.globalAlpha = 1;

    // "vibecheck.style" at top
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '300 36px -apple-system, sans-serif';
    ctx.fillText('vibecheck.style', canvas.width / 2, 120);

    // User name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px -apple-system, sans-serif';
    ctx.fillText(user.display_name, canvas.width / 2, 400);

    // Vibe label — the hero
    ctx.font = 'bold 84px -apple-system, sans-serif';
    const labelGradient = ctx.createLinearGradient(100, 500, 980, 600);
    labelGradient.addColorStop(0, '#1DB954');
    labelGradient.addColorStop(1, '#1ed760');
    ctx.fillStyle = labelGradient;

    // Word wrap the vibe label
    const words = vibeLabel.split(' ');
    let line = '';
    let y = 560;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > 900 && line) {
        ctx.fillText(line.trim(), canvas.width / 2, y);
        line = word + ' ';
        y += 100;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), canvas.width / 2, y);

    // Divider
    y += 80;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, y);
    ctx.lineTo(880, y);
    ctx.stroke();
    y += 60;

    // Top tracks
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '300 32px -apple-system, sans-serif';
    ctx.fillText('TOP TRACKS', 120, y);
    y += 50;

    const tracksToShow = topTracks.slice(0, 4);
    for (let i = 0; i < tracksToShow.length; i++) {
      const track = tracksToShow[i];
      y += 70;

      // Number
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 36px -apple-system, sans-serif';
      ctx.fillText(`${i + 1}`, 120, y);

      // Track name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px -apple-system, sans-serif';
      const trackName = track.name.length > 28 ? track.name.substring(0, 28) + '...' : track.name;
      ctx.fillText(trackName, 190, y - 8);

      // Artist
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '300 32px -apple-system, sans-serif';
      const artist = track.artists[0]?.name || '';
      ctx.fillText(artist.length > 35 ? artist.substring(0, 35) + '...' : artist, 190, y + 30);
    }

    // Bottom CTA
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '300 36px -apple-system, sans-serif';
    ctx.fillText('what\'s your vibe?', canvas.width / 2, 1720);

    ctx.fillStyle = '#1DB954';
    ctx.font = 'bold 40px -apple-system, sans-serif';
    ctx.fillText('vibecheck.style', canvas.width / 2, 1780);

    setGeneratedImage(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    generateStory();
  }, []);

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `${user.display_name}_vibecheck.png`;
    link.href = generatedImage;
    link.click();
  };

  const shareImage = async () => {
    if (!generatedImage) return;
    try {
      const res = await fetch(generatedImage);
      const blob = await res.blob();
      const file = new File([blob], `${user.display_name}_vibecheck.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${user.display_name}'s Vibecheck`,
          text: `Check out ${user.display_name}'s music vibe!`,
          files: [file],
        });
      } else {
        downloadImage();
      }
    } catch {
      downloadImage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Share Story</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {generatedImage ? (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden aspect-[9/16]">
              <img src={generatedImage} alt="Story" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={shareImage}
                className="flex-1 bg-[#1DB954] text-black py-3 rounded-full font-semibold hover:bg-[#1ed760] transition-colors"
              >
                Share
              </button>
              <button
                onClick={downloadImage}
                className="flex-1 bg-white/10 text-white py-3 rounded-full font-semibold hover:bg-white/20 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

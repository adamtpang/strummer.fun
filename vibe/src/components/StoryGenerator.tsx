import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Instagram, Link2, Loader2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

export interface StoryTrack {
  name: string;
  artist: string;
  albumArt?: string | null;
  url?: string;
}

interface StoryGeneratorProps {
  user: { display_name: string; id: string };
  topTracks?: StoryTrack[];
  vibeLabel: string;
  gradient?: string;
  profileUrl: string;
  isPublic: boolean;
  onPublish?: () => Promise<void>;
  onClose: () => void;
}

type StoryTheme = 'vibe' | 'paper' | 'night' | 'signal';
type StoryLayout = 'spotlight' | 'ranked';

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_THEME_KEY = 'strummer-vibe-story-theme';
const STORY_LAYOUT_KEY = 'strummer-vibe-story-layout';

const THEMES: Array<{
  id: StoryTheme;
  label: string;
  swatch: string;
  background: string;
  foreground: string;
  muted: string;
  accent: string;
}> = [
  {
    id: 'vibe',
    label: 'Your vibe',
    swatch: 'linear-gradient(135deg, #672f88, #176b68)',
    background: '#17111b',
    foreground: '#f7f4ef',
    muted: 'rgba(247,244,239,0.64)',
    accent: '#f7f4ef',
  },
  {
    id: 'paper',
    label: 'Paper',
    swatch: 'linear-gradient(135deg, #f3f0e8 50%, #dc2626 50%)',
    background: '#f3f0e8',
    foreground: '#161412',
    muted: 'rgba(22,20,18,0.62)',
    accent: '#dc2626',
  },
  {
    id: 'night',
    label: 'Night',
    swatch: 'linear-gradient(135deg, #0a0908 50%, #f5f5f4 50%)',
    background: '#0a0908',
    foreground: '#f5f5f4',
    muted: 'rgba(245,245,244,0.58)',
    accent: '#dc2626',
  },
  {
    id: 'signal',
    label: 'Signal',
    swatch: 'linear-gradient(135deg, #dc2626 50%, #f5f5f4 50%)',
    background: '#c92222',
    foreground: '#fffaf4',
    muted: 'rgba(255,250,244,0.68)',
    accent: '#0a0908',
  },
];

export default function StoryGenerator({
  user,
  topTracks = [],
  vibeLabel,
  gradient,
  profileUrl,
  isPublic,
  onPublish,
  onClose,
}: StoryGeneratorProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [themeId, setThemeId] = useState<StoryTheme>(() =>
    readPreference(STORY_THEME_KEY, ['vibe', 'paper', 'night', 'signal'], 'vibe')
  );
  const [layout, setLayout] = useState<StoryLayout>(() =>
    readPreference(STORY_LAYOUT_KEY, ['spotlight', 'ranked'], 'spotlight')
  );
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedHere, setPublishedHere] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTheme = THEMES.find(theme => theme.id === themeId) || THEMES[0];
  const featuredTrack = topTracks[featuredIndex] || topTracks[0];
  const canShareProfile = isPublic || publishedHere;

  const imageName = useMemo(
    () => `${safeFileName(user.display_name || 'my')}-strummer-vibe-story.png`,
    [user.display_name]
  );

  useEffect(() => {
    localStorage.setItem(STORY_THEME_KEY, themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem(STORY_LAYOUT_KEY, layout);
  }, [layout]);

  useEffect(() => {
    if (!canvas) return;
    let cancelled = false;
    const render = async () => {
      setRendering(true);
      setNotice(null);
      try {
        const image = await drawStory({
          canvas,
          userName: user.display_name,
          vibeLabel,
          topTracks,
          featuredTrack,
          profileUrl,
          theme: selectedTheme,
          layout,
          vibeGradient: gradient,
        });
        if (!cancelled) setGeneratedImage(image);
      } catch (error) {
        console.error('Story render failed:', error);
        if (!cancelled) setNotice('The preview could not render. Choose another look and try again.');
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [canvas, featuredTrack, gradient, layout, profileUrl, renderAttempt, selectedTheme, topTracks, user.display_name, vibeLabel]);

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = imageName;
    link.href = generatedImage;
    link.click();
    setNotice('Story saved. Add it to Instagram when you are ready.');
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setNotice('Profile link copied for your Story link sticker.');
    } catch {
      setNotice(profileUrl);
    }
  };

  const publishProfile = async () => {
    if (!onPublish || publishing) return;
    setPublishing(true);
    setNotice(null);
    try {
      await onPublish();
      setPublishedHere(true);
      setNotice('Your vibe page is public. You can share it now.');
    } catch {
      setNotice('Publishing failed. Your vibe is still private. Try again.');
    } finally {
      setPublishing(false);
    }
  };

  const shareImage = async () => {
    if (!generatedImage || sharing) return;
    if (!canShareProfile) {
      setNotice('Publish your vibe page first so friends can open the link.');
      return;
    }

    setSharing(true);
    setNotice(null);
    try {
      const blob = await (await fetch(generatedImage)).blob();
      const file = new File([blob], imageName, { type: 'image/png' });
      await navigator.clipboard?.writeText(profileUrl).catch(() => undefined);

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${user.display_name}'s vibe`,
          text: `get to know me through my music: ${profileUrl}`,
          files: [file],
        });
        setNotice('Profile link copied too, ready for an Instagram link sticker.');
      } else {
        downloadImage();
        setNotice('Your browser saved the image. Share it from Instagram and paste the copied profile link.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      downloadImage();
      setNotice('The share sheet was unavailable, so the story was downloaded instead.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[96vh] w-[calc(100%_-_1rem)] max-w-5xl overflow-y-auto border-border bg-background p-0 text-foreground sm:rounded-lg">
        <div className="grid min-h-0 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <div className="flex min-h-[440px] items-center justify-center border-b border-border bg-black p-5 sm:min-h-[520px] sm:p-7 lg:border-b-0 lg:border-r">
            <canvas ref={setCanvas} className="hidden" aria-hidden="true" />
            <div className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-md border border-white/10 bg-white/5 shadow-2xl sm:max-w-[320px]">
              {generatedImage && (
                <img
                  src={generatedImage}
                  alt={`Instagram Story preview for ${user.display_name}`}
                  width={1080}
                  height={1920}
                  className="h-full w-full object-cover"
                />
              )}
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60" role="status">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Rendering story preview</span>
                </div>
              )}
              {!rendering && !generatedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm text-white/60">Preview unavailable</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRenderAttempt(attempt => attempt + 1)}
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col p-5 sm:p-8">
            <DialogHeader className="pr-8 text-left">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  1080 × 1920 PNG
                </Badge>
                <Badge className="border-transparent bg-primary/15 text-primary shadow-none hover:bg-primary/15">
                  Instagram ready
                </Badge>
              </div>
              <DialogTitle className="text-2xl">Make your Story</DialogTitle>
              <DialogDescription className="mt-2 text-muted-foreground">
                A portrait of your taste, ready to share.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7 space-y-6">
              <fieldset>
                <legend className="eyebrow mb-3">Look</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Story look">
                  {THEMES.map(theme => {
                    const selected = theme.id === themeId;
                    return (
                      <Button
                        key={theme.id}
                        type="button"
                        variant="outline"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setThemeId(theme.id)}
                        className={`h-auto min-h-16 flex-col gap-2 px-2 py-2 text-xs shadow-none ${
                          selected
                            ? 'border-foreground bg-accent text-accent-foreground'
                            : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <span
                          className="block h-5 w-5 rounded-full border border-white/20"
                          style={{ background: theme.swatch }}
                          aria-hidden="true"
                        />
                        {theme.label}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="eyebrow mb-3">Layout</legend>
                <Tabs value={layout} onValueChange={value => setLayout(value as StoryLayout)}>
                  <TabsList className="grid h-11 w-full grid-cols-2 bg-muted">
                    <TabsTrigger value="spotlight" className="h-9">Song spotlight</TabsTrigger>
                    <TabsTrigger value="ranked" className="h-9">Top five</TabsTrigger>
                  </TabsList>
                </Tabs>
              </fieldset>

              {layout === 'spotlight' && topTracks.length > 1 && (
                <fieldset>
                  <legend className="eyebrow mb-3">Featured song</legend>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {topTracks.slice(0, 5).map((track, index) => (
                      <Button
                        key={`${track.name}-${index}`}
                        type="button"
                        variant="ghost"
                        onClick={() => setFeaturedIndex(index)}
                        className={`h-auto min-h-12 w-full justify-start gap-3 whitespace-normal px-3 py-2 text-left ${
                          featuredIndex === index ? 'bg-accent text-foreground' : 'text-foreground'
                        }`}
                      >
                        <span className="w-5 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{track.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
                        </span>
                        {featuredIndex === index && <Check className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            <div className="mt-auto pt-8">
              {!canShareProfile && (
                <div className="mb-4 rounded-md border border-border bg-card p-4 text-card-foreground">
                  <p className="text-sm font-medium">Your vibe page is private</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    The image is always yours. Publish the page only when you want friends to open its link.
                  </p>
                  <Button
                    type="button"
                    onClick={publishProfile}
                    disabled={publishing}
                    className="mt-3 gap-2"
                  >
                    {publishing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Publish vibe page
                  </Button>
                </div>
              )}

              {notice && <p className="mb-3 text-sm text-muted-foreground" role="status">{notice}</p>}

              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                <Button
                  type="button"
                  onClick={shareImage}
                  disabled={!generatedImage || rendering || sharing}
                  size="lg"
                  className="h-12 min-w-0 gap-2"
                >
                  {sharing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Instagram className="h-4 w-4" aria-hidden="true" />}
                  <span className="truncate">Share Story</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyProfileLink}
                  className="h-12 w-12"
                  aria-label="Copy profile link"
                  title="Copy profile link"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={downloadImage}
                  disabled={!generatedImage || rendering}
                  className="h-12 w-12"
                  aria-label="Download story image"
                  title="Download story image"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DrawStoryInput {
  canvas: HTMLCanvasElement | null;
  userName: string;
  vibeLabel: string;
  topTracks: StoryTrack[];
  featuredTrack?: StoryTrack;
  profileUrl: string;
  theme: (typeof THEMES)[number];
  layout: StoryLayout;
  vibeGradient?: string;
}

async function drawStory(input: DrawStoryInput): Promise<string> {
  const { canvas } = input;
  if (!canvas) throw new Error('Canvas unavailable');
  await document.fonts?.ready;
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  paintBackground(ctx, input.theme, input.vibeGradient);
  paintTexture(ctx, input.theme.id);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = input.theme.foreground;
  ctx.textAlign = 'left';
  ctx.font = '600 34px Inter, Arial, sans-serif';
  ctx.fillText('strummer.fun/vibe', 84, 170);

  ctx.textAlign = 'right';
  ctx.fillStyle = input.theme.muted;
  ctx.font = '500 24px Inter, Arial, sans-serif';
  ctx.fillText(
    truncateText(ctx, input.userName.toUpperCase(), 520),
    STORY_WIDTH - 84,
    168
  );

  ctx.fillStyle = input.theme.accent;
  ctx.fillRect(84, 210, 64, 6);

  ctx.textAlign = 'left';
  ctx.fillStyle = input.theme.muted;
  ctx.font = '500 28px Inter, Arial, sans-serif';
  ctx.fillText('MY MUSIC SAYS I AM', 84, 282);
  drawWrappedText(ctx, input.vibeLabel || 'hard to put in a box', 84, 360, 912, 88, {
    font: '700 82px Inter, Arial, sans-serif',
    color: input.theme.foreground,
    maxLines: 3,
  });
  ctx.fillStyle = input.theme.muted;
  ctx.font = '500 25px Inter, Arial, sans-serif';
  ctx.fillText('GET TO KNOW ME THROUGH MY MUSIC TASTE', 84, 575);

  if (input.layout === 'spotlight') {
    await paintSpotlight(ctx, input);
  } else {
    paintRanked(ctx, input);
  }

  paintFooter(ctx, input);
  return canvas.toDataURL('image/png');
}

async function paintSpotlight(ctx: CanvasRenderingContext2D, input: DrawStoryInput) {
  const track = input.featuredTrack;
  const artX = 120;
  const artY = 620;
  const artSize = 840;
  const art = track?.albumArt ? await loadCanvasImage(track.albumArt) : null;

  if (art) {
    ctx.save();
    roundedRectPath(ctx, artX, artY, artSize, artSize, 8);
    ctx.clip();
    ctx.drawImage(art, artX, artY, artSize, artSize);
    ctx.restore();
  } else {
    ctx.fillStyle = input.theme.id === 'paper' ? 'rgba(22,20,18,0.08)' : 'rgba(255,255,255,0.09)';
    roundedRect(ctx, artX, artY, artSize, artSize, 8);
    ctx.fillStyle = input.theme.muted;
    ctx.font = '500 32px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOUR TOP SONG', STORY_WIDTH / 2, artY + artSize / 2);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = input.theme.accent;
  ctx.font = '700 26px Inter, Arial, sans-serif';
  ctx.fillText('01  TOP SONG', 120, 1535);
  drawWrappedText(ctx, track?.name || 'Your top song', 120, 1602, 840, 58, {
    font: '700 48px Inter, Arial, sans-serif',
    color: input.theme.foreground,
    maxLines: 2,
  });
  ctx.fillStyle = input.theme.muted;
  ctx.font = '500 30px Inter, Arial, sans-serif';
  ctx.fillText(truncateText(ctx, track?.artist || '', 840), 120, 1730);
}

function paintRanked(ctx: CanvasRenderingContext2D, input: DrawStoryInput) {
  const tracks = input.topTracks.slice(0, 5);
  const startY = 640;
  const rowHeight = 178;
  tracks.forEach((track, index) => {
    const y = startY + index * rowHeight;
    ctx.fillStyle = input.theme.id === 'paper' ? 'rgba(22,20,18,0.12)' : 'rgba(255,255,255,0.14)';
    ctx.fillRect(84, y + rowHeight - 24, 912, 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = input.theme.accent;
    ctx.font = '700 28px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.fillText(String(index + 1).padStart(2, '0'), 84, y + 60);

    ctx.fillStyle = input.theme.foreground;
    ctx.font = '700 42px Inter, Arial, sans-serif';
    ctx.fillText(truncateText(ctx, track.name, 760), 190, y + 52);
    ctx.fillStyle = input.theme.muted;
    ctx.font = '500 29px Inter, Arial, sans-serif';
    ctx.fillText(truncateText(ctx, track.artist, 760), 190, y + 98);
  });
}

function paintFooter(ctx: CanvasRenderingContext2D, input: DrawStoryInput) {
  const cleanUrl = input.profileUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.textAlign = 'left';
  ctx.fillStyle = input.theme.muted;
  ctx.font = '500 22px Inter, Arial, sans-serif';
  ctx.fillText('MUSIC DATA FROM SPOTIFY', 84, 1830);
  ctx.textAlign = 'right';
  ctx.fillStyle = input.theme.foreground;
  ctx.font = '600 25px Inter, Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanUrl, 560), STORY_WIDTH - 84, 1830);
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  theme: (typeof THEMES)[number],
  vibeGradient?: string
) {
  if (theme.id === 'vibe') {
    const colors = extractGradientColors(vibeGradient || '').filter(color => isCanvasColor(ctx, color));
    const gradient = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
    (colors.length ? colors : ['#5f2d73', '#176b68', '#17111b']).forEach((color, index, all) => {
      gradient.addColorStop(index / Math.max(all.length - 1, 1), color);
    });
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = theme.background;
  }
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
}

function paintTexture(ctx: CanvasRenderingContext2D, theme: StoryTheme) {
  ctx.save();
  ctx.globalAlpha = theme === 'paper' ? 0.045 : 0.035;
  ctx.fillStyle = theme === 'paper' ? '#0a0908' : '#ffffff';
  for (let y = 0; y < STORY_HEIGHT; y += 28) {
    for (let x = (y / 28) % 2 === 0 ? 0 : 14; x < STORY_WIDTH; x += 28) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}

async function loadCanvasImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch {
    return null;
  }
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  options: { font: string; color: string; maxLines: number }
) {
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textAlign = 'left';
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, options.maxLines);
  if (lines.length > options.maxLines) {
    visible[visible.length - 1] = truncateText(ctx, `${visible[visible.length - 1]}...`, maxWidth);
  }
  visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

function isCanvasColor(ctx: CanvasRenderingContext2D, color: string) {
  const previous = ctx.fillStyle;
  ctx.fillStyle = '#010203';
  ctx.fillStyle = color;
  const parsed = ctx.fillStyle;
  ctx.fillStyle = previous;
  return parsed !== '#010203' || /#010203|rgb\(1,\s*2,\s*3\)/i.test(color);
}

function extractGradientColors(value: string): string[] {
  return value.match(/(?:#[0-9a-f]{3,8}|hsla?\([^)]*\)|rgba?\([^)]*\))/gi) || [];
}

function readPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  try {
    const stored = localStorage.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'my';
}

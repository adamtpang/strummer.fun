import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import StoryGenerator from '../src/components/StoryGenerator';
import '../src/index.css';

const test = { publications: 0, shares: [] as ShareData[], closed: false, activation: false };
Object.assign(window, { vibeTest: test });
Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
Object.defineProperty(navigator, 'share', { configurable: true, value: (data: ShareData) => {
  test.activation = navigator.userActivation.isActive;
  test.shares.push(data);
  return Promise.resolve();
} });
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 100;
const context = canvas.getContext('2d')!;
context.fillStyle = '#ee1133'; context.fillRect(0, 0, 100, 100);
const red = canvas.toDataURL();
context.fillStyle = '#1166ee'; context.fillRect(0, 0, 100, 100);
const blue = canvas.toDataURL();

function Harness() {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Open test story</button>
    {open && <StoryGenerator
      user={{ id: 'test-listener', display_name: 'Test listener' }}
      topTracks={[
        { name: 'First test song', artist: 'Test artist', albumArt: red },
        { name: 'Second test song', artist: 'Another test artist', albumArt: blue },
        { name: 'A very long title that should always stay inside the story artwork', artist: 'Test artist' },
        { name: 'Supercalifragilisticexpialidocious'.repeat(3), artist: 'Test artist' },
        { name: 'Final test song', artist: 'Test artist' },
      ]}
      vibeLabel={'Supercalifragilisticexpialidocious'.repeat(4)}
      gradient="linear-gradient(135deg, #234e42, #702a30)"
      profileUrl="https://strummer.fun/vibe/test-listener"
      isPublic={false}
      onPublish={async () => { test.publications += 1; }}
      onClose={() => { test.closed = true; setOpen(false); }}
    />}
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness /></React.StrictMode>);

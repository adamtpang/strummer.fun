# Vibecheck Design System

A comprehensive design system built with **shadcn/ui**, **Framer Motion**, and a custom **Coolors** palette.

## 🎨 Color Palette

Based on the Burgundy & Navy theme from [Coolors](https://coolors.co/780000-c1121f-fdf0d5-003049-669bbc):

| Color          | Hex       | Usage                                          |
| -------------- | --------- | ---------------------------------------------- |
| Dark Burgundy  | `#780000` | Primary actions, focus states, important CTAs  |
| Red            | `#C1121F` | Accents, hover states, destructive actions     |
| Cream          | `#FDF0D5` | Background, card backgrounds                   |
| Navy           | `#003049` | Primary text, headers                          |
| Light Blue     | `#669BBC` | Secondary elements, borders, subtle accents    |

### Using Colors

```tsx
import { colors, colorUtils } from "@/lib/colors";

// Direct usage
<div style={{ backgroundColor: colors.primary }}>...</div>

// With opacity
<div style={{ backgroundColor: colorUtils.primary.withOpacity(0.8) }}>...</div>

// Semantic colors
<Button style={{ backgroundColor: colors.primary, color: colors.cream }}>
  Primary Action
</Button>
```

## 🎭 Motion Components

All motion components use Framer Motion under the hood with predefined animation variants.

### MotionWrapper

A versatile wrapper component with built-in animation presets:

```tsx
import { MotionWrapper } from "@/components/motion";

// Fade in with slide up
<MotionWrapper variant="fadeIn">
  <YourComponent />
</MotionWrapper>

// Scale in with spring animation
<MotionWrapper variant="scaleIn" delay={0.2}>
  <YourComponent />
</MotionWrapper>

// Slide from sides
<MotionWrapper variant="slideInFromLeft">
  <YourComponent />
</MotionWrapper>
```

### Available Variants

- **fadeIn**: Fades in with slide up (opacity 0→1, y: 20→0)
- **scaleIn**: Scales from 0.9 to 1 with spring physics
- **slideInFromLeft**: Slides in from left (-50px)
- **slideInFromRight**: Slides in from right (+50px)
- **stagger**: Container for staggered children animations

### Interactive Components

```tsx
import { MotionButton } from "@/components/motion";

<MotionButton onClick={handleClick}>
  I have hover and tap animations!
</MotionButton>
```

### Staggered Lists

Perfect for animating lists of items with a cascading effect:

```tsx
import { StaggerList, StaggerItem } from "@/components/motion";

<StaggerList>
  {items.map((item) => (
    <StaggerItem key={item.id}>
      <Card>{item.content}</Card>
    </StaggerItem>
  ))}
</StaggerList>
```

## 📦 shadcn/ui Components

All core shadcn/ui components are installed and ready to use:

- ✅ Button
- ✅ Card
- ✅ Input
- ✅ Select
- ✅ Dialog
- ✅ Badge
- ✅ Avatar
- ✅ Label
- ✅ Dropdown Menu
- ✅ Tabs

### Basic Usage

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>My Card</CardTitle>
  </CardHeader>
  <CardContent>
    <Button>Click Me</Button>
  </CardContent>
</Card>
```

### Styled with Custom Colors

```tsx
import { Button } from "@/components/ui/button";
import { colors } from "@/lib/colors";

<Button style={{ backgroundColor: colors.primary, color: colors.cream }}>
  Custom Styled Button
</Button>
```

## 🚀 Getting Started

### 1. View the Showcase

```tsx
import { DesignSystemShowcase } from "@/components/DesignSystemShowcase";

function App() {
  return <DesignSystemShowcase />;
}
```

### 2. Create Your Own Components

Combine all three systems:

```tsx
import { MotionWrapper } from "@/components/motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { colors } from "@/lib/colors";

export function MyComponent() {
  return (
    <MotionWrapper variant="fadeIn" delay={0.2}>
      <Card>
        <CardHeader>
          <CardTitle style={{ color: colors.navy }}>
            Animated Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button style={{ backgroundColor: colors.primary, color: colors.cream }}>
            Action
          </Button>
        </CardContent>
      </Card>
    </MotionWrapper>
  );
}
```

## 🎯 Best Practices

### 1. Use Semantic Color Names

```tsx
// Good ✅
<Button style={{ backgroundColor: colors.primary }}>Submit</Button>

// Avoid ❌
<Button style={{ backgroundColor: "#780000" }}>Submit</Button>
```

### 2. Leverage Motion Presets

```tsx
// Good ✅
<MotionWrapper variant="fadeIn">

// Avoid ❌
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
```

### 3. Consistent Animations

- Use `fadeIn` for general content
- Use `scaleIn` for modals/popups
- Use `slideInFromLeft/Right` for sidebars
- Use `stagger` for lists

### 4. Performance

- Keep animations under 500ms for better UX
- Use spring animations sparingly (they're more expensive)
- Prefer `MotionWrapper` over custom motion.div for consistency

## 📁 Project Structure

```
client/src/
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── motion/                  # Motion components
│   │   ├── motion-wrapper.tsx   # Main motion components
│   │   └── index.ts             # Easy exports
│   └── DesignSystemShowcase.tsx # Demo component
├── lib/
│   ├── colors.ts                # Color palette & utilities
│   └── utils.ts                 # cn() utility
└── index.css                    # Global styles & CSS variables
```

## 🔧 Customization

### Change Color Palette

Edit `client/src/lib/colors.ts`:

```ts
export const colors = {
  primary: "#YOUR_COLOR",
  // ... rest of colors
};
```

### Add New Animation Variant

Edit `client/src/components/motion/motion-wrapper.tsx`:

```ts
export const myCustomVariant: Variants = {
  hidden: { opacity: 0, rotate: -180 },
  visible: {
    opacity: 1,
    rotate: 0,
    transition: { duration: 0.8 },
  },
};
```

### Add More shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

## 📖 Documentation Links

- [shadcn/ui](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Coolors](https://coolors.co/)
- [Tailwind CSS](https://tailwindcss.com/)

## ✨ Tips

1. **Combine animations with color changes** for richer interactions
2. **Use stagger animations** for lists to create visual hierarchy
3. **Keep color usage consistent** across similar UI elements
4. **Test animations on lower-end devices** for performance
5. **Use CSS variables** from index.css for theme-aware components

---

Built with ❤️ for Vibecheck.style

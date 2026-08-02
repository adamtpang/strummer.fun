# Quick Start Guide

Get up and running with the Vibecheck design system in minutes!

## 🎯 View the Showcase

To see all features in action, add the showcase component to your app:

```tsx
// In your App.tsx or any route
import { DesignSystemShowcase } from "@/components/DesignSystemShowcase";

function App() {
  return (
    <div>
      {/* Your existing routes */}
      <DesignSystemShowcase />
    </div>
  );
}
```

Then run:
```bash
npm run dev
```

Visit `http://localhost:5173` to see the complete design system showcase!

## 🚀 Quick Examples

### Example 1: Animated Card

```tsx
import { MotionWrapper } from "@/components/motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { colors } from "@/lib/colors";

export function MyCard() {
  return (
    <MotionWrapper variant="fadeIn">
      <Card>
        <CardHeader>
          <CardTitle style={{ color: colors.navy }}>
            Hello World
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ color: colors.textLight }}>
            This card fades in smoothly!
          </p>
          <Button
            style={{
              backgroundColor: colors.primary,
              color: colors.cream
            }}
          >
            Click Me
          </Button>
        </CardContent>
      </Card>
    </MotionWrapper>
  );
}
```

### Example 2: Animated List

```tsx
import { StaggerList, StaggerItem } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import { colors } from "@/lib/colors";

export function MyList() {
  const items = ["Item 1", "Item 2", "Item 3"];

  return (
    <StaggerList>
      {items.map((item, i) => (
        <StaggerItem key={i}>
          <Card>
            <CardContent>
              <p style={{ color: colors.navy }}>{item}</p>
            </CardContent>
          </Card>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
```

### Example 3: Interactive Button

```tsx
import { MotionButton } from "@/components/motion";
import { colors } from "@/lib/colors";

export function MyButton() {
  return (
    <MotionButton
      onClick={() => alert("Clicked!")}
      style={{
        backgroundColor: colors.accent,
        color: colors.cream,
        padding: "1rem 2rem",
        borderRadius: "0.5rem",
        border: "none",
        cursor: "pointer",
      }}
    >
      Hover & Click Me!
    </MotionButton>
  );
}
```

### Example 4: Form with Custom Colors

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { colors } from "@/lib/colors";

export function MyForm() {
  return (
    <form className="space-y-4" style={{ maxWidth: "400px" }}>
      <div>
        <Label htmlFor="name" style={{ color: colors.navy }}>
          Name
        </Label>
        <Input id="name" placeholder="Enter your name" />
      </div>

      <div>
        <Label htmlFor="theme" style={{ color: colors.navy }}>
          Theme
        </Label>
        <Select>
          <SelectTrigger id="theme">
            <SelectValue placeholder="Select a theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        style={{
          backgroundColor: colors.primary,
          color: colors.cream,
          width: "100%",
        }}
      >
        Submit
      </Button>
    </form>
  );
}
```

## 🎨 Using Colors

The color system is flexible and type-safe:

```tsx
import { colors, colorUtils } from "@/lib/colors";

// Direct colors
const myColor = colors.primary;        // #780000
const bgColor = colors.background;     // #FDF0D5

// With opacity
const semiTransparent = colorUtils.primary.withOpacity(0.5);

// All available colors
colors.darkBurgundy   // #780000
colors.red            // #C1121F
colors.cream          // #FDF0D5
colors.navy           // #003049
colors.lightBlue      // #669BBC
colors.primary        // #780000
colors.secondary      // #669BBC
colors.accent         // #C1121F
colors.background     // #FDF0D5
colors.text           // #003049
```

## 🎭 Animation Variants

Choose the right animation for your use case:

| Variant            | Best For                    | Effect                       |
| ------------------ | --------------------------- | ---------------------------- |
| `fadeIn`           | General content             | Fade + slide up              |
| `scaleIn`          | Modals, popups              | Scale with spring            |
| `slideInFromLeft`  | Sidebars, drawers           | Slide from left              |
| `slideInFromRight` | Notifications, side panels  | Slide from right             |
| `stagger`          | Lists, grids                | Cascade effect               |

## 📦 All Available Components

### shadcn/ui Components
- Button
- Card (with Header, Title, Description, Content, Footer)
- Input
- Label
- Select (with Trigger, Value, Content, Item)
- Dialog (with Trigger, Content, Header, Title, Description, Footer)
- Badge
- Avatar (with Image, Fallback)
- Dropdown Menu (with Trigger, Content, Item, Label, Separator)
- Tabs (with List, Trigger, Content)

### Motion Components
- MotionWrapper - Main wrapper with presets
- MotionDiv - Direct motion.div access
- MotionButton - Interactive button
- StaggerList - Container for staggered items
- StaggerItem - Individual staggered item

## 🔥 Pro Tips

1. **Combine motion + shadcn + colors** for best results
2. **Use StaggerList** for any repeating content
3. **Keep animations fast** (under 500ms)
4. **Use semantic color names** for maintainability
5. **Check DESIGN_SYSTEM.md** for detailed documentation

## 🐛 Troubleshooting

### Import errors?
Make sure your `tsconfig.json` has the path alias:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Colors not working?
Verify `client/src/lib/colors.ts` exists and is properly exported.

### Animations not smooth?
Check that `framer-motion` is installed:
```bash
npm list framer-motion
```

## 📚 Next Steps

1. Read the full [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
2. Explore the `DesignSystemShowcase` component
3. Check out [shadcn/ui docs](https://ui.shadcn.com/)
4. Review [Framer Motion docs](https://www.framer.com/motion/)

---

Happy coding! 🎉

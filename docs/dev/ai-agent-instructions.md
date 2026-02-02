# AI Agent Instructions for Levela Mobile App

## 🚨 **CRITICAL: Before Making Any Changes**

### **1. Always Check for Syntax Errors First**
- **Navigation Components**: The `AppNavigator.tsx` file is prone to syntax errors that cause blank white screens
- **Import Statements**: Verify all imports are correct, especially from `react-native-paper`
- **TypeScript Issues**: Fix any TypeScript errors before proceeding
- **Component Props**: Ensure all required props are provided (e.g., `onPress` for buttons)

### **2. Port Management & Application Instances**

#### **🚨 CRITICAL: Never Start Multiple Instances**
- **Check for existing processes** before running `npx expo start` or similar commands
- **Re-use existing ports** - do not start new instances on different ports
- **Look for running processes** in terminal history and environment details
- **If app is already running**, use the existing port instead of starting a new one

#### **How to Check for Running Instances:**
```bash
# Check if Expo is already running
ps aux | grep expo
# or
lsof -i :8081  # Check specific port
```

#### **Correct Behavior:**
```bash
# ❌ WRONG - Starting multiple instances
npx expo start  # Port 8081
npx expo start  # Port 8082 (AVOID THIS)

# ✅ CORRECT - Re-use existing instance
# If port 8081 is already running, don't start a new one
# Use the existing running instance
```

#### **Port Conflict Resolution:**
- If you see "Port 8081 is running this app in another window"
- **DO NOT** choose a different port
- **STOP** and check if the existing instance is working
- Only start a new instance if the existing one is confirmed broken

### **3. Test for Blank Screen Issues**
If the app shows a blank white page:
1. **Check AppNavigator.tsx** for syntax errors in Tab.Screen components
2. **Verify HomeScreen imports** - use `{ Chip, Card }` not `{ Chip, Card, CardContent }`
3. **Fix Button component logic** - ActivityIndicator size prop must be correct
4. **Ensure all required props** are provided to components

### **4. Development Workflow**

#### **Before Making Changes:**
- Read the current file content completely
- Understand the existing architecture
- Check for any existing TODO comments or known issues
- Verify the app is currently working (if possible)

#### **When Modifying Files:**
- Use the `replace_in_file` tool for targeted changes
- Always include the complete final content when using `write_to_file`
- Test changes incrementally - don't make too many changes at once
- Pay attention to auto-formatting that may change your code

#### **After Making Changes:**
- Check for TypeScript errors in the environment_details
- Verify the change was applied correctly
- Consider if the change might break other parts of the app
- **📸 Screenshots**: Save screenshots of UI changes to the `Screenshots/` folder (at project root) for documentation

### **5. Common Issues & Solutions**

#### **Blank White Screen:**
```typescript
// ❌ WRONG - Causes blank screen
import { Chip, Card, CardContent } from 'react-native-paper';

// ✅ CORRECT
import { Chip, Card } from 'react-native-paper';
// Then use: <Card><Card.Content>...</Card.Content></Card>
```

#### **Navigation Syntax Errors:**
```typescript
// ❌ WRONG - Causes syntax errors
<Tab.Screen
  name="Home"
  component={HomeScreen}
  options={{
    title: 'Feed',
    tabBarIcon: ({ color, size, focused }) => (
      <CustomTabBarIcon name="home" color={focused ? '#6366f1' : '#94a3b8'} size={24} focused={focused} />
    ),
  }}
/>

// ✅ CORRECT - Ensure proper syntax
<Tab.Screen
  name="Home"
  component={HomeScreen}
  options={{
    title: 'Feed',
    tabBarIcon: ({ color, size, focused }) => (
      <CustomTabBarIcon name="home" color={focused ? '#6366f1' : '#94a3b8'} size={24} focused={focused} />
    ),
  }}
/>
```

#### **Button Component Issues:**
```typescript
// ❌ WRONG - Always returns 'small'
<ActivityIndicator size={size === 'sm' ? 'small' : 'small'} color="#ffffff" />

// ✅ CORRECT
<ActivityIndicator size={size === 'sm' ? 'small' : 'large'} color="#ffffff" />
```

### **6. File Structure & Architecture**

#### **Key Files:**
- `mobile/App.tsx` - Main app component with theme and providers
- `mobile/src/navigation/AppNavigator.tsx` - Navigation setup (PRONE TO ERRORS)
- `mobile/src/contexts/AuthContext.tsx` - Authentication context
- `mobile/src/components/` - All custom components
- `mobile/src/screens/` - All screen components

#### **Component Hierarchy:**
```
App
├── QueryClientProvider
├── PaperProvider (with theme)
├── AuthProvider
└── AppNavigator
    ├── AuthStack (Login/Register) OR
    └── MainStack
        ├── MainTabs (Bottom navigation)
        ├── Modal screens (Endorse, AddEvidence, EditProfile)
```

### **7. Modern UI Components**

#### **Available Button Variants:**
- `primary` - Blue background, white text
- `secondary` - Gray background, white text  
- `outline` - Transparent background, blue border
- `ghost` - Transparent background, no border

#### **Available Button Sizes:**
- `sm` - Small buttons
- `md` - Medium buttons (default)
- `lg` - Large buttons

#### **Modern Components:**
- `Button` - Enhanced with animations and multiple variants
- `Input` - Modern input with focus states and icons
- `UserAvatar` - Enhanced with verification badges and animations
- `ScoreDisplay` - Modern score cards with animations
- `LoadingSpinner` - Smooth loading animations

### **8. Theme & Styling**

#### **Color Palette:**
- Primary: `#6366f1` (Modern indigo)
- Background: `#f8fafc` (Modern light gray)
- Text: `#0f172a` (Dark text)
- Secondary: `#94a3b8` (Gray text)

#### **Typography:**
- Font weights: 400, 500, 600, 700, 800
- Letter spacing: 0.2-0.5 for better readability
- Font sizes: Use consistent sizing scale

#### **Spacing:**
- Consistent padding and margins
- Rounded corners: 12px radius
- Shadow effects: Subtle shadows for depth

### **9. Testing & Validation**

#### **Before Submitting Changes:**
1. Verify no TypeScript errors in environment_details
2. Check that all required props are provided
3. Ensure imports are correct
4. Test that the app doesn't show blank screens

#### **Common Validation Checks:**
- All Button components have `onPress` prop
- All imports are from correct modules
- Navigation components have proper syntax
- No missing required props

### **10. Emergency Recovery**

If the app breaks completely:
1. **Check recent changes** in AppNavigator.tsx, HomeScreen.tsx, Button.tsx
2. **Look for syntax errors** - missing commas, brackets, etc.
3. **Verify imports** - especially react-native-paper imports
4. **Check required props** - ensure all mandatory props are provided
5. **Review TypeScript errors** in environment_details

### **11. Communication with Users**

When users report issues:
1. **Ask for specific error messages** or symptoms
2. **Check the environment_details** for TypeScript errors
3. **Verify the app structure** hasn't been corrupted
4. **Test incrementally** - make small changes and test
5. **Document solutions** in this file for future reference

---

**Last Updated:** January 31, 2026  
**Purpose:** Guide AI agents working on the Levela mobile app  
**Critical:** Always follow these instructions to avoid breaking the app
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * True only for the core React runtime packages. A loose `"/react/"` substring
 * incorrectly matches `@floating-ui/react`, `@tanstack/react-query`, etc.,
 * which then land in `react-vendor` and create a circular chunk graph with
 * `overlay-ui-vendor` (undefined `createContext` at load time).
 */
function isReactCoreVendorChunk(id: string): boolean {
  const n = id.replace(/\\/g, "/");
  return (
    /\/node_modules\/(react|react-dom|scheduler)\//.test(n)
    || /\/node_modules\/\.pnpm\/[^/]+\/node_modules\/(react|react-dom|scheduler)\//.test(
      n,
    )
  );
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Listen on all interfaces (IPv4 + IPv6). Using only "::" can break some
    // Windows↔WSL port-forwarding setups where the browser hits 127.0.0.1.
    host: true,
    port: 8080,
    // If 8080 is still held by a previous dev server, pick the next free port
    // instead of exiting — avoids "can't connect" after an unclean restart.
    strictPort: false,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: true,
    port: 8080,
    strictPort: false,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("src/components/layout/BuildOverlay")) {
            return "build-overlay";
          }

          if (
            id.includes("src/lib/i18n.runtime")
            || id.includes("src/contexts/LanguageContext")
          ) {
            return "i18n-runtime";
          }

          if (
            id.includes("src/lib/i18n.base")
            || id.includes("src/lib/i18n.languages")
            || id.includes("src/lib/i18n.ts")
          ) {
            return "i18n-data";
          }

          if (id.includes("src/lib/edit-profile-helpers")) {
            return "edit-profile-runtime";
          }

          if (id.includes("src/lib/world-citizen-id")) {
            return "identity-card-runtime";
          }

          if (id.includes("src/lib/taxonomy")) {
            return "profile-taxonomy";
          }

          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (isReactCoreVendorChunk(id)) {
            return "react-vendor";
          }

          if (id.includes("react-router-dom")) {
            return "router-vendor";
          }

          if (id.includes("@supabase/auth-js")) {
            return "supabase-auth";
          }

          if (id.includes("@supabase/realtime-js")) {
            return "supabase-realtime";
          }

          if (
            id.includes("@supabase/postgrest-js")
            || id.includes("@supabase/storage-js")
            || id.includes("@supabase/functions-js")
            || id.includes("@supabase/supabase-js")
          ) {
            return "supabase-core";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query-vendor";
          }

          if (id.includes("@tanstack/query-core")) {
            return "query-vendor";
          }

          if (
            id.includes("next-themes")
            || id.includes("/sonner/")
          ) {
            return "shell-vendor";
          }

          if (id.includes("/lucide-react/")) {
            return "icon-vendor";
          }

          if (
            id.includes("/react-hook-form/")
            || id.includes("@hookform/resolvers")
            || id.includes("/zod/")
            || id.includes("/input-otp/")
          ) {
            return "form-vendor";
          }

          if (id.includes("/libphonenumber-js/")) {
            return "phone-vendor";
          }

          if (
            id.includes("/qrcode.react/")
            || id.includes("/qr.js/")
          ) {
            return "qr-vendor";
          }

          if (
            id.includes("/clsx/")
            || id.includes("/tailwind-merge/")
            || id.includes("/class-variance-authority/")
          ) {
            return "utility-vendor";
          }

          if (
            id.includes("@radix-ui/react-popover")
            || id.includes("@radix-ui/react-select")
            || id.includes("/cmdk/")
          ) {
            return "picker-ui-vendor";
          }

          if (
            id.includes("@radix-ui/react-dialog")
            || id.includes("@radix-ui/react-alert-dialog")
            || id.includes("@radix-ui/react-hover-card")
            || id.includes("@floating-ui/")
            || id.includes("/react-remove-scroll/")
            || id.includes("/react-remove-scroll-bar/")
            || id.includes("/react-style-singleton/")
            || id.includes("/use-sidecar/")
            || id.includes("/use-callback-ref/")
            || id.includes("/aria-hidden/")
            || id.includes("/vaul/")
          ) {
            return "overlay-ui-vendor";
          }

          if (
            id.includes("@radix-ui/react-dropdown-menu")
            || id.includes("@radix-ui/react-context-menu")
            || id.includes("@radix-ui/react-menubar")
            || id.includes("@radix-ui/react-navigation-menu")
            || id.includes("@radix-ui/react-accordion")
            || id.includes("@radix-ui/react-collapsible")
          ) {
            return "menu-ui-vendor";
          }

          if (
            id.includes("@radix-ui/react-tooltip")
            || id.includes("@radix-ui/react-toast")
            || id.includes("@radix-ui/react-progress")
          ) {
            return "feedback-ui-vendor";
          }

          if (
            id.includes("@radix-ui/react-checkbox")
            || id.includes("@radix-ui/react-radio-group")
            || id.includes("@radix-ui/react-switch")
            || id.includes("@radix-ui/react-slider")
            || id.includes("@radix-ui/react-tabs")
            || id.includes("@radix-ui/react-toggle")
            || id.includes("@radix-ui/react-toggle-group")
            || id.includes("@radix-ui/react-label")
            || id.includes("@radix-ui/react-separator")
            || id.includes("@radix-ui/react-scroll-area")
            || id.includes("@radix-ui/react-avatar")
            || id.includes("@radix-ui/react-aspect-ratio")
            || id.includes("@radix-ui/react-slot")
          ) {
            return "ui-vendor";
          }

          if (id.includes("@radix-ui/")) {
            return "radix-core-vendor";
          }

          if (
            id.includes("/framer-motion/")
          ) {
            return "motion-vendor";
          }

          if (
            id.includes("/recharts/")
            || id.includes("/embla-carousel-react/")
          ) {
            return "data-vendor";
          }

          if (
            id.includes("/react-day-picker/")
            || id.includes("/date-fns/")
            || id.includes("/@internationalized/date/")
          ) {
            return "calendar-vendor";
          }

          if (id.includes("/react-resizable-panels/")) {
            return "layout-vendor";
          }

          return "vendor";
        },
      },
    },
  },
}));

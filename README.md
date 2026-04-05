# Welcome to your Levela project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Levela**

Simply visit the [Levela Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Levela will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.

## Hybrid Development Workflow

This project supports development across multiple platforms:

### Lovable Platform (Web)
The default configuration works with Lovable for web deployment:
```bash
npm run dev          # Development server
npm run build        # Production build for Lovable
```

### Android Development
For Android app development:
```bash
npm run cap:android  # Build and open in Android Studio
npm run update:application  # Build web, sync Android, build APK, and publish it to /downloads/levela-debug.apk
```

### iOS Development
For iOS app development:
```bash
npm run cap:ios      # Build and open in Xcode
```

### Configuration Files
- `capacitor.config.json` - Lovable/web deployment
- `capacitor.config.android.json` - Android-specific config
- Platform directories (`android/`, `ios/`) are gitignored
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Feature Registry Rule

This project keeps a canonical feature registry for both product users and future AI agents.

- Source of truth: `src/lib/feature-registry.ts`
- User-facing reference: the in-app `Features` page
- Supporting copy and workflows: `src/lib/i18n.base.ts`

Whenever you add or change a feature, workflow, page behavior, or notable asset behavior, update the feature registry and the matching Features-page copy in the same change.

## Autosave-by-Default Rule

Editable application pages should use autosave as the default interaction pattern.

- Changes should save automatically after the user pauses or completes the local edit interaction.
- Manual save buttons should only appear as recovery controls when autosave fails.
- New pages and updated pages should follow this rule unless there is a strong product reason to do otherwise.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

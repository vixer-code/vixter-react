# Vixter React App

A modern React application for the Vixter platform, featuring a beautiful dark theme and comprehensive wallet management system.

## Features

- **Modern UI/UX**: Dark theme with gradient effects and smooth animations
- **Wallet Management**: Complete VP and VBP balance tracking
- **Responsive Design**: Works seamlessly across all device sizes
- **SPA Routing**: Client-side routing with catch-all fallback
- **Firebase Integration**: Real-time data synchronization

## Catch-All Routing Implementation

This app implements a comprehensive catch-all approach for handling different reloads and direct URL access:

### How It Works

1. **Client-Side Routing**: Uses React Router with BrowserRouter for clean URLs
2. **Catch-All Route**: The `path="*"` route in App.jsx handles any unmatched paths
3. **404 Page**: Custom NotFound component with helpful navigation options
4. **Server Configuration**: Multiple deployment configurations for different platforms

### Development

```bash
npm run dev
```

The Vite dev server is configured with `historyApiFallback: true` to handle SPA routing during development.

### Production Deployment

#### Netlify
- Uses `public/_redirects` file for SPA routing
- Automatically handles all routes

#### Vercel
- Uses `vercel.json` configuration
- Includes caching headers for static assets

#### Express Server
- Custom `server.js` for traditional hosting
- Serves static files and handles all routes

```bash
npm run build
npm start
```

### File Structure

```
vixter-react/
├── src/
│   ├── pages/
│   │   ├── NotFound.jsx          # 404 page component
│   │   └── NotFound.css          # 404 page styles
│   └── App.jsx                   # Main app with catch-all route
├── public/
│   └── _redirects                # Netlify redirects
├── vercel.json                   # Vercel configuration
├── server.js                     # Express server for production
└── vite.config.js               # Vite configuration with SPA support
```

### Benefits

- ✅ Clean URLs without hash fragments
- ✅ Proper 404 handling with helpful navigation
- ✅ Works with browser refresh and direct URL access
- ✅ Multiple deployment platform support
- ✅ SEO-friendly structure (though limited for SPAs)
- ✅ User-friendly error pages

### Limitations

- ⚠️ No server-side rendering (SSR)
- ⚠️ Limited SEO capabilities
- ⚠️ Requires server configuration for production

## Getting Started

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`
4. Deploy using your preferred platform

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm start` - Start production server
- `npm run lint` - Run ESLint

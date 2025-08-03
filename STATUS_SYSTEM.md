# Online/Busy Status System

This document describes the implementation of the online/busy status system for the Vixter React application.

## Overview

The status system allows users to set their availability status and displays real-time status indicators throughout the application. Users can be:
- **Online** (green) - Available and active
- **Ausente** (yellow) - Away/Inactive
- **Ocupado** (red) - Busy/Do not disturb
- **Offline** (gray) - Not connected

## Components

### StatusContext (`src/contexts/StatusContext.jsx`)
- Manages the current user's status state
- Handles Firebase Realtime Database connections
- Implements automatic away status after 5 minutes of inactivity
- Manages connection/disconnection status

### StatusIndicator (`src/components/StatusIndicator.jsx`)
- Visual status indicator with colored circles
- Interactive dropdown for status selection (for profile owners)
- Supports different sizes (small, medium, large)
- Shows status indicators on profile avatars and friend lists

### UserStatusDisplay (`src/components/UserStatusDisplay.jsx`)
- Text-based status display with icons
- Can show/hide icon and text independently
- Used for displaying status in profile info sections

### useUserStatus Hook (`src/hooks/useUserStatus.js`)
- Custom hook to listen to any user's status
- Real-time updates from Firebase
- Returns current status for any user ID

## Usage

### Basic Status Indicator
```jsx
import StatusIndicator from '../components/StatusIndicator';

// For current user (interactive)
<StatusIndicator 
  userId={currentUser.uid}
  isOwner={true}
  size="large"
/>

// For other users (read-only)
<StatusIndicator 
  userId={otherUserId}
  isOwner={false}
  size="small"
/>
```

### Status Display with Text
```jsx
import UserStatusDisplay from '../components/UserStatusDisplay';

<UserStatusDisplay 
  userId={userId}
  showIcon={true}
  showText={true}
  size="medium"
/>
```

### Using the Status Hook
```jsx
import { useUserStatus } from '../hooks/useUserStatus';

const MyComponent = ({ userId }) => {
  const status = useUserStatus(userId);
  return <div>User is {status}</div>;
};
```

## Firebase Database Structure

The status system uses the following Firebase Realtime Database structure:

```
/status/{userId}
  - state: "online" | "ausente" | "ocupado" | "offline"
  - last_changed: timestamp

/users/{userId}
  - selectedStatus: "online" | "ausente" | "ocupado" | "offline"
```

## Features

### Automatic Status Management
- **Connection Detection**: Automatically sets status to offline when disconnected
- **Inactivity Detection**: Automatically sets status to "ausente" after 5 minutes of inactivity
- **Tab Visibility**: Resets inactivity timer when tab becomes visible
- **Activity Monitoring**: Resets timer on mouse, keyboard, and touch events

### Visual Indicators
- **Color-coded circles**: Green (online), Yellow (away), Red (busy), Gray (offline)
- **Glow effects**: Each status has a subtle glow effect
- **Pulse animation**: Online status has a gentle pulse animation
- **Interactive dropdown**: Profile owners can click to change status

### Responsive Design
- Different sizes for different contexts (small for friend lists, large for profiles)
- Mobile-friendly touch interactions
- Adaptive positioning for different screen sizes

## Integration Points

### Profile Page
- Status indicator on profile avatar
- Status display in profile info section
- Status indicators on follower avatars

### Friend Lists
- Small status indicators on friend avatars
- Real-time status updates

### Future Integration
- Message system: Show online status in chat
- Feed: Show status in post author info
- Notifications: Status-based notification preferences

## Styling

The status system uses CSS custom properties and follows the app's design system:
- Colors match the app's color palette
- Glow effects use rgba colors for consistency
- Responsive breakpoints match the app's responsive design
- Dark mode support included

## Performance Considerations

- Uses Firebase Realtime Database listeners efficiently
- Implements proper cleanup of event listeners
- Debounced inactivity detection
- Optimized re-renders with React hooks

## Security

- Status updates are restricted to the current user
- Read-only access for other users' status
- Firebase security rules should be configured to allow:
  - Read access to `/status/{userId}` for all authenticated users
  - Write access to `/status/{userId}` only for the user themselves
  - Read/write access to `/users/{userId}/selectedStatus` only for the user themselves 
/**
 * Utility functions for Dashboard components
 */

/**
 * Get status color based on flow status
 */
export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'success';
    case 'draft':
      return 'info';
    case 'paused':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Format relative time from date string
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
};

/**
 * Tutorial data for the learning center
 */
export const TUTORIAL_DATA = [
  {
    title: 'Getting Started',
    description: 'Learn the basics of creating your first automation flow',
    duration: '10 min',
    level: 'Beginner' as const
  },
  {
    title: 'Advanced Workflows',
    description: 'Build complex multi-step automation workflows',
    duration: '25 min',
    level: 'Advanced' as const
  },
  {
    title: 'API Integration',
    description: 'Connect external services and APIs to your flows',
    duration: '15 min',
    level: 'Intermediate' as const
  },
  {
    title: 'Best Practices',
    description: 'Tips and tricks for optimizing your automation flows',
    duration: '20 min',
    level: 'Intermediate' as const
  }
];

/**
 * Example flows data
 */
export const EXAMPLE_FLOWS = [
  { 
    name: 'Instagram Auto Reply', 
    description: 'Auto-reply to DMs using AI and trigger workflows.' 
  },
  { 
    name: 'Telegram Support Bot', 
    description: 'Handle support inquiries via Telegram with AI.' 
  },
  { 
    name: 'Twitter Post Scheduler', 
    description: 'Schedule and post tweets automatically.' 
  },
  { 
    name: 'Lead Capture to CRM', 
    description: 'Capture web leads and sync to your CRM.' 
  },
];

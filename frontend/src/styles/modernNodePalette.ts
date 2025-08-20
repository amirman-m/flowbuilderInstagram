// Modern Node Color Palette - 10 Attractive Colors for Custom Node Styling
// Independent of category-based coloring system

export interface NodeColor {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
  border: string;
  shadow: string;
}

export const MODERN_NODE_PALETTE: Record<string, NodeColor> = {
  electric: {
    primary: '#6366f1',
    secondary: '#818cf8',
    accent: '#4f46e5',
    text: '#ffffff',
    background: '#f8fafc',
    border: '#e2e8f0',
    shadow: 'rgba(99, 102, 241, 0.25)'
  },
  emerald: {
    primary: '#10b981',
    secondary: '#34d399',
    accent: '#059669',
    text: '#ffffff',
    background: '#f0fdf4',
    border: '#dcfce7',
    shadow: 'rgba(16, 185, 129, 0.25)'
  },
  coral: {
    primary: '#f59e0b',
    secondary: '#fbbf24',
    accent: '#d97706',
    text: '#ffffff',
    background: '#fffbeb',
    border: '#fef3c7',
    shadow: 'rgba(245, 158, 11, 0.25)'
  },
  violet: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    accent: '#7c3aed',
    text: '#ffffff',
    background: '#faf5ff',
    border: '#e9d5ff',
    shadow: 'rgba(139, 92, 246, 0.25)'
  },
  rose: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    accent: '#e11d48',
    text: '#ffffff',
    background: '#fff1f2',
    border: '#fecdd3',
    shadow: 'rgba(244, 63, 94, 0.25)'
  },
  cyan: {
    primary: '#06b6d4',
    secondary: '#22d3ee',
    accent: '#0891b2',
    text: '#ffffff',
    background: '#ecfeff',
    border: '#cffafe',
    shadow: 'rgba(6, 182, 212, 0.25)'
  },
  orange: {
    primary: '#f97316',
    secondary: '#fb923c',
    accent: '#ea580c',
    text: '#ffffff',
    background: '#fff7ed',
    border: '#fed7aa',
    shadow: 'rgba(249, 115, 22, 0.25)'
  },
  pink: {
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#db2777',
    text: '#ffffff',
    background: '#fdf2f8',
    border: '#fbcfe8',
    shadow: 'rgba(236, 72, 153, 0.25)'
  },
  lime: {
    primary: '#84cc16',
    secondary: '#a3e635',
    accent: '#65a30d',
    text: '#ffffff',
    background: '#f7fee7',
    border: '#d9f99d',
    shadow: 'rgba(132, 204, 22, 0.25)'
  },
  indigo: {
    primary: '#4f46e5',
    secondary: '#6366f1',
    accent: '#4338ca',
    text: '#ffffff',
    background: '#f8fafc',
    border: '#e2e8f0',
    shadow: 'rgba(79, 70, 229, 0.25)'
  }
};

// Helper function to get node color by name
export const getNodeColor = (colorName: string): NodeColor => {
  return MODERN_NODE_PALETTE[colorName] || MODERN_NODE_PALETTE.electric;
};

// Helper function to get all available color names
export const getAvailableColors = (): string[] => {
  return Object.keys(MODERN_NODE_PALETTE);
};

// Helper function to generate CSS variables for a color
export const generateColorVariables = (colorName: string): Record<string, string> => {
  const color = getNodeColor(colorName);
  return {
    '--node-primary': color.primary,
    '--node-secondary': color.secondary,
    '--node-accent': color.accent,
    '--node-text': color.text,
    '--node-background': color.background,
    '--node-border': color.border,
    '--node-shadow': color.shadow
  };
};

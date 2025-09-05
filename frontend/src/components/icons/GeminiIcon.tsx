import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const GeminiIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="25%" stopColor="#34A853" />
          <stop offset="50%" stopColor="#FBBC04" />
          <stop offset="75%" stopColor="#EA4335" />
          <stop offset="100%" stopColor="#9AA0A6" />
        </linearGradient>
      </defs>
      {/* Google Gemini star-like logo */}
      <path
        fill="url(#geminiGradient)"
        d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
      />
      <path
        fill="url(#geminiGradient)"
        opacity="0.7"
        d="M12 6L12.55 10.13L17 10.5L12.55 10.87L12 15L11.45 10.87L7 10.5L11.45 10.13L12 6Z"
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        fill="url(#geminiGradient)"
        opacity="0.9"
      />
    </SvgIcon>
  );
};

export default GeminiIcon;

// src/components/nodes/node-types/WebScrapeNode.tsx
import React, { useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeResultDisplay } from '../core/NodeResultDisplay';

export const WebScrapeNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  // Use execution data hook (follows architecture pattern)
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete
  });

  // Current settings
  const currentSettings = instance?.data?.settings || {};
  const { 
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timeout_seconds = 15,
    max_size_bytes = 2000000,
    obey_robots = true,
    follow_redirects = true,
    accept_language = 'en-US,en;q=0.9'
  } = currentSettings;

  // Config status (no required settings for web scraper - URL comes from input)
  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    [] // No required settings
  );

  // Extract outputs
  const outputs = executionData.outputs || {};
  const mainText = outputs.main_text || '';
  const metadata = outputs.metadata || {};
  const links = outputs.links || [];
  const rawHtml = outputs.raw_html || '';

  // Helper functions
  const truncate = (text: string, max = 600) => {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  };

  const renderMetadata = (): string => {
    try {
      const entries = Object.entries(metadata || {});
      if (!entries.length) return '—';
      const compact = entries
        .filter(([k]) => ['title', 'status_code', 'content_type', 'size_bytes'].includes(k))
        .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
        .join(' | ');
      return compact || '—';
    } catch {
      return '—';
    }
  };

  const renderLinks = (): string => {
    const items = Array.isArray(links) ? links.slice(0, 3) : [];
    if (!items.length) return '—';
    const shortened = items.map((link: any, i) => {
      const href = typeof link === 'string' ? link : link?.href || '';
      return `${i + 1}. ${href.length > 40 ? href.slice(0, 40) + '…' : href}`;
    });
    const more = Array.isArray(links) && links.length > 3 ? `\n+${links.length - 3} more` : '';
    return shortened.join('\n') + more;
  };

  // Custom content following architecture pattern
  const customContent = (
    <>
      {/* Settings preview when not executed */}
      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Input: URL from connected node
          </Typography>
          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small" label={`Robots: ${obey_robots ? 'respect' : 'ignore'}`} />
            <Chip size="small" label={`Timeout: ${timeout_seconds}s`} />
            <Chip size="small" label={`Max: ${Math.round(max_size_bytes / 1000000)}MB`} />
          </Box>
        </Box>
      )}

      {/* Main extracted text */}
      {(executionData.hasFreshResults || executionData.isExecuted) && mainText && (
        <NodeResultDisplay
          title="Main Text"
          content={truncate(String(mainText), 800)}
        />
      )}

      {/* Metadata */}
      {(executionData.hasFreshResults || executionData.isExecuted) && metadata && (
        <NodeResultDisplay
          title="Metadata"
          content={renderMetadata()}
        />
      )}

      {/* Links */}
      {(executionData.hasFreshResults || executionData.isExecuted) && Array.isArray(links) && links.length > 0 && (
        <NodeResultDisplay
          title={`Links (${links.length})`}
          content={renderLinks()}
        />
      )}

      {/* Raw HTML preview */}
      {(executionData.hasFreshResults || executionData.isExecuted) && rawHtml && (
        <NodeResultDisplay
          title="Raw HTML"
          content={truncate(String(rawHtml), 600)}
        />
      )}

      {/* Success indicator */}
      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Web scraping completed successfully</Typography>
        </Alert>
      )}

      {/* No configuration warning needed - URL comes from input */}
      {!executionData.isExecuted && (
        <Alert 
          severity="info" 
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Connect a URL source to execute web scraping</Typography>
        </Alert>
      )}
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="indigo"
        showExecuteButton={true}
        showDeleteButton={true}
      />
      {customContent}
    </>
  );
};

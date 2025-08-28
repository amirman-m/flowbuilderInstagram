// src/components/nodes/types/LanguageTranslatorNode.tsx
import React, { useMemo, useState } from 'react';
import { Box, Typography, Alert, Autocomplete, TextField, Chip } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon, Translate as TranslateIcon, Info as InfoIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeResultDisplay } from '../core/NodeResultDisplay';

export const LanguageTranslatorNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  const currentSettings = (instance?.data?.settings || {}) as Record<string, any>;
  const [localTarget, setLocalTarget] = useState<string>(currentSettings.target_language || '');
  const [localSource, setLocalSource] = useState<string>(currentSettings.source_language || '');

  // Build language options from nodeType.settingsSchema
  const languageOptions = useMemo(() => {
    const schema: any = nodeType?.settingsSchema || {};
    const tgt = schema?.properties?.target_language?.oneOf || [];
    // Prefer same options for source
    const src = schema?.properties?.source_language?.oneOf || tgt;

    const toOption = (o: any) => ({ code: o?.const, title: o?.title || o?.const });
    const uniq = (arr: any[]) => {
      const seen = new Set<string>();
      const out: any[] = [];
      arr.forEach((o) => {
        const key = `${o.code}`;
        if (o.code && !seen.has(key)) { seen.add(key); out.push(o); }
      });
      return out;
    };

    return {
      target: uniq((tgt || []).map(toOption)),
      source: uniq((src || []).map(toOption)),
    };
  }, [nodeType]);

  // Persist settings helper
  const saveSettings = (updates: Partial<{ target_language: string; source_language?: string }>) => {
    if (!nodeData.onNodeUpdate || !id) return;
    const next = {
      ...(instance?.data || {}),
      settings: {
        ...(instance?.data?.settings || {}),
        ...updates,
      },
    };
    nodeData.onNodeUpdate(id, {
      data: next as any,
      updatedAt: new Date(),
    });
  };

  // Enforce required target before execution
  const handleBeforeExecute = () => {
    const effectiveTarget = (instance?.data?.settings as any)?.target_language || localTarget;
    if (!effectiveTarget) {
      setShowWarning(true);
      return false;
    }
    return true;
  };

  const [showWarning, setShowWarning] = useState(false);

  // Derive translated/original text and metadata
  const { outputs, displayData } = executionData;
  const messageData = (outputs as any)?.message_data || (displayData as any)?.messageData || (displayData as any)?.message_data;
  const translatedText: string = messageData?.input_text || '';
  const originalText: string = messageData?.input_text_before_translation || '';
  const translationMeta: any = messageData?.metadata?.translation || {};

  const customContent = (
    <Box sx={{ width: 280, maxWidth: 280 }}>
      {/* Settings inline controls */}
      <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Translation Settings
          </Typography>
        </Box>

        {/* Target Language (required) */}
        <Autocomplete
          size="small"
          options={languageOptions.target}
          getOptionLabel={(o) => (o?.title ? `${o.title} (${o.code})` : o?.code || '')}
          value={
            localTarget
              ? languageOptions.target.find((o) => o.code === localTarget) || null
              : (instance?.data?.settings as any)?.target_language
              ? languageOptions.target.find((o) => o.code === (instance?.data?.settings as any)?.target_language) || null
              : null
          }
          onChange={(_, val) => {
            const code = (val as any)?.code || '';
            setLocalTarget(code);
            saveSettings({ target_language: code });
            if (showWarning && code) setShowWarning(false);
          }}
          renderInput={(params) => (
            <TextField {...params} label="Target language (required)" placeholder="Select target" />
          )}
        />

        {/* Source Language (optional) */}
        <Autocomplete
          size="small"
          options={[{ code: '', title: 'Auto-detect' }, ...languageOptions.source]}
          getOptionLabel={(o) => (o?.title ? `${o.title}${o.code ? ` (${o.code})` : ''}` : o?.code || '')}
          value={
            localSource !== undefined
              ? ([{ code: '', title: 'Auto-detect' }, ...languageOptions.source].find((o) => o.code === (localSource || '')) || null)
              : null
          }
          onChange={(_, val) => {
            const code = (val as any)?.code || '';
            setLocalSource(code);
            // Persist empty string as removal (auto-detect)
            saveSettings({ source_language: code || undefined });
          }}
          renderInput={(params) => (
            <TextField {...params} label="Source language (optional)" placeholder="Auto-detect by default" />
          )}
        />
      </Box>

      {/* Divider */}
      <Box sx={{ my: 1, height: 1, bgcolor: 'divider', width: '100%' }} />

      {/* Results */}
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <>
          {translatedText ? (
            <NodeResultDisplay title="Translated Text:" content={translatedText} />
          ) : (
            <NodeResultDisplay title="Translated Text:" content="No translated text available" />
          )}

          {originalText && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Original:
              </Typography>
              <Box sx={{
                mt: 0.5,
                p: 1,
                border: '1px dashed #e5e7eb',
                borderRadius: 1,
                fontSize: '0.8rem',
                maxHeight: 100,
                overflow: 'auto'
              }}>
                {originalText}
              </Box>
            </Box>
          )}

          {/* Metadata */}
          {translationMeta && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" icon={<InfoIcon />} label={`Model: ${translationMeta.model || 'M2M100'}`} />
              {translationMeta.source_language && (
                <Chip size="small" label={`Source: ${translationMeta.source_language}`} />
              )}
              {translationMeta.target_language && (
                <Chip size="small" label={`Target: ${translationMeta.target_language}`} />
              )}
              {typeof translationMeta.source_text_length === 'number' && (
                <Chip size="small" label={`Src len: ${translationMeta.source_text_length}`} />
              )}
              {typeof translationMeta.translated_text_length === 'number' && (
                <Chip size="small" label={`Out len: ${translationMeta.translated_text_length}`} />
              )}
            </Box>
          )}
        </>
      )}

      {executionData.isSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">Text translated successfully</Typography>
        </Alert>
      )}

      {showWarning && !localTarget && !(instance?.data?.settings as any)?.target_language && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">Target language is required before execution.</Typography>
        </Alert>
      )}
    </Box>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="coral"
        onBeforeExecute={handleBeforeExecute}
      />
      {customContent}
    </>
  );
};

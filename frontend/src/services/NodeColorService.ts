// Node Color Service - Manages custom node coloring independent of categories
// SOLID-compliant service following Single Responsibility Principle

import { getNodeColor, getAvailableColors, NodeColor } from '../styles/modernNodePalette';

export interface NodeColorConfiguration {
  nodeId: string;
  colorName: string;
  customColor?: NodeColor;
}

class NodeColorService {
  private static instance: NodeColorService;
  private colorMappings: Map<string, string> = new Map();
  private customColors: Map<string, NodeColor> = new Map();

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): NodeColorService {
    if (!NodeColorService.instance) {
      NodeColorService.instance = new NodeColorService();
    }
    return NodeColorService.instance;
  }

  /**
   * Set color for a specific node
   */
  public setNodeColor(nodeId: string, colorName: string): void {
    if (!getAvailableColors().includes(colorName)) {
      throw new Error(`Invalid color name: ${colorName}. Available colors: ${getAvailableColors().join(', ')}`);
    }
    this.colorMappings.set(nodeId, colorName);
  }

  /**
   * Get color for a specific node
   */
  public getNodeColor(nodeId: string): NodeColor {
    const colorName = this.colorMappings.get(nodeId);
    
    if (colorName) {
      // Check for custom color first
      const customColor = this.customColors.get(nodeId);
      if (customColor) {
        return customColor;
      }
      
      // Return palette color
      return getNodeColor(colorName);
    }
    
    // Default to electric blue if no color is set
    return getNodeColor('electric');
  }

  /**
   * Get color name for a specific node
   */
  public getNodeColorName(nodeId: string): string {
    return this.colorMappings.get(nodeId) || 'electric';
  }

  /**
   * Set custom color for a node (overrides palette)
   */
  public setCustomNodeColor(nodeId: string, customColor: NodeColor): void {
    this.customColors.set(nodeId, customColor);
    this.colorMappings.set(nodeId, 'custom');
  }

  /**
   * Remove custom color and revert to palette
   */
  public removeCustomNodeColor(nodeId: string): void {
    this.customColors.delete(nodeId);
    // Revert to default if it was custom
    if (this.colorMappings.get(nodeId) === 'custom') {
      this.colorMappings.set(nodeId, 'electric');
    }
  }

  /**
   * Get all available palette colors
   */
  public getAvailableColors(): string[] {
    return getAvailableColors();
  }

  /**
   * Bulk set colors for multiple nodes
   */
  public setMultipleNodeColors(configurations: NodeColorConfiguration[]): void {
    configurations.forEach(config => {
      if (config.customColor) {
        this.setCustomNodeColor(config.nodeId, config.customColor);
      } else {
        this.setNodeColor(config.nodeId, config.colorName);
      }
    });
  }

  /**
   * Get color configurations for multiple nodes
   */
  public getMultipleNodeColors(nodeIds: string[]): NodeColorConfiguration[] {
    return nodeIds.map(nodeId => ({
      nodeId,
      colorName: this.getNodeColorName(nodeId),
      customColor: this.customColors.get(nodeId)
    }));
  }

  /**
   * Clear all color mappings
   */
  public clearAllColors(): void {
    this.colorMappings.clear();
    this.customColors.clear();
  }

  /**
   * Export color configuration for persistence
   */
  public exportConfiguration(): {
    colorMappings: Record<string, string>;
    customColors: Record<string, NodeColor>;
  } {
    return {
      colorMappings: Object.fromEntries(this.colorMappings),
      customColors: Object.fromEntries(this.customColors)
    };
  }

  /**
   * Import color configuration from persistence
   */
  public importConfiguration(config: {
    colorMappings: Record<string, string>;
    customColors: Record<string, NodeColor>;
  }): void {
    this.colorMappings = new Map(Object.entries(config.colorMappings));
    this.customColors = new Map(Object.entries(config.customColors));
  }

  /**
   * Get random color for a new node
   */
  public getRandomColor(): string {
    const colors = getAvailableColors();
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Auto-assign colors to nodes in a balanced way
   */
  public autoAssignColors(nodeIds: string[]): void {
    const colors = getAvailableColors();
    nodeIds.forEach((nodeId, index) => {
      const colorName = colors[index % colors.length];
      this.setNodeColor(nodeId, colorName);
    });
  }
}

// Export singleton instance
export const nodeColorService = NodeColorService.getInstance();

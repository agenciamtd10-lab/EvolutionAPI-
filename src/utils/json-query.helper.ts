/**
 * Helper utilities for JSON queries compatible with both MySQL and PostgreSQL
 * Handles JSON extraction and filtering in a provider-agnostic way
 */

export class JsonQueryHelper {
  /**
   * Extract a value from a JSON field
   * Works with both string and object JSON values
   *
   * @param jsonField - The JSON field (can be string or object)
   * @param path - The property path (e.g., 'id', 'remoteJid')
   * @returns The extracted value or undefined
   */
  static extractValue(jsonField: any, path: string): any {
    if (!jsonField) {
      return undefined;
    }

    try {
      // Handle string JSON
      if (typeof jsonField === 'string') {
        const parsed = JSON.parse(jsonField);
        return parsed[path];
      }

      // Handle object JSON
      if (typeof jsonField === 'object') {
        return jsonField[path];
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get nested value from JSON using dot notation path
   *
   * @param jsonField - The JSON field (can be string or object)
   * @param path - The dot notation path (e.g., 'contextInfo.stanzaId')
   * @returns The extracted value or undefined
   */
  static extractNestedValue(jsonField: any, path: string): any {
    if (!jsonField) {
      return undefined;
    }

    try {
      let obj = typeof jsonField === 'string' ? JSON.parse(jsonField) : jsonField;

      const parts = path.split('.');
      for (const part of parts) {
        if (obj == null) {
          return undefined;
        }
        obj = obj[part];
      }

      return obj;
    } catch {
      return undefined;
    }
  }

  /**
   * Convert JSON array to actual array
   *
   * @param jsonField - The JSON field (can be string or array)
   * @returns Parsed array or empty array
   */
  static toArray(jsonField: any): any[] {
    if (!jsonField) {
      return [];
    }

    try {
      if (typeof jsonField === 'string') {
        const parsed = JSON.parse(jsonField);
        return Array.isArray(parsed) ? parsed : [];
      }

      return Array.isArray(jsonField) ? jsonField : [];
    } catch {
      return [];
    }
  }

  /**
   * Convert value to JSON string for storage
   *
   * @param value - The value to serialize
   * @returns JSON string
   */
  static stringify(value: any): string {
    try {
      return JSON.stringify(value);
    } catch {
      return '{}';
    }
  }

  /**
   * Filter array of objects by JSON field value
   *
   * @param items - Array of items with JSON fields
   * @param jsonFieldName - Name of the JSON field
   * @param path - Property path in JSON (e.g., 'id', 'remoteJid')
   * @param value - Value to match
   * @returns Filtered array
   */
  static filterByJsonValue<T extends Record<string, any>>(
    items: T[],
    jsonFieldName: keyof T,
    path: string,
    value: any
  ): T[] {
    return items.filter((item) => {
      const jsonField = item[jsonFieldName];
      const extractedValue = this.extractValue(jsonField, path);
      return extractedValue === value;
    });
  }

  /**
   * Find first item by JSON field value
   *
   * @param items - Array of items with JSON fields
   * @param jsonFieldName - Name of the JSON field
   * @param path - Property path in JSON
   * @param value - Value to match
   * @returns First matching item or undefined
   */
  static findByJsonValue<T extends Record<string, any>>(
    items: T[],
    jsonFieldName: keyof T,
    path: string,
    value: any
  ): T | undefined {
    return items.find((item) => {
      const jsonField = item[jsonFieldName];
      const extractedValue = this.extractValue(jsonField, path);
      return extractedValue === value;
    });
  }

  /**
   * Group items by JSON field value
   *
   * @param items - Array of items
   * @param jsonFieldName - Name of the JSON field
   * @param path - Property path in JSON
   * @returns Map of grouped items
   */
  static groupByJsonValue<T extends Record<string, any>>(
    items: T[],
    jsonFieldName: keyof T,
    path: string
  ): Map<any, T[]> {
    const grouped = new Map<any, T[]>();

    for (const item of items) {
      const jsonField = item[jsonFieldName];
      const key = this.extractValue(jsonField, path);

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key)!.push(item);
    }

    return grouped;
  }
}

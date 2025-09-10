/**
 * Common Types
 * Shared types used across the application
 */

export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type EntityId = string

export interface Timestamps {
  createdAt: Date
  updatedAt: Date
}

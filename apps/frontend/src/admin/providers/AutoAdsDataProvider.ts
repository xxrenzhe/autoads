import {
  DataProvider,
  GetListParams,
  GetListResult,
  GetOneParams,
  GetOneResult,
  GetManyParams,
  GetManyResult,
  GetManyReferenceParams,
  GetManyReferenceResult,
  CreateParams,
  CreateResult,
  UpdateParams,
  UpdateResult,
  UpdateManyParams,
  UpdateManyResult,
  DeleteParams,
  DeleteResult,
  DeleteManyParams,
  DeleteManyResult,
} from 'react-admin';
import { apiClient } from '../../shared/lib/api-client';

/**
 * Custom Data Provider for AutoAds React Admin integration
 * Implements all required DataProvider methods with API integration,
 * complex filtering, sorting, pagination, and error handling
 */
export class AutoAdsDataProvider implements DataProvider {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get a list of records with pagination, sorting, and filtering
   */
  async getList(resource: string, params: GetListParams): Promise<GetListResult> {
    try {
      const page = params.pagination?.page ?? 1;
      const perPage = params.pagination?.perPage ?? 10;
      const field = params.sort?.field ?? 'id';
      const order = params.sort?.order ?? 'ASC';
      const filter = params.filter;

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
        sortBy: field || 'id',
        sortOrder: order || 'ASC',
      });

      // Add filters to query parameters
      Object.entries(filter).forEach(([key, value]: any) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v: any) => queryParams.append(`${key}[]`, v.toString()));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const response = await apiClient.get(`${this.baseUrl}/${resource}?${queryParams}`);

      return {
        data: response.data.items || response.data.data || [],
        total: response.data.total || response.data.count || 0,
      };
    } catch (error) {
      console.error(`Error fetching ${resource} list:`, error);
      throw new Error(`Failed to fetch ${resource} list`);
    }
  }

  /**
   * Get a single record by ID
   */
  async getOne(resource: string, params: GetOneParams): Promise<GetOneResult> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${resource}/${params.id}`);
      
      return {
        data: response.data.data || response.data,
      };
    } catch (error) {
      console.error(`Error fetching ${resource} with ID ${params.id}:`, error);
      throw new Error(`Failed to fetch ${resource} with ID ${params.id}`);
    }
  }

  /**
   * Get multiple records by IDs
   */
  async getMany(resource: string, params: GetManyParams): Promise<GetManyResult> {
    try {
      const ids = params.ids.join(',');
      const response = await apiClient.get(`${this.baseUrl}/${resource}?ids=${ids}`);

      return {
        data: response.data.items || response.data.data || [],
      };
    } catch (error) {
      console.error(`Error fetching multiple ${resource} records:`, error);
      throw new Error(`Failed to fetch multiple ${resource} records`);
    }
  }

  /**
   * Get multiple records with reference to another resource
   */
  async getManyReference(
    resource: string,
    params: GetManyReferenceParams
  ): Promise<GetManyReferenceResult> {
    try {
      const page = params.pagination?.page ?? 1;
      const perPage = params.pagination?.perPage ?? 10;
      const field = params.sort?.field ?? 'id';
      const order = params.sort?.order ?? 'ASC';
      const filter = params.filter;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
        sortBy: field || 'id',
        sortOrder: order || 'ASC',
        [params.target]: params.id.toString(),
      });

      // Add additional filters
      Object.entries(filter).forEach(([key, value]: any) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await apiClient.get(`${this.baseUrl}/${resource}?${queryParams}`);

      return {
        data: response.data.items || response.data.data || [],
        total: response.data.total || response.data.count || 0,
      };
    } catch (error) {
      console.error(`Error fetching ${resource} reference:`, error);
      throw new Error(`Failed to fetch ${resource} reference`);
    }
  }

  /**
   * Create a new record with optimistic updates
   */
  async create(resource: string, params: CreateParams): Promise<CreateResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${resource}`, params.data);

      return {
        data: { ...params.data, id: response.data.id, ...response.data },
      };
    } catch (error) {
      console.error(`Error creating ${resource}:`, error);
      throw new Error(`Failed to create ${resource}`);
    }
  }

  /**
   * Update a record with optimistic updates
   */
  async update(resource: string, params: UpdateParams): Promise<UpdateResult> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/${resource}/${params.id}`,
        params.data
      );

      return {
        data: { ...params.previousData, ...params.data, ...response.data },
      };
    } catch (error) {
      console.error(`Error updating ${resource} with ID ${params.id}:`, error);
      throw new Error(`Failed to update ${resource} with ID ${params.id}`);
    }
  }

  /**
   * Update multiple records
   */
  async updateMany(resource: string, params: UpdateManyParams): Promise<UpdateManyResult> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/${resource}/bulk`, {
        ids: params.ids,
        data: params.data,
      });

      return {
        data: response.data.updatedIds || params.ids,
      };
    } catch (error) {
      console.error(`Error updating multiple ${resource} records:`, error);
      throw new Error(`Failed to update multiple ${resource} records`);
    }
  }

  /**
   * Delete a record
   */
  async delete(resource: string, params: DeleteParams): Promise<DeleteResult> {
    try {
      await apiClient.delete(`${this.baseUrl}/${resource}/${params.id}`);

      return {
        data: params.previousData || { id: params.id },
      };
    } catch (error) {
      console.error(`Error deleting ${resource} with ID ${params.id}:`, error);
      throw new Error(`Failed to delete ${resource} with ID ${params.id}`);
    }
  }

  /**
   * Delete multiple records
   */
  async deleteMany(resource: string, params: DeleteManyParams): Promise<DeleteManyResult> {
    try {
      await apiClient.delete(`${this.baseUrl}/${resource}/bulk`, {
        data: { ids: params.ids },
      });

      return {
        data: params.ids,
      };
    } catch (error) {
      console.error(`Error deleting multiple ${resource} records:`, error);
      throw new Error(`Failed to delete multiple ${resource} records`);
    }
  }

  /**
   * Transform API request data before sending
   */
  private transformRequest(data: any): any {
    // Handle file uploads
    if (data instanceof FormData) {
      return data;
    }

    // Transform dates to ISO strings
    const transformed = { ...data };
    Object.keys(transformed).forEach((key: any) => {
      if (transformed[key] instanceof Date) {
        transformed[key] = transformed[key].toISOString();
      }
    });

    return transformed;
  }

  /**
   * Transform API response data after receiving
   */
  private transformResponse(data: any): any {
    if (!data) return data;

    // Transform ISO date strings back to Date objects
    const transformed = { ...data };
    Object.keys(transformed).forEach((key: any) => {
      if (typeof transformed[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(transformed[key])) {
        transformed[key] = new Date(transformed[key]);
      }
    });

    return transformed;
  }
}

/**
 * Factory function to create AutoAdsDataProvider instance
 */
export const createAutoAdsDataProvider = (baseUrl?: string): DataProvider => {
  return new AutoAdsDataProvider(baseUrl);
};

/**
 * Default data provider instance
 */
export const autoAdsDataProvider = createAutoAdsDataProvider();
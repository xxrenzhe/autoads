// Removed Prisma types; frontend does not optimize DB queries directly.

export interface QueryOptions {
  include?: Record<string, any>;
  select?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
  where?: Record<string, any>;
}

export class QueryOptimizer {
  /**
   * Optimize pagination queries
   */
  static paginate<T extends Record<string, any>>(
    query: T,
    page: number,
    pageSize: number
  ) {
    const skip = (page - 1) * pageSize;
    return {
      ...query,
      skip,
      take: pageSize,
    };
  }

  /**
   * Add only necessary fields (projection)
   */
  static only<T extends Record<string, any>>(query: T, fields: string[]) {
    const select: Record<string, boolean> = {};
    fields.forEach((field: any) => {
      select[field] = true;
    });
    
    return {
      ...query,
      select,
    };
  }

  /**
   * Add count for pagination
   */
  static withCount<T extends { include?: any }>(query: T) {
    return {
      ...query,
      include: {
        ...query.include,
        _count: {
          select: {
            id: true,
          },
        },
      },
    };
  }

  /**
   * Optimize for large datasets with cursor-based pagination
   */
  static cursor<T extends Record<string, any>>(
    query: T,
    cursor: string | null,
    take: number
  ) {
    if (!cursor) {
      return {
        ...query,
        take,
      };
    }

    return {
      ...query,
      take,
      skip: 1, // Skip the cursor itself
      cursor: {
        id: cursor,
      },
    };
  }
}

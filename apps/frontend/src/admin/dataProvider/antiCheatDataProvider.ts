import { fetchUtils } from 'react-admin'
import { stringify } from 'query-string'

const apiUrl = '/ops/api/v1/console/anti-cheat/devices'

const httpClient = fetchUtils.fetchJson

export const antiCheatDataProvider = {
  getList: (resource: any, params: any) => {
    const { page, perPage, sort, order, filter } = params
    
    const query = {
      page,
      perPage,
      sort: sort.field,
      order: sort.order,
      ...filter
    }
    
    const url = `${apiUrl}?${stringify(query)}`
    
    return httpClient(url).then(({ json }) => ({
      data: json.data,
      total: json.total,
      pageInfo: {
        hasNextPage: page * perPage < json.total,
        hasPreviousPage: page > 1
      }
    }))
  },
  
  getOne: (resource: any, params: any) => {
    return httpClient(`${apiUrl}/${params.id}`).then(({ json }) => ({
      data: json
    }))
  },
  
  getMany: (resource: any, params: any) => {
    const query = {
      filter: JSON.stringify({ id: params.ids })
    }
    const url = `${apiUrl}?${stringify(query)}`
    return httpClient(url).then(({ json }) => ({ data: json.data }))
  },
  
  getManyReference: (resource: any, params: any) => {
    const { page, perPage, sort, order, filter, target, id } = params
    
    const query = {
      sort,
      order,
      page,
      perPage,
      filter: { ...filter, [target]: id }
    }
    
    const url = `${apiUrl}?${stringify(query)}`
    
    return httpClient(url).then(({ json }) => ({
      data: json.data,
      total: json.total,
      pageInfo: {
        hasNextPage: page * perPage < json.total,
        hasPreviousPage: page > 1
      }
    }))
  },
  
  update: (resource: any, params: any) => {
    return httpClient(`${apiUrl}`, {
      method: 'PUT',
      body: JSON.stringify({
        deviceId: params.id,
        isSuspicious: params.data.isSuspicious,
        reason: params.data.reason
      })
    }).then(({ json }) => ({ data: json }))
  },
  
  updateMany: (resource: any, params: any) => {
    const query = {
      filter: JSON.stringify({ id: params.ids })
    }
    return httpClient(`${apiUrl}?${stringify(query)}`, {
      method: 'PUT',
      body: JSON.stringify(params.data)
    }).then(({ json }) => ({ data: json }))
  },
  
  create: (resource: any, params: any) => {
    return httpClient(apiUrl, {
      method: 'POST',
      body: JSON.stringify(params.data)
    }).then(({ json }) => ({
      data: { ...params.data, id: json.id }
    }))
  },
  
  delete: (resource: any, params: any) => {
    return httpClient(`${apiUrl}/${params.id}`, {
      method: 'DELETE'
    }).then(({ json }) => ({ data: json }))
  },
  
  deleteMany: (resource: any, params: any) => {
    const query = {
      filter: JSON.stringify({ id: params.ids })
    }
    return httpClient(`${apiUrl}?${stringify(query)}`, {
      method: 'DELETE',
      body: JSON.stringify(params.data)
    }).then(({ json }) => ({ data: json }))
  }
}

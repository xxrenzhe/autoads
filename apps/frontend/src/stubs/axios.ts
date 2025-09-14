// Minimal stub for 'axios'
const axios: any = async (_config: any) => ({ data: null, status: 200 })
axios.get = async (_url: string, _config?: any) => ({ data: null, status: 200 })
axios.post = async (_url: string, _data?: any, _config?: any) => ({ data: null, status: 200 })
axios.create = (_config?: any) => axios
export default axios


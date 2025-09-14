// Nodemailer 兼容声明，导出 Transporter 类型
declare module 'nodemailer' {
  export type Transporter = any
  const nodemailer: any
  export default nodemailer
}


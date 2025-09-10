// Placeholder for email module
export const createTransporter = async () => {
  // Return a mock transporter
  return {
    sendMail: async (options: any) => {
      console.log('Sending email:', options)
      return { messageId: 'mock-message-id' }
    }
  }
}
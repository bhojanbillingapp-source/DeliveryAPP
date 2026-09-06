import api from './client';

export type ChatMessage = {
  message_id: number;
  sender_type: 'CUSTOMER' | 'RIDER';
  sender_id: string;
  message_text: string;
  created_at: string;
};

export async function getMessages(orderId: number): Promise<ChatMessage[]> {
  const { data } = await api.get(`/customer-order/orders/${orderId}/messages`);
  return data.messages || [];
}

export async function sendMessage(orderId: number, message: string): Promise<ChatMessage> {
  const { data } = await api.post(`/customer-order/orders/${orderId}/messages`, { message });
  return data.message;
}

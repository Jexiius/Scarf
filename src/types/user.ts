export interface UserPayload {
  id: string;
  email: string;
  subscriptionTier: 'free' | 'premium';
}
